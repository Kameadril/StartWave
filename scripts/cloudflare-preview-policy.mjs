#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const PROJECT = "startwave";
export const TRUSTED_REF = "refs/heads/factory";
export const REQUIRED_CI_WORKFLOW = ".github/workflows/ci.yml";
export const REQUIRED_CI_WORKFLOW_ID = 367941129;
export const REQUIRED_CI_JOB = "verify";
const shaPattern = /^[0-9a-f]{40}$/;

export function validateInputs(commitSha, project = PROJECT) {
  if (!shaPattern.test(commitSha ?? "")) throw new Error("commit_sha must be a lowercase full 40-character Git commit SHA");
  if (project !== PROJECT) throw new Error(`project must be exactly ${PROJECT}`);
  return { commitSha, project: PROJECT, previewBranch: `ci-preview-${commitSha.slice(0, 12)}` };
}

export function validateControllerIdentity(input) {
  const expectedWorkflowRef = `${input.expectedRepository}/.github/workflows/cloudflare-preview.yml@${TRUSTED_REF}`;
  if (!input.expectedRepository || input.repository !== input.expectedRepository) throw new Error("workflow repository does not match the trusted repository");
  if (input.ref !== TRUSTED_REF) throw new Error(`workflow must be dispatched from ${TRUSTED_REF}`);
  if (input.workflowRef !== expectedWorkflowRef) throw new Error("workflow_ref does not identify the trusted workflow on the trusted branch");
  if (!shaPattern.test(input.workflowSha ?? "") || input.workflowSha !== input.checkoutSha) throw new Error("trusted checkout does not match github.workflow_sha");
  return input.workflowSha;
}

export function selectSuccessfulCiRun(runs, commitSha) {
  const matches = (runs ?? []).filter((run) => run?.workflow_id === REQUIRED_CI_WORKFLOW_ID && run?.path === REQUIRED_CI_WORKFLOW && run?.head_sha === commitSha && run?.head_branch === "factory" && run?.event === "push" && run?.status === "completed" && run?.conclusion === "success");
  if (!matches.length) throw new Error(`no successful push run of workflow ${REQUIRED_CI_WORKFLOW_ID} at ${REQUIRED_CI_WORKFLOW} exists for the exact candidate SHA on factory`);
  return matches.sort((a, b) => Number(b.id) - Number(a.id))[0];
}

export function validateCiJobs(jobs) {
  const matches = (jobs ?? []).filter((job) => job?.name === REQUIRED_CI_JOB && job?.status === "completed" && job?.conclusion === "success");
  if (matches.length !== 1) throw new Error(`CI run must contain exactly one successful ${REQUIRED_CI_JOB} job`);
  return matches[0].id;
}

function inside(root, relative) {
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`path escapes artifact root: ${relative}`);
  return resolved;
}

async function collectFiles(root, relative = "") {
  const entries = await readdir(inside(root, relative), { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    const info = await lstat(inside(root, child));
    if (info.isSymbolicLink()) throw new Error(`symbolic links are forbidden in preview artifacts: ${child}`);
    if (info.isDirectory()) files.push(...await collectFiles(root, child));
    else if (info.isFile()) {
      const content = await readFile(inside(root, child));
      files.push({ path: child, size: content.byteLength, sha256: createHash("sha256").update(content).digest("hex") });
    } else throw new Error(`unsupported artifact entry: ${child}`);
  }
  return files;
}

const digest = (files) => createHash("sha256").update(files.map((f) => `${f.sha256} ${f.size} ${JSON.stringify(f.path)}\n`).join("")).digest("hex");

export async function createManifest(directory, metadata) {
  const root = path.resolve(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error("artifact must be a directory");
  const files = await collectFiles(root);
  if (!files.length) throw new Error("artifact must contain at least one file");
  return { schemaVersion: 1, ...metadata, rootSha256: digest(files), files };
}

export async function verifyManifest(directory, manifest, expected) {
  if (manifest?.schemaVersion !== 1) throw new Error("unsupported preview manifest schema");
  for (const key of ["commitSha", "project", "previewBranch"]) if (manifest[key] !== expected[key]) throw new Error(`manifest ${key} does not match the gated deployment input`);
  const actual = await createManifest(directory, expected);
  if (JSON.stringify(actual.files) !== JSON.stringify(manifest.files) || actual.rootSha256 !== manifest.rootSha256) throw new Error("artifact contents do not match the verified manifest");
  return actual.rootSha256;
}

function argument(name) { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; }
function git(repo, args) { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim(); }

async function githubJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" } });
  if (!response.ok) throw new Error(`GitHub CI status request failed with HTTP ${response.status}`);
  return response.json();
}

export async function fetchAllCiJobs(base, runId, request = githubJson) {
  const jobs = [];
  let expectedTotal;
  for (let page = 1; ; page += 1) {
    const payload = await request(`${base}/actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`);
    if (!Number.isSafeInteger(payload?.total_count) || payload.total_count < 0 || !Array.isArray(payload?.jobs)) {
      throw new Error("GitHub Jobs API returned an invalid paginated response");
    }
    if (expectedTotal === undefined) expectedTotal = payload.total_count;
    else if (payload.total_count !== expectedTotal) throw new Error("GitHub Jobs API total_count changed during pagination");
    if (payload.jobs.length > 100) throw new Error("GitHub Jobs API returned more than one page of jobs");
    jobs.push(...payload.jobs);
    if (jobs.length > expectedTotal) throw new Error("GitHub Jobs API returned more jobs than total_count");
    if (jobs.length === expectedTotal) break;
    if (payload.jobs.length !== 100) throw new Error("GitHub Jobs API pagination ended before total_count jobs were returned");
  }
  if (new Set(jobs.map((job) => job?.id)).size !== jobs.length) throw new Error("GitHub Jobs API returned duplicate job ids across pages");
  return jobs;
}

async function verifyCiStatus(commitSha) {
  if (!process.env.GITHUB_REPOSITORY || !process.env.GITHUB_TOKEN) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required");
  const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
  const payload = await githubJson(`${base}/actions/workflows/ci.yml/runs?head_sha=${commitSha}&status=completed&per_page=100`);
  const run = selectSuccessfulCiRun(payload.workflow_runs, commitSha);
  validateCiJobs(await fetchAllCiJobs(base, run.id));
  console.log(`Verified successful CI run ${run.id} for ${commitSha}`);
}

async function main() {
  const mode = process.argv[2];
  const metadata = validateInputs(argument("--commit"), argument("--project") ?? PROJECT);
  if (mode === "validate") {
    if (argument("--github-output")) await writeFile(argument("--github-output"), `commit_sha=${metadata.commitSha}\nproject=${metadata.project}\npreview_branch=${metadata.previewBranch}\n`, { flag: "a" });
  } else if (mode === "verify-controller") {
    validateControllerIdentity({ repository: process.env.GITHUB_REPOSITORY, expectedRepository: process.env.EXPECTED_REPOSITORY, ref: process.env.GITHUB_REF, workflowRef: process.env.GITHUB_WORKFLOW_REF, workflowSha: process.env.GITHUB_WORKFLOW_SHA, checkoutSha: git(argument("--repository"), ["rev-parse", "HEAD"]) });
  } else if (mode === "verify-ci-status") await verifyCiStatus(metadata.commitSha);
  else if (mode === "write-manifest") await writeFile(argument("--output"), `${JSON.stringify(await createManifest(argument("--artifact"), metadata), null, 2)}\n`);
  else if (mode === "verify-manifest") await verifyManifest(argument("--artifact"), JSON.parse(await readFile(argument("--manifest"), "utf8")), metadata);
  else throw new Error("unsupported cloudflare preview policy mode");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
