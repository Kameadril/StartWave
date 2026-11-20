import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workflowPath = path.resolve(import.meta.dirname, "..", ".github", "workflows", "cloudflare-preview.yml");
const workflow = await readFile(workflowPath, "utf8");
const [beforeDeploy, deployJob = ""] = workflow.split(/^  deploy-preview:$/m);

test("preview workflow is manual-only and fixed to startwave", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request):/m);
  assert.match(workflow, /^  PROJECT: startwave$/m);
  assert.doesNotMatch(workflow, /startwave-portal|inputs\.project/);
  assert.match(workflow, /group: cloudflare-preview-startwave-\$\{\{ github\.run_id \}\}/);
});

test("raw dispatch input enters shell only through one environment variable", () => {
  assert.equal((workflow.match(/\$\{\{ inputs\.commit_sha \}\}/g) ?? []).length, 1);
  assert.match(workflow, /^          RAW_COMMIT_SHA: \$\{\{ inputs\.commit_sha \}\}$/m);
});

test("hostile commit inputs are rejected without shell execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "startwave-shell-injection-"));
  const marker = path.join(root, "executed");
  const policy = path.resolve(import.meta.dirname, "cloudflare-preview-policy.mjs");
  const payloads = [
    `$(touch ${marker})`,
    `\`touch ${marker}\``,
    `\"; touch ${marker}; #`,
    `'; touch ${marker}; #`,
    `a\ntouch ${marker}`,
    `a; touch ${marker}`,
    `a|touch ${marker}`,
    `a&&touch ${marker}`
  ];
  for (const raw of payloads) {
    const result = spawnSync("/bin/bash", ["-c", 'node "$POLICY" validate --commit "$RAW_COMMIT_SHA" --project startwave'], {
      encoding: "utf8",
      env: { ...process.env, POLICY: policy, RAW_COMMIT_SHA: raw }
    });
    assert.notEqual(result.status, 0, `payload must be rejected: ${JSON.stringify(raw)}`);
    await assert.rejects(access(marker), `payload executed a command: ${JSON.stringify(raw)}`);
  }
});

test("all third-party actions are pinned to immutable commit SHAs", () => {
  const actionUses = [...workflow.matchAll(/^\s+-?\s*uses: ([^\s]+)$/gm)].map((match) => match[1]);
  assert.ok(actionUses.length >= 6);
  for (const use of actionUses) assert.match(use, /^[^@]+@[0-9a-f]{40}$/, use);
});

test("dedicated StartWave secrets exist only in the environment-gated deployment job", () => {
  assert.ok(deployJob, "deployment job must exist");
  assert.doesNotMatch(beforeDeploy, /secrets\./);
  assert.match(deployJob, /^    environment: cloudflare-startwave-preview$/m);
  assert.match(deployJob, /secrets\.STARTWAVE_CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployJob, /secrets\.STARTWAVE_CLOUDFLARE_API_TOKEN/);
});

test("deployment depends on trusted verification and rechecks integrity", () => {
  assert.match(deployJob, /^    needs: \[trusted-gate, trusted-verify\]$/m);
  assert.match(deployJob, /verify-manifest/);
  assert.match(deployJob, /preview_deployment_setting !== "none"/);
  assert.match(deployJob, /--branch "\$PREVIEW_BRANCH"/);
  assert.match(deployJob, /project\.production_branch === process\.env\.PREVIEW_BRANCH/);
  assert.doesNotMatch(deployJob, /--branch (?:main|production)/);
});

test("candidate execution is isolated between trusted gate and trusted verification", () => {
  assert.match(beforeDeploy, /ref: \$\{\{ github\.workflow_sha \}\}\n          path: controller/);
  assert.match(beforeDeploy, /^  untrusted-build:\n    needs: trusted-gate/m);
  assert.match(beforeDeploy, /^  trusted-verify:\n    needs: \[trusted-gate, untrusted-build\]/m);
  const build = beforeDeploy.split(/^  untrusted-build:$/m)[1].split(/^  trusted-verify:$/m)[0];
  assert.doesNotMatch(build, /path: controller|secrets\.|GITHUB_TOKEN/);
  assert.match(deployJob, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(beforeDeploy, /node verified\/scripts\/publication-guard\.mjs --artifact dist/);
});

test("all downstream candidate bindings use only normalized trusted-gate outputs", () => {
  assert.match(beforeDeploy, /^  trusted-gate:[\s\S]*?^    outputs:\n      commit_sha: \$\{\{ steps\.policy\.outputs\.commit_sha \}\}/m);
  assert.match(beforeDeploy, /^  untrusted-build:\n    needs: trusted-gate/m);
  assert.match(beforeDeploy, /^  trusted-verify:\n    needs: \[trusted-gate, untrusted-build\]/m);
  assert.match(deployJob, /^    needs: \[trusted-gate, trusted-verify\]$/m);
  assert.ok((workflow.match(/needs\.trusted-gate\.outputs\.commit_sha/g) ?? []).length >= 10);
});

test("trusted gate requires exact CI status and static inspection before candidate build", () => {
  const gate = beforeDeploy.split(/^  trusted-gate:$/m)[1].split(/^  untrusted-build:$/m)[0];
  assert.match(gate, /verify-ci-status/);
  assert.match(gate, /Statically inspect candidate before execution/);
  assert.match(gate, /cmp controller\/\.github\/workflows\/ci\.yml candidate-data\/\.github\/workflows\/ci\.yml/);
  assert.match(gate, /publication-guard\.mjs --ci-range/);
  assert.ok(gate.indexOf("cmp controller/.github/workflows/ci.yml") < gate.indexOf("verify-ci-status"));
  assert.match(workflow, /verify-controller/g);
});

test("live Pages configuration is checked before the only deployment command", () => {
  assert.match(deployJob, /api\.cloudflare\.com\/client\/v4\/accounts/);
  assert.match(deployJob, /project\.production_branch === process\.env\.PREVIEW_BRANCH/);
  assert.match(deployJob, /preview_deployment_setting !== "none"/);
  assert.equal((deployJob.match(/pages deploy/g) ?? []).length, 1);
});
