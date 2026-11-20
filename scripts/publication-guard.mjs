#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const scriptDirectory = path.dirname(new URL(import.meta.url).pathname);
const repositoryRoot = execFileSync("git", ["-C", path.join(scriptDirectory, ".."), "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const policy = JSON.parse(await readFile(path.join(repositoryRoot, ".startwave-public-guard.json"), "utf8"));
if (policy.schemaVersion !== 2) throw new Error(`Unsupported publication policy schema: ${policy.schemaVersion}`);

const zeroSha = "0".repeat(40);
const findings = [];
function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`Publication policy field ${label} must be an array of non-empty strings`);
  }
  return value;
}

requireStringArray(policy.allowedExact, "allowedExact");
requireStringArray(policy.allowedPrefixes, "allowedPrefixes");
requireStringArray(policy.deniedPrefixes, "deniedPrefixes");
requireStringArray(policy.deniedExact, "deniedExact");
requireStringArray(policy.deniedBasenames, "deniedBasenames");
requireStringArray(policy.deniedExtensions, "deniedExtensions");
requireStringArray(policy.deniedSegments, "deniedSegments");
if (requireStringArray(policy.git?.firstPushBaseRefs, "git.firstPushBaseRefs").length === 0) {
  throw new Error("Publication policy field git.firstPushBaseRefs must not be empty");
}

const lowerSet = (items) => new Set(requireStringArray(items, "internal string list").map((item) => item.toLowerCase()));
const allowedExact = lowerSet(policy.allowedExact);
const deniedExact = lowerSet(policy.deniedExact);
const deniedBasenames = lowerSet(policy.deniedBasenames);
const deniedSegments = lowerSet(policy.deniedSegments);

function matchesPrefix(file, prefixes) {
  const lower = file.toLowerCase();
  return prefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
}

function block(file, reason) {
  findings.push(`- ${file}: ${reason}`);
}

function checkRepositoryPath(file, { bypassAllowlist = false } = {}) {
  const lower = file.toLowerCase();
  const basename = path.posix.basename(lower);
  const segments = lower.split("/");
  if (segments.some((segment) => deniedSegments.has(segment))) return block(file, "private or owner-review path segment");
  if (deniedExact.has(lower) || matchesPrefix(lower, policy.deniedPrefixes)) return block(file, "private or owner-review path");
  if (deniedBasenames.has(basename) || basename.startsWith(".env.")) return block(file, "credential or environment file");
  if (policy.deniedExtensions.some((extension) => lower.endsWith(extension))) return block(file, "forbidden local-state extension");
  if (!bypassAllowlist && !allowedExact.has(lower) && !matchesPrefix(lower, policy.allowedPrefixes)) block(file, "path is not present in the public repository allowlist");
}

function checkContent(file, content, { allowBdoArtifactPublishableKey = false } = {}) {
  if (!/\.(?:css|html|js|json|md|mjs|ps1|sh|toml|txt|yaml|yml)$/i.test(file)) return;
  if (/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/.test(content)) block(file, "contains a private key marker");
  if (/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(content)) block(file, "contains a GitHub token pattern");
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(content)) block(file, "contains a Supabase secret key");
  let credentialContent = content;
  if (file === "GAMES/bdo/site/assets/js/bdo-live-data.js" || (allowBdoArtifactPublishableKey && file === "assets/js/bdo-live-data.js")) {
    const assignments = content.match(/^  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_[A-Za-z0-9_-]+';$/gm) ?? [];
    const usages = content.match(/apikey\s*:\s*SUPABASE_PUBLISHABLE_KEY/gi) ?? [];
    if (assignments.length !== 1 || usages.length !== 1) block(file, "invalid Supabase publishable key contract");
    else credentialContent = content.replace(/apikey\s*:\s*SUPABASE_PUBLISHABLE_KEY/gi, "PUBLIC_BROWSER_KEY");
  }
  if (/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]/i.test(credentialContent)) block(file, "contains a credential assignment");
  if (/\/Users\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\]+/.test(content)) block(file, "contains an absolute local user path");
}

function git(args, input) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8", input });
}

function requireCommitSha(value, label) {
  if (!/^[0-9a-f]{40}$/i.test(value ?? "") || value === zeroSha) throw new Error(`${label} must be a full non-zero commit SHA`);
  git(["cat-file", "-e", `${value}^{commit}`]);
  return value.toLowerCase();
}

function resolveRemoteBranch(ref) {
  if (!/^refs\/remotes\/origin\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref ?? "") || ref.includes("..") || ref.endsWith("/")) {
    throw new Error("First-push CI base must be an explicit origin remote-tracking branch ref");
  }
  if (!(policy.git?.firstPushBaseRefs ?? []).includes(ref)) throw new Error(`First-push base ref is not allowed by policy: ${ref}`);
  return requireCommitSha(git(["rev-parse", "--verify", `${ref}^{commit}`]).trim(), "Resolved first-push CI base");
}

function verifyExplicitFirstPushBase(sha) {
  const explicit = requireCommitSha(sha, "Explicit first-push base");
  const refs = policy.git?.firstPushBaseRefs ?? [];
  if (!refs.length) throw new Error("No first-push base refs are configured");
  if (!refs.some((ref) => resolveRemoteBranch(ref) === explicit)) {
    throw new Error("Explicit first-push base does not match an allowed remote-tracking branch");
  }
  return explicit;
}

function checkGitSpec(file, spec, { bypassAllowlist = false } = {}) {
  checkRepositoryPath(file, { bypassAllowlist });
  try { checkContent(file, git(["show", spec])); } catch { block(file, "content could not be read (fail closed)"); }
}

function introducedChanges(base, head, { allowEmpty = false } = {}) {
  base = requireCommitSha(base, "Base");
  head = requireCommitSha(head, "Head");
  if (base === head) {
    if (allowEmpty) return [];
    throw new Error("Refusing an empty commit range");
  }
  if (spawnSyncGit(["merge-base", "--is-ancestor", base, head]) !== 0) throw new Error("Base is not an ancestor of head");
  const commits = git(["rev-list", "--reverse", `${base}..${head}`]).trim().split("\n").filter(Boolean);
  return commits.flatMap((commit) => git(["diff-tree", "--root", "--no-commit-id", "--name-only", "--diff-filter=ACMR", "-r", commit])
    .trim().split("\n").filter(Boolean).map((file) => ({ commit, file })));
}

function spawnSyncGit(args) {
  try { git(args); return 0; } catch (error) { return error.status ?? 1; }
}

async function walkArtifact(root, artifactPolicy, artifactName, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    const full = path.join(root, child);
    const info = await lstat(full);
    if (info.isSymbolicLink()) { block(child, "symbolic links are not publishable"); continue; }
    if (info.isDirectory()) await walkArtifact(root, artifactPolicy, artifactName, child);
    else if (info.isFile()) {
      const lower = child.toLowerCase();
      if (!artifactPolicy.allowedExact.has(lower) && !matchesPrefix(lower, artifactPolicy.allowedPrefixes)) block(child, "path is not present in the deployment artifact allowlist");
      if (deniedBasenames.has(path.posix.basename(lower)) || policy.deniedExtensions.some((extension) => lower.endsWith(extension))) block(child, "forbidden artifact file");
      checkContent(child, await readFile(full, "utf8"), {
        allowBdoArtifactPublishableKey: artifactName === "dist-bdo" && child === "assets/js/bdo-live-data.js"
      });
    } else block(child, "unsupported artifact entry");
  }
}

const [mode, ...args] = process.argv.slice(2);
const ownerSnapshotRequested = process.env.STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT === "1";
const ownerSnapshotBypass = ownerSnapshotRequested && (mode === "--staged" || mode === "--outgoing");
console.log("StartWave publication guard v2");
if (ownerSnapshotBypass) {
  console.log("OWNER-APPROVED FULL SNAPSHOT: repository allowlist bypassed; safety denies, content, secret, history, ancestry, and read-failure checks remain active");
}
try {
  if (ownerSnapshotRequested && !ownerSnapshotBypass) {
    throw new Error("STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT=1 is valid only for --staged or --outgoing");
  }
  if (mode === "--staged") {
    for (const file of git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).trim().split("\n").filter(Boolean)) checkGitSpec(file, `:${file}`, { bypassAllowlist: ownerSnapshotBypass });
  } else if (mode === "--range") {
    if (args.length !== 2 || args.includes(zeroSha)) throw new Error("--range requires two non-zero commit SHAs");
    for (const { commit, file } of introducedChanges(args[0], args[1])) checkGitSpec(file, `${commit}:${file}`);
  } else if (mode === "--ci-range") {
    if (args.length !== 3) throw new Error("--ci-range requires HEAD_SHA EVENT_BASE_SHA FIRST_PUSH_BASE_REF");
    const head = requireCommitSha(args[0], "CI head");
    const firstPush = args[1] === zeroSha;
    const base = firstPush ? resolveRemoteBranch(args[2]) : requireCommitSha(args[1], "CI event base");
    for (const { commit, file } of introducedChanges(base, head, { allowEmpty: firstPush })) checkGitSpec(file, `${commit}:${file}`);
  } else if (mode === "--outgoing") {
    const input = await new Promise((resolve) => { let data = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => resolve(data)); });
    const updates = input.trim().split("\n").filter(Boolean);
    const newBranches = updates.filter((line) => line.split(/\s+/)[3] === zeroSha);
    const explicitBase = process.env.STARTWAVE_PUBLICATION_BASE_SHA;
    if (explicitBase && (updates.length !== 1 || newBranches.length !== 1)) throw new Error("Explicit first-push base requires exactly one new-branch update");
    for (const line of updates) {
      const [, localSha, , remoteSha] = line.split(/\s+/);
      if (!localSha || localSha === zeroSha) continue;
      if (!remoteSha) throw new Error("Malformed pre-push update");
      const firstPush = remoteSha === zeroSha;
      if (firstPush && !explicitBase) throw new Error("New-branch push requires STARTWAVE_PUBLICATION_BASE_SHA on the git push command (fail closed)");
      const base = firstPush ? verifyExplicitFirstPushBase(explicitBase) : remoteSha;
      for (const { commit, file } of introducedChanges(base, localSha, { allowEmpty: firstPush })) checkGitSpec(file, `${commit}:${file}`, { bypassAllowlist: ownerSnapshotBypass });
    }
  } else if (mode === "--artifact") {
    if (args.length !== 1 || path.isAbsolute(args[0])) throw new Error("--artifact requires one repository-relative directory");
    const artifactName = path.posix.normalize(args[0]);
    const configuredArtifact = policy.artifacts?.[artifactName];
    if (!configuredArtifact) throw new Error(`No deployment artifact policy for ${artifactName}`);
    const artifactPolicy = {
      allowedExact: lowerSet(requireStringArray(configuredArtifact.allowedExact, `artifacts.${artifactName}.allowedExact`)),
      allowedPrefixes: requireStringArray(configuredArtifact.allowedPrefixes, `artifacts.${artifactName}.allowedPrefixes`)
    };
    const artifactRoot = path.resolve(repositoryRoot, artifactName);
    if (!artifactRoot.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error("Artifact path escapes repository root");
    await walkArtifact(artifactRoot, artifactPolicy, artifactName);
  } else throw new Error("Usage: publication-guard.sh --staged | --outgoing | --range BASE HEAD | --ci-range HEAD EVENT_BASE FIRST_PUSH_BASE_REF | --artifact DIR");
} catch (error) {
  block("guard", error.message);
}

if (findings.length) {
  console.error(findings.join("\n"));
  console.error("PUBLICATION BLOCKED. No files were deleted or modified.");
  process.exitCode = 1;
} else console.log("PUBLICATION GUARD OK");
