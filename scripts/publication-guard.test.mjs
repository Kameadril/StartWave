import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const privateKeyMarker = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
const privateKeyEndMarker = ["-----END ", "PRIVATE KEY-----"].join("");
const credentialAssignment = ["API_", "KEY=super-secret-value"].join("");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "startwave-guard-v2-"));
  execFileSync("git", ["init", "-q", "-b", "factory"], { cwd: root });
  execFileSync("git", ["config", "user.email", "guard@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Guard Test"], { cwd: root });
  mkdirSync(path.join(root, "scripts"));
  cpSync(path.join(sourceRoot, ".startwave-public-guard.json"), path.join(root, ".startwave-public-guard.json"));
  cpSync(path.join(sourceRoot, "scripts/publication-guard.mjs"), path.join(root, "scripts/publication-guard.mjs"));
  writeFileSync(path.join(root, "README.md"), "baseline\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "baseline"], { cwd: root });
  execFileSync("git", ["update-ref", "refs/remotes/origin/factory", "HEAD"], { cwd: root });
  return root;
}

function run(root, args, input = "", env = {}) {
  return spawnSync("node", ["scripts/publication-guard.mjs", ...args], { cwd: root, encoding: "utf8", input, env: { ...process.env, ...env } });
}

function commit(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
  execFileSync("git", ["add", file], { cwd: root });
  execFileSync("git", ["commit", "-qm", file], { cwd: root });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

test("AGENTS.md remains blocked", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "AGENTS.md", "Public repository rules only.\n");
  assert.equal(run(root, ["--range", base, head]).status, 1);
});

test("secrets, env files, databases, and unknown paths fail", () => {
  const githubToken = "ghp_" + "abcdefghijklmnopqrstuvwxyz123456";
  for (const [file, content] of [["README.md", githubToken], [".env", "SAFE=no"], ["assets/cache.sqlite", "x"], ["assets/private/note.txt", "x"], ["unknown.txt", "x"]]) {
    const root = fixture();
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const head = commit(root, file, content);
    assert.equal(run(root, ["--range", base, head]).status, 1, file);
  }
});

test("reconstructed private-key and credential markers fail on an allowed path", () => {
  for (const [content, reason] of [
    [`${privateKeyMarker}\nsynthetic-test-fixture\n${privateKeyEndMarker}\n`, /contains a private key marker/],
    [`${credentialAssignment}\n`, /contains a credential assignment/]
  ]) {
    const root = fixture();
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const head = commit(root, "README.md", content);
    const result = run(root, ["--range", base, head]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, reason);
  }
});

test("new branch outgoing mode fails closed instead of passing an empty range", () => {
  const root = fixture();
  const head = commit(root, "README.md", "Public rules.\n");
  const result = run(root, ["--outgoing"], `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /STARTWAVE_PUBLICATION_BASE_SHA/);
});

test("new branch outgoing mode rechecks the exact explicit factory range inside push", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "README.md", "Public rules.\n");
  const input = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
  assert.equal(run(root, ["--outgoing"], input, { STARTWAVE_PUBLICATION_BASE_SHA: base }).status, 0);
});

test("new branch outgoing mode rejects missing, invalid, non-ancestor, and ambiguous explicit bases", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "README.md", "Public rules.\n");
  const input = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
  assert.equal(run(root, ["--outgoing"], input).status, 1);
  assert.equal(run(root, ["--outgoing"], input, { STARTWAVE_PUBLICATION_BASE_SHA: "factory" }).status, 1);
  execFileSync("git", ["checkout", "-q", "--detach", base], { cwd: root });
  const unrelated = commit(root, "README.md", "sibling\n");
  assert.equal(run(root, ["--outgoing"], input, { STARTWAVE_PUBLICATION_BASE_SHA: unrelated }).status, 1);
  assert.equal(run(root, ["--outgoing"], input + input, { STARTWAVE_PUBLICATION_BASE_SHA: base }).status, 1);
});

test("new branch outgoing mode rejects a later ancestor that hides an earlier blocked commit", () => {
  const root = fixture();
  commit(root, "unknown.txt", "blocked\n");
  const lateBase = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "README.md", "apparently clean tip\n");
  const input = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
  const result = run(root, ["--outgoing"], input, { STARTWAVE_PUBLICATION_BASE_SHA: lateBase });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not match an allowed remote-tracking branch/);
});

test("new branch at the exact configured factory commit has a safe empty range", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const input = `refs/heads/topic ${base} refs/heads/topic ${"0".repeat(40)}\n`;
  assert.equal(run(root, ["--outgoing"], input, { STARTWAVE_PUBLICATION_BASE_SHA: base }).status, 0);
  assert.equal(run(root, ["--ci-range", base, "0".repeat(40), "refs/remotes/origin/factory"]).status, 0);
  assert.equal(run(root, ["--range", base, base]).status, 1);
});

test("CI first push resolves only the configured origin factory ref", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "README.md", "Public rules.\n");
  assert.equal(run(root, ["--ci-range", head, "0".repeat(40), "refs/remotes/origin/factory"]).status, 0);
  assert.equal(run(root, ["--ci-range", head, "0".repeat(40), ""]).status, 1);
  assert.equal(run(root, ["--ci-range", head, "0".repeat(40), "refs/remotes/origin/main"]).status, 1);
  assert.equal(run(root, ["--ci-range", head, "0".repeat(40), "HEAD~1"]).status, 1);
});

test("existing branch outgoing mode checks its explicit remote range", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const head = commit(root, "README.md", "Public rules.\n");
  const result = run(root, ["--outgoing"], `refs/heads/topic ${head} refs/heads/topic ${base}\n`);
  assert.equal(result.status, 0);
});

test("explicit first-push range checks introduced files", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const localPath = "C:\\" + "Users\\alice\\private\n";
  const head = commit(root, "README.md", localPath);
  assert.equal(run(root, ["--range", base, head]).status, 1);
});

test("range checks secrets that were added and later removed from branch history", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  commit(root, "README.md", "ghp_" + "abcdefghijklmnopqrstuvwxyz123456\n");
  const head = commit(root, "README.md", "clean again\n");
  assert.equal(run(root, ["--range", base, head]).status, 1);
});

test("only the exact public browser key contract is allowed", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const valid = "  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';\n  const headers = { api" + "key: SUPABASE_PUBLISHABLE_KEY };\n";
  let head = commit(root, "GAMES/bdo/site/assets/js/bdo-live-data.js", valid);
  assert.equal(run(root, ["--range", base, head]).status, 0);
  head = commit(root, "GAMES/bdo/site/assets/js/bdo-live-data.js", `${valid}const ${"password"} = 'no';\n`);
  assert.equal(run(root, ["--range", base, head]).status, 1);
});

test("publishable-key exception is limited to the current BDO path", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const valid = "  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';\n  const headers = { api" + "key: SUPABASE_PUBLISHABLE_KEY };\n";
  const head = commit(root, "assets/js/bdo-live-data.js", valid);
  assert.equal(run(root, ["--range", base, head]).status, 1);
});

test("generated publishable-key counterpart is accepted only inside dist-bdo artifact validation", () => {
  const root = fixture();
  const valid = "  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';\n  const headers = { api" + "key: SUPABASE_PUBLISHABLE_KEY };\n";
  mkdirSync(path.join(root, "dist-bdo/assets/js"), { recursive: true });
  writeFileSync(path.join(root, "dist-bdo/index.html"), "<h1>ok</h1>");
  writeFileSync(path.join(root, "dist-bdo/assets/js/bdo-live-data.js"), valid);
  assert.equal(run(root, ["--artifact", "dist-bdo"]).status, 0);
  writeFileSync(path.join(root, "dist-bdo/assets/js/bdo-live-data.js"), `${valid}const ${"password"} = 'no';\n`);
  assert.equal(run(root, ["--artifact", "dist-bdo"]).status, 1);
});

test("owner-approved full snapshot bypasses only the repository allowlist", () => {
  const root = fixture();
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  writeFileSync(path.join(root, "owner-approved-note.txt"), "Owner-approved snapshot content.\n");
  execFileSync("git", ["add", "owner-approved-note.txt"], { cwd: root });
  assert.equal(run(root, ["--staged"]).status, 1);
  assert.equal(run(root, ["--staged"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "true" }).status, 1);
  const approved = run(root, ["--staged"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" });
  assert.equal(approved.status, 0);
  assert.match(approved.stdout, /repository allowlist bypassed/);

  const head = commit(root, "owner-approved-note.txt", "Owner-approved outgoing snapshot.\n");
  const update = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
  assert.equal(run(root, ["--outgoing"], update, {
    STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1",
    STARTWAVE_PUBLICATION_BASE_SHA: base
  }).status, 0);

  writeFileSync(path.join(root, "owner-approved-note.txt"), "ghp_" + "abcdefghijklmnopqrstuvwxyz123456\n");
  execFileSync("git", ["add", "owner-approved-note.txt"], { cwd: root });
  assert.equal(run(root, ["--staged"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" }).status, 1);
});

test("owner-approved staged mode cannot bypass safety-denied path categories", () => {
  for (const [file, content] of [
    [".env", `${credentialAssignment}\n`],
    ["certificate.pem", `${privateKeyMarker}\nsynthetic-test-fixture\n${privateKeyEndMarker}\n`],
    ["signing.key", "synthetic-safe-key-fixture\n"],
    ["cache.db", "synthetic-safe-database-fixture\n"],
    ["nested/.env.local", "SAFE_FIXTURE=yes\n"],
    ["private/safe.txt", "synthetic-safe-private-fixture\n"],
    ["AGENTS.md", "synthetic-safe-owner-review-fixture\n"]
  ]) {
    const root = fixture();
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
    execFileSync("git", ["add", file], { cwd: root });
    const result = run(root, ["--staged"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" });
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /credential or environment file|forbidden local-state extension|private or owner-review path/);
  }
});

test("owner-approved outgoing mode cannot bypass safety-denied file types", () => {
  for (const [file, content] of [
    [".env", `${credentialAssignment}\n`],
    ["certificate.pem", `${privateKeyMarker}\nsynthetic-test-fixture\n${privateKeyEndMarker}\n`],
    ["signing.key", "synthetic-safe-key-fixture\n"],
    ["cache.sqlite", "synthetic-safe-database-fixture\n"]
  ]) {
    const root = fixture();
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const head = commit(root, file, content);
    const update = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
    const result = run(root, ["--outgoing"], update, {
      STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1",
      STARTWAVE_PUBLICATION_BASE_SHA: base
    });
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /credential or environment file|forbidden local-state extension/);
  }
});

test("owner-approved full snapshot cannot bypass history, ancestry, CI, or artifact checks", () => {
  const root = fixture();
  const head = commit(root, "README.md", "topic\n");
  const newBranch = `refs/heads/topic ${head} refs/heads/topic ${"0".repeat(40)}\n`;
  assert.equal(run(root, ["--outgoing"], newBranch, { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" }).status, 1);

  mkdirSync(path.join(root, "dist"));
  writeFileSync(path.join(root, "dist/unknown.txt"), "extra\n");
  assert.equal(run(root, ["--artifact", "dist"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" }).status, 1);
  assert.equal(run(root, ["--ci-range", head, head, "refs/remotes/origin/factory"], "", { STARTWAVE_OWNER_APPROVED_FULL_SNAPSHOT: "1" }).status, 1);
});

test("missing or malformed required policy fields fail closed", () => {
  for (const mutation of [
    (policy) => { delete policy.deniedSegments; },
    (policy) => { policy.allowedExact = "README.md"; },
    (policy) => { policy.git.firstPushBaseRefs = []; }
  ]) {
    const root = fixture();
    const policyPath = path.join(root, ".startwave-public-guard.json");
    const fixturePolicy = JSON.parse(readFileSync(policyPath, "utf8"));
    mutation(fixturePolicy);
    writeFileSync(policyPath, JSON.stringify(fixturePolicy));
    assert.equal(run(root, ["--staged"]).status, 1);
  }
});

test("artifact validation accepts mapped output and rejects extra files and secrets", () => {
  const root = fixture();
  mkdirSync(path.join(root, "dist/assets/css"), { recursive: true });
  writeFileSync(path.join(root, "dist/index.html"), "<h1>ok</h1>");
  writeFileSync(path.join(root, "dist/assets/css/style.css"), "body{}\n");
  assert.equal(run(root, ["--artifact", "dist"]).status, 0);
  mkdirSync(path.join(root, "dist-bdo/assets/css"), { recursive: true });
  writeFileSync(path.join(root, "dist-bdo/index.html"), "<h1>ok</h1>");
  writeFileSync(path.join(root, "dist-bdo/alchemy.html"), "<h1>alchemy</h1>");
  writeFileSync(path.join(root, "dist-bdo/assets/css/style.css"), "body{}\n");
  assert.equal(run(root, ["--artifact", "dist-bdo"]).status, 0);
  writeFileSync(path.join(root, "dist/robots.txt"), "not valid in the main artifact\n");
  writeFileSync(path.join(root, "dist/AGENTS.md"), "not deployable\n");
  writeFileSync(path.join(root, "dist/assets/token.js"), "const pass" + "word = 'secret';\n");
  assert.equal(run(root, ["--artifact", "dist"]).status, 1);
  writeFileSync(path.join(root, "dist-bdo/ai.html"), "not valid in the BDO artifact\n");
  assert.equal(run(root, ["--artifact", "dist-bdo"]).status, 1);
});
