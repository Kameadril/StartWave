import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createManifest, fetchAllCiJobs, selectSuccessfulCiRun, validateCiJobs, validateControllerIdentity, validateInputs, verifyManifest } from "./cloudflare-preview-policy.mjs";

const sha = "a".repeat(40);
const realSuccessfulRun = {
  id: 44113063509,
  workflow_id: 367941129,
  head_sha: "437dfc8cc3dbe9d2a2b072d1861a41d8c282cd68",
  head_branch: "factory",
  path: ".github/workflows/ci.yml",
  status: "completed",
  conclusion: "success",
  event: "push"
};

async function artifact() {
  const root = await mkdtemp(path.join(tmpdir(), "startwave-preview-artifact-"));
  await mkdir(path.join(root, "assets", "css"), { recursive: true });
  await writeFile(path.join(root, "index.html"), "<h1>StartWave</h1>\n");
  await writeFile(path.join(root, "assets", "css", "style.css"), "body {}\n");
  return root;
}

test("accepts only a full lowercase SHA and the single startwave target", () => {
  assert.deepEqual(validateInputs(sha, "startwave"), {
    commitSha: sha,
    project: "startwave",
    previewBranch: "ci-preview-aaaaaaaaaaaa"
  });
  assert.throws(() => validateInputs(sha, "startwave-portal"), /exactly startwave/);
  for (const invalid of ["a".repeat(39), "A".repeat(40), "main", "", undefined]) {
    assert.throws(() => validateInputs(invalid, "startwave"), /commit_sha/);
  }
  for (const invalid of ["startwave-bdo", "main", ""]) {
    assert.throws(() => validateInputs(sha, invalid), /project must be exactly/);
  }
});

test("manifest is deterministic and binds artifact, project, branch, and commit", async () => {
  const root = await artifact();
  const metadata = validateInputs(sha, "startwave");
  const first = await createManifest(root, metadata);
  const second = await createManifest(root, metadata);
  assert.deepEqual(first, second);
  assert.equal(first.files.length, 2);
  assert.equal(await verifyManifest(root, first, metadata), first.rootSha256);
  await assert.rejects(() => verifyManifest(root, { ...first, project: "startwave-portal" }, metadata), /project/);
});

test("controller identity binds repository, trusted branch, workflow path, and checkout SHA", () => {
  const input = { repository: "Kameadril/StartWave", expectedRepository: "Kameadril/StartWave", ref: "refs/heads/factory", workflowRef: "Kameadril/StartWave/.github/workflows/cloudflare-preview.yml@refs/heads/factory", workflowSha: sha, checkoutSha: sha };
  assert.equal(validateControllerIdentity(input), sha);
  for (const key of ["repository", "ref", "workflowRef", "checkoutSha"]) assert.throws(() => validateControllerIdentity({ ...input, [key]: "wrong" }));
});

test("CI gate accepts the observed GitHub workflow_run fixture", () => {
  assert.equal(selectSuccessfulCiRun([realSuccessfulRun], realSuccessfulRun.head_sha).id, realSuccessfulRun.id);
});

test("CI gate binds workflow id, path, SHA, branch, event, and completed success", () => {
  const run = { ...realSuccessfulRun, id: 7, head_sha: sha };
  assert.equal(selectSuccessfulCiRun([run], sha).id, 7);
  for (const changed of [
    { workflow_id: 367941130 },
    { path: ".github/workflows/ci.yml@refs/heads/factory" },
    { path: ".github/workflows/other.yml" },
    { head_sha: "b".repeat(40) },
    { head_branch: "topic" },
    { event: "pull_request" },
    { status: "in_progress" },
    { conclusion: "failure" }
  ]) assert.throws(() => selectSuccessfulCiRun([{ ...run, ...changed }], sha), /no successful/);
});

test("CI gate requires exactly one successful verify job", () => {
  assert.equal(validateCiJobs([{ id: 9, name: "verify", status: "completed", conclusion: "success" }]), 9);
  assert.throws(() => validateCiJobs([{ name: "verify", status: "completed", conclusion: "failure" }]), /exactly one/);
  assert.throws(() => validateCiJobs([
    { id: 9, name: "verify", status: "completed", conclusion: "success" },
    { id: 10, name: "verify", status: "completed", conclusion: "success" }
  ]), /exactly one/);
});

test("CI jobs pagination includes a successful verify job after the first 100 jobs", async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: `job-${index + 1}`, status: "completed", conclusion: "success" }));
  const verify = { id: 101, name: "verify", status: "completed", conclusion: "success" };
  const requests = [];
  const jobs = await fetchAllCiJobs("https://api.github.test/repos/owner/repo", 7, async (url) => {
    requests.push(url);
    return url.endsWith("page=1") ? { total_count: 101, jobs: first } : { total_count: 101, jobs: [verify] };
  });
  assert.equal(validateCiJobs(jobs), 101);
  assert.deepEqual(requests.map((url) => new URL(url).searchParams.get("page")), ["1", "2"]);
});

test("CI jobs pagination rejects a second successful verify job on a later page", async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: index === 0 ? "verify" : `job-${index + 1}`, status: "completed", conclusion: "success" }));
  const jobs = await fetchAllCiJobs("https://api.github.test/repos/owner/repo", 7, async (url) => url.endsWith("page=1")
    ? { total_count: 101, jobs: first }
    : { total_count: 101, jobs: [{ id: 101, name: "verify", status: "completed", conclusion: "success" }] });
  assert.throws(() => validateCiJobs(jobs), /exactly one/);
});

test("CI jobs pagination fails closed on incomplete, inconsistent, or duplicate pages", async () => {
  await assert.rejects(() => fetchAllCiJobs("https://api.github.test/repos/owner/repo", 7, async () => ({ total_count: 101, jobs: [{ id: 1 }] })), /ended before total_count/);
  const fullPage = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
  await assert.rejects(() => fetchAllCiJobs("https://api.github.test/repos/owner/repo", 7, async (url) => url.endsWith("page=1")
    ? { total_count: 101, jobs: fullPage }
    : { total_count: 102, jobs: [{ id: 101 }] }), /total_count changed/);
  await assert.rejects(() => fetchAllCiJobs("https://api.github.test/repos/owner/repo", 7, async (url) => url.endsWith("page=1")
    ? { total_count: 101, jobs: fullPage }
    : { total_count: 101, jobs: [{ id: 100 }] }), /duplicate job ids/);
});

test("verification fails closed on changed, added, removed, or linked files", async () => {
  const root = await artifact();
  const metadata = validateInputs(sha, "startwave");
  const manifest = await createManifest(root, metadata);
  await writeFile(path.join(root, "index.html"), "changed\n");
  await assert.rejects(() => verifyManifest(root, manifest, metadata), /do not match/);

  const extraRoot = await artifact();
  const extraManifest = await createManifest(extraRoot, metadata);
  await writeFile(path.join(extraRoot, "extra.txt"), "extra\n");
  await assert.rejects(() => verifyManifest(extraRoot, extraManifest, metadata), /do not match/);

  const linkRoot = await artifact();
  await symlink(path.join(linkRoot, "index.html"), path.join(linkRoot, "linked.html"));
  await assert.rejects(() => createManifest(linkRoot, metadata), /symbolic links are forbidden/);
});
