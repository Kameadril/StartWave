import assert from 'node:assert/strict';
import { appendFileSync, closeSync, fstatSync, openSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requiredPublicFiles, snapshotLimits } from './bdo-browser-provenance.mjs';
import { parseArgs, preparePublication, readBoundedFd, recordTrustAnchor, sha256, verifyTrustAnchor } from './bdo-publication-workflow-lib.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const launcher = path.join(root, 'GAMES/bdo/site/tests/bdo-browser-launcher.mjs');
const runner = path.join(root, 'GAMES/bdo/site/tests/bdo-browser-runner.mjs');

const fixture = async () => {
  const base = await mkdtemp(path.join(await realpath(os.tmpdir()), 'startwave-v3-2-workflow-'));
  const publication = path.join(base, 'publication');
  await mkdir(publication);
  const files = {};
  for (const relative of requiredPublicFiles) {
    const target = path.join(publication, relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (relative.startsWith('assets/js/')) {
      await copyFile(path.join(root, 'GAMES/bdo/site', relative), target);
      files[relative] = sha256(await import('node:fs/promises').then(({ readFile }) => readFile(target)));
      continue;
    }
    const bytes = relative === 'assets/data/bdo-productions.json'
      ? Buffer.from(JSON.stringify({ productions: Array.from({ length: 13 }, (_, id) => ({ id })) }))
      : Buffer.from(`fixture:${relative}\n`);
    await writeFile(target, bytes);
    files[relative] = sha256(bytes);
  }
  const manifestPath = path.join(publication, 'manifest.json');
  const manifestBytes = Buffer.from(`${JSON.stringify({ algorithm: 'sha256', files }, null, 2)}\n`);
  await writeFile(manifestPath, manifestBytes);
  const anchorPath = path.join(base, 'anchor.json');
  await writeFile(anchorPath, `${JSON.stringify({ schemaVersion: 1, publicationRoot: publication, manifestPath, manifestSha256: sha256(manifestBytes), files }, null, 2)}\n`);
  return { base, publication, manifestPath, anchorPath };
};

test('pathname publication creation fails closed without descriptor-relative primitives', async () => {
  await assert.rejects(() => preparePublication({}), /BLOCKED_UNSAFE_NODE_PATH_WRITE/);
});

test('pathname anchor creation fails closed without descriptor-relative primitives', async () => {
  await assert.rejects(() => recordTrustAnchor({}), /BLOCKED_UNSAFE_NODE_PATH_WRITE/);
});

test('argument parser rejects duplicate trust inputs', () => {
  assert.throws(() => parseArgs(['--trust-anchor-fd', '3', '--trust-anchor-fd', '4']), /duplicate argument/);
});

test('inherited anchor descriptor verifies exact ten-file hash-set and 13 records', async () => {
  const item = await fixture();
  const fd = openSync(item.anchorPath, 'r');
  try {
    const verified = await verifyTrustAnchor({ publicationRoot: item.publication, manifestPath: item.manifestPath, anchorFd: fd });
    assert.equal(Object.keys(verified.hashes).length, 10);
  } finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});

test('supported launcher passes the exact O_RDONLY anchor as FD 3 and stops before browser work', async () => {
  const item = await fixture();
  try {
    const result = spawnSync(process.execPath, [launcher, '--trust-anchor', item.anchorPath, '--publication', item.publication, '--manifest', item.manifestPath, '--provenance-only', 'true'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS — trust anchor inherited descriptor/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /BDO server spawn|BDO browser spawn|CDP ready/);
  } finally { await rm(item.base, { recursive: true, force: true }); }
});

const runRunnerWithFd = (item, fd, identity) => spawnSync(process.execPath, [runner,
  '--trust-anchor-fd', '3', '--trust-anchor-dev', String(identity.dev), '--trust-anchor-ino', String(identity.ino), '--provenance-only', 'true'
], { cwd: root, env: { ...process.env, BDO_BROWSER_PUBLIC_ROOT: item.publication, BDO_BROWSER_PUBLIC_MANIFEST: item.manifestPath }, stdio: ['ignore', 'pipe', 'pipe', fd], encoding: 'utf8' });

test('runner fails closed on a writable inherited anchor before browser work', async () => {
  const item = await fixture(); const fd = openSync(item.anchorPath, 'r+');
  try {
    const result = runRunnerWithFd(item, fd, fstatSync(fd, { bigint: true }));
    assert.equal(result.status, 2); assert.match(result.stderr, /must be O_RDONLY/); assert.doesNotMatch(result.stderr, /BDO server spawn|BDO browser spawn/);
  } finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});

test('runner fails closed when inherited FD identity is the wrong object', async () => {
  const item = await fixture(); const fd = openSync(item.anchorPath, 'r'); const identity = fstatSync(fd, { bigint: true });
  try {
    const result = runRunnerWithFd(item, fd, { dev: identity.dev, ino: identity.ino + 1n });
    assert.equal(result.status, 2); assert.match(result.stderr, /identity mismatch/); assert.doesNotMatch(result.stderr, /BDO server spawn|BDO browser spawn/);
  } finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});

test('runner fails closed when inherited FD 3 is closed', async () => {
  const item = await fixture();
  try {
    const result = spawnSync(process.execPath, [runner, '--trust-anchor-fd', '3', '--trust-anchor-dev', '0', '--trust-anchor-ino', '0', '--provenance-only', 'true'], { cwd: root, env: { ...process.env, BDO_BROWSER_PUBLIC_ROOT: item.publication, BDO_BROWSER_PUBLIC_MANIFEST: item.manifestPath }, stdio: ['ignore', 'pipe', 'pipe', 'ignore'], encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(result.stderr, /public-root provenance failed/); assert.doesNotMatch(result.stderr, /BDO server spawn|BDO browser spawn/);
  } finally { await rm(item.base, { recursive: true, force: true }); }
});

test('anchor read rejects a post-fstat growth before accepting bytes', async () => {
  const item = await fixture();
  const fd = openSync(item.anchorPath, 'r');
  try {
    assert.throws(() => readBoundedFd(fd, snapshotLimits.maxManifestBytes, 'trust anchor', {
      afterFstat: () => appendFileSync(item.anchorPath, 'x')
    }), /grew while reading|changed while reading/);
  } finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});

test('anchor read rejects an already oversized file before allocation', async () => {
  const base = await mkdtemp(path.join(await realpath(os.tmpdir()), 'startwave-v3-2-limit-'));
  const target = path.join(base, 'oversized-anchor');
  await writeFile(target, Buffer.alloc(snapshotLimits.maxManifestBytes + 1));
  const fd = openSync(target, 'r');
  try { assert.throws(() => readBoundedFd(fd, snapshotLimits.maxManifestBytes, 'trust anchor'), /exceeds byte limit/); }
  finally { closeSync(fd); await rm(base, { recursive: true, force: true }); }
});

test('anchor read rejects a writable inherited descriptor', async () => {
  const item = await fixture();
  const fd = openSync(item.anchorPath, 'r+');
  try { assert.throws(() => readBoundedFd(fd, snapshotLimits.maxManifestBytes, 'trust anchor'), /must be O_RDONLY/); }
  finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});

test('verified anchor rejects later manifest mutation', async () => {
  const item = await fixture();
  const fd = openSync(item.anchorPath, 'r');
  try {
    await writeFile(item.manifestPath, '{}\n');
    await assert.rejects(() => verifyTrustAnchor({ publicationRoot: item.publication, manifestPath: item.manifestPath, anchorFd: fd }), /mismatch/);
  } finally { closeSync(fd); await rm(item.base, { recursive: true, force: true }); }
});
