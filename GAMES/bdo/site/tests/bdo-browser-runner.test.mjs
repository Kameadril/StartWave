import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, fstatSync, openSync } from 'node:fs';
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test, { after } from 'node:test';

const root = path.resolve(import.meta.dirname, '../../../..');
const runner = path.join(root, 'GAMES/bdo/site/tests/bdo-browser-runner.mjs');
const server = path.join(root, 'GAMES/bdo/site/tests/bdo-browser-server.mjs');
const fakeBrowser = path.join(root, 'GAMES/bdo/site/tests/bdo-browser-fake-child.mjs');
const canonicalTmp = await realpath(os.tmpdir());
const fixtureRoot = await mkdtemp(path.join(canonicalTmp, 'startwave-bdo-public-fixture-'));
const required = [
  'assets/js/bdo-live-data.js', 'assets/js/bdo-recipes.js', 'assets/js/bdo-items.js', 'assets/js/bdo-live-productions.js',
  'assets/data/bdo-productions.json', 'assets/data/bdo-items.json', 'assets/data/bdo-recipes.json',
  'production.html', 'recipes.html', 'items.html'
];
await mkdir(path.join(fixtureRoot, 'assets/js'), { recursive: true });
await mkdir(path.join(fixtureRoot, 'assets/data'), { recursive: true });
for (const relative of required.filter((file) => file.startsWith('assets/js/'))) {
  await copyFile(path.join(root, 'GAMES/bdo/site', relative), path.join(fixtureRoot, relative));
}
await writeFile(path.join(fixtureRoot, 'assets/data/bdo-productions.json'), JSON.stringify({ productions: Array.from({ length: 13 }, (_, id) => ({ id })) }));
await writeFile(path.join(fixtureRoot, 'assets/data/bdo-items.json'), JSON.stringify({ items: [] }));
await writeFile(path.join(fixtureRoot, 'assets/data/bdo-recipes.json'), JSON.stringify({ recipes: [] }));
for (const page of ['production.html', 'recipes.html', 'items.html']) await writeFile(path.join(fixtureRoot, page), '<!doctype html>');
const files = {};
for (const relative of required) files[relative] = createHash('sha256').update(await readFile(path.join(fixtureRoot, relative))).digest('hex');
const fixtureManifest = path.join(fixtureRoot, 'manifest.json');
const fixtureManifestBytes = JSON.stringify({ algorithm: 'sha256', files }, null, 2);
const fixtureManifestSha256 = createHash('sha256').update(fixtureManifestBytes).digest('hex');
await writeFile(fixtureManifest, fixtureManifestBytes);
const fixtureAnchor = path.join(fixtureRoot, 'anchor.json');
await writeFile(fixtureAnchor, JSON.stringify({ schemaVersion: 1, publicationRoot: fixtureRoot, manifestPath: fixtureManifest, manifestSha256: fixtureManifestSha256, files }, null, 2));
const fixtureAnchorFd = openSync(fixtureAnchor, 'r');
const fixtureAnchorIdentity = fstatSync(fixtureAnchorFd, { bigint: true });
after(() => { closeSync(fixtureAnchorFd); return rm(fixtureRoot, { recursive: true, force: true }); });
const profiles = async () => (await readdir(os.tmpdir())).filter((name) => name.startsWith('startwave-bdo-browser-')).sort();

const run = ({ env = {}, signalAt } = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [
    runner,
    '--trust-anchor-fd', '3',
    '--trust-anchor-dev', String(fixtureAnchorIdentity.dev),
    '--trust-anchor-ino', String(fixtureAnchorIdentity.ino)
  ], {
    cwd: root,
    env: { ...process.env, BDO_BROWSER_TEST_TIMEOUT_MS: '4000', BDO_BROWSER_PUBLIC_ROOT: fixtureRoot, BDO_BROWSER_PUBLIC_MANIFEST: fixtureManifest, ...env },
    stdio: ['ignore', 'pipe', 'pipe', fixtureAnchorFd]
  });
  let stdout = '';
  let stderr = '';
  const maybeSignal = () => {
    if (signalAt && stderr.includes(`BDO runner phase: ${signalAt.phase}`)) {
      const { signal, delayMs = 0 } = signalAt;
      signalAt = null;
      setTimeout(() => child.kill(signal), delayMs);
    }
  };
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; maybeSignal(); });
  child.once('error', reject);
  child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
});

const pidsFrom = (stderr) => [...stderr.matchAll(/(?:server|browser)=(\d+)|pid=(\d+)/g)].map((match) => Number(match[1] || match[2]));
const pidExists = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
};
const isolatedFixture = async () => {
  const parent = await mkdtemp(path.join(canonicalTmp, 'startwave-bdo-server-fixture-'));
  const publicRoot = path.join(parent, 'public');
  await cp(fixtureRoot, publicRoot, { recursive: true });
  return { parent, publicRoot, manifestPath: path.join(publicRoot, 'manifest.json'), manifestSha256: fixtureManifestSha256 };
};
const startServer = async ({ publicRoot, manifestPath, env = {} }) => {
  const child = spawn(process.execPath, [server], {
    cwd: root,
    env: {
      ...process.env,
      BDO_BROWSER_TEST_PORT: '0',
      BDO_BROWSER_PUBLIC_ROOT: publicRoot,
      BDO_BROWSER_PUBLIC_MANIFEST: manifestPath,
      BDO_BROWSER_PUBLIC_MANIFEST_SHA256: fixtureManifestSha256,
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const harness = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', (chunk) => resolve(String(chunk).trim().slice('BDO browser harness: '.length)));
    child.once('close', (code) => reject(new Error(`server exited ${code}: ${stderr}`)));
  });
  return { child, harness, stderr: () => stderr };
};
const stopServer = async (child) => {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) await new Promise((resolve) => child.once('close', resolve));
};

for (const scenario of [
  { signal: 'SIGTERM', phase: 'profile-created' },
  { signal: 'SIGINT', phase: 'browser-spawned' }
]) {
  test(`${scenario.signal} at ${scenario.phase} cleans children and profile`, async () => {
    const before = await profiles();
    const result = await run({
      env: {
        BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser,
        BDO_BROWSER_TEST_PAUSE_PHASE: scenario.phase,
        BDO_BROWSER_TEST_PAUSE_MS: '10000'
      },
      signalAt: scenario
    });
    assert.equal(result.signal, scenario.signal, result.stderr);
    for (const pid of pidsFrom(result.stderr)) assert.equal(pidExists(pid), false, `orphan PID ${pid}`);
    assert.deepEqual(await profiles(), before);
  });
}

test('SIGKILL fallback waits for confirmed child exit', async () => {
  const before = await profiles();
  const result = await run({
    env: {
      BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser,
      BDO_BROWSER_TEST_FAKE_CHILD_IGNORE_SIGTERM: '1',
      BDO_BROWSER_TEST_PAUSE_PHASE: 'browser-spawned',
      BDO_BROWSER_TEST_PAUSE_MS: '10000'
    },
    signalAt: { signal: 'SIGTERM', phase: 'browser-spawned', delayMs: 200 }
  });
  assert.equal(result.signal, 'SIGTERM', result.stderr);
  for (const pid of pidsFrom(result.stderr)) assert.equal(pidExists(pid), false, `orphan PID ${pid}`);
  assert.deepEqual(await profiles(), before);
});

test('timeout exits 1 and removes its temporary profile', async () => {
  const before = await profiles();
  const result = await run({ env: { BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser, BDO_BROWSER_TEST_TIMEOUT_MS: '150' } });
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /timeout: browser startup/);
  assert.deepEqual(await profiles(), before);
});

test('browser crash exits 1 immediately and removes its temporary profile', async () => {
  const before = await profiles();
  const result = await run({ env: { BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: path.join(root, 'package.json') } });
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /browser exited before DevTools startup/);
  assert.deepEqual(await profiles(), before);
});

test('browser stderr is retained and emitted only as one bounded tail', async () => {
  const result = await run({ env: { BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser, BDO_BROWSER_TEST_STDERR_LENGTH: '12000' } });
  assert.equal(result.code, 1, result.stderr);
  assert.doesNotMatch(result.stderr, /SHOULD-NOT-APPEAR/);
  assert.match(result.stderr, /TAIL-MARKER/);
  assert.equal((result.stderr.match(/browser stderr tail/g) || []).length, 1);
  const tail = result.stderr.match(/BDO browser stderr tail \(max 4000 chars\):\n([\s\S]*?)\nBDO server exit:/)?.[1];
  assert.ok(tail, result.stderr);
  assert.ok(tail.length <= 4000, `tail was ${tail.length} chars`);
});

test('hanging Node version fixture times out, is terminated, and server is cleaned', async () => {
  const result = await run({ env: {
    BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser,
    BDO_BROWSER_TEST_VERSION_SCRIPT: fakeBrowser,
    BDO_BROWSER_TEST_VERSION_HANG: '1',
    BDO_BROWSER_VERSION_TIMEOUT_MS: '100'
  } });
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /timeout: browser version probe/);
  for (const pid of pidsFrom(result.stderr)) assert.equal(pidExists(pid), false, `orphan PID ${pid}`);
});

test('missing supported browser is BLOCKED and never reported as PASS', async () => {
  const result = await run({ env: { BDO_BROWSER_TEST_DISABLE_AUTO: '1', BDO_BROWSER_BIN: '' } });
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /BLOCKED — browser runner/);
  assert.doesNotMatch(result.stdout, /PASS/);
});

test('invalid explicit BDO_BROWSER_BIN is BLOCKED', async () => {
  const result = await run({ env: { BDO_BROWSER_BIN: path.join(root, 'does-not-exist-browser') } });
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /BDO_BROWSER_BIN is not an executable file/);
});

test('environment manifest digest override is rejected before browser spawn', async () => {
  const result = await run({ env: { BDO_BROWSER_PUBLIC_MANIFEST_SHA256: fixtureManifestSha256, BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT: fakeBrowser } });
  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /environment manifest digest override is forbidden/);
  assert.doesNotMatch(result.stderr, /BDO browser spawn:/);
});

test('fixed port conflict fails the second server without stopping the first', async () => {
  const port = String(42_000 + Math.floor(Math.random() * 10_000));
  const start = () => spawn(process.execPath, [server], {
    cwd: root,
    env: { ...process.env, BDO_BROWSER_TEST_PORT: port, BDO_BROWSER_PUBLIC_ROOT: fixtureRoot, BDO_BROWSER_PUBLIC_MANIFEST: fixtureManifest, BDO_BROWSER_PUBLIC_MANIFEST_SHA256: fixtureManifestSha256 },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const first = start();
  try {
    await new Promise((resolve, reject) => {
      first.once('error', reject);
      first.stdout.once('data', (chunk) => String(chunk).includes('BDO browser harness:') ? resolve() : reject(new Error(String(chunk))));
    });
    const second = start();
    let secondError = '';
    second.stderr.on('data', (chunk) => { secondError += chunk; });
    const secondResult = await new Promise((resolve) => second.once('close', (code, signal) => resolve({ code, signal })));
    assert.equal(secondResult.code, 1, secondError);
    assert.equal(pidExists(first.pid), true, 'first server survives conflict');
  } finally {
    if (first.exitCode === null && first.signalCode === null) first.kill('SIGTERM');
    if (first.exitCode === null && first.signalCode === null) await new Promise((resolve) => first.once('close', resolve));
  }
  assert.equal(pidExists(first.pid), false);
});

test('immutable snapshot ignores a final symlink replacement after startup', async () => {
  const item = await isolatedFixture();
  const original = path.join(item.publicRoot, 'items.html');
  const external = path.join(item.parent, 'outside.html');
  const { child, harness } = await startServer(item);
  try {
    await writeFile(external, '<!doctype html>outside');
    await rm(original);
    await symlink(external, original);
    const response = await fetch(new URL('/items.html', harness));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<!doctype html>');
  } finally {
    await stopServer(child);
    await rm(item.parent, { recursive: true, force: true });
  }
});

test('server startup rejects nested symlink components before creating snapshot', async () => {
  const item = await isolatedFixture();
  const external = path.join(item.parent, 'outside-data');
  await cp(path.join(item.publicRoot, 'assets/data'), external, { recursive: true });
  await rm(path.join(item.publicRoot, 'assets/data'), { recursive: true });
  await symlink(external, path.join(item.publicRoot, 'assets/data'));
  const child = spawn(process.execPath, [server], {
    cwd: root,
    env: { ...process.env, BDO_BROWSER_TEST_PORT: '0', BDO_BROWSER_PUBLIC_ROOT: item.publicRoot, BDO_BROWSER_PUBLIC_MANIFEST: item.manifestPath, BDO_BROWSER_PUBLIC_MANIFEST_SHA256: item.manifestSha256 },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    const result = await new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
    assert.notEqual(result.code, 0);
    assert.match(stderr, /symlink component|outside|ELOOP/);
  } finally {
    await stopServer(child);
    await rm(item.parent, { recursive: true, force: true });
  }
});
