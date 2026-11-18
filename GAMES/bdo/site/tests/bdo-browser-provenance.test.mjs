import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, copyFile, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { requiredPublicFiles, snapshotLimits, verifyPublicRoot } from './bdo-browser-provenance.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalTmp = await realpath(os.tmpdir());

const fixture = async () => {
  const publicRoot = await mkdtemp(path.join(canonicalTmp, 'startwave-bdo-provenance-'));
  await mkdir(path.join(publicRoot, 'assets/js'), { recursive: true });
  await mkdir(path.join(publicRoot, 'assets/data'), { recursive: true });
  for (const relative of requiredPublicFiles.filter((file) => file.startsWith('assets/js/'))) {
    await copyFile(path.join(root, 'GAMES/bdo/site', relative), path.join(publicRoot, relative));
  }
  await writeFile(path.join(publicRoot, 'assets/data/bdo-productions.json'), JSON.stringify({ productions: Array.from({ length: 13 }, (_, id) => ({ id })) }));
  await writeFile(path.join(publicRoot, 'assets/data/bdo-items.json'), JSON.stringify({ items: [] }));
  await writeFile(path.join(publicRoot, 'assets/data/bdo-recipes.json'), JSON.stringify({ recipes: [] }));
  for (const page of ['production.html', 'recipes.html', 'items.html']) await writeFile(path.join(publicRoot, page), '<!doctype html>');
  const files = {};
  for (const relative of requiredPublicFiles) files[relative] = sha256(await readFile(path.join(publicRoot, relative)));
  const manifestPath = path.join(publicRoot, 'manifest.json');
  const externalPaths = [];
  let manifestSha256;
  const writeManifest = async (next = files) => {
    const bytes = JSON.stringify({ algorithm: 'sha256', files: next });
    await writeFile(manifestPath, bytes);
    manifestSha256 = sha256(bytes);
  };
  await writeManifest();
  return {
    publicRoot, manifestPath, files, writeManifest, externalPaths,
    get manifestSha256() { return manifestSha256; },
    cleanup: async () => {
      await rm(publicRoot, { recursive: true, force: true });
      for (const external of externalPaths) await rm(external, { recursive: true, force: true });
    }
  };
};

const verify = (item, extra = {}) => verifyPublicRoot({
  publicRoot: item.publicRoot, manifestPath: item.manifestPath,
  manifestSha256: item.manifestSha256, sourceRoot: root, ...extra
});

const rejectsMutation = (name, mutate, pattern) => test(name, async () => {
  const item = await fixture();
  try {
    await mutate(item);
    await assert.rejects(() => verify(item), pattern);
  } finally { await item.cleanup(); }
});

test('provenance accepts the exact self-contained fixture', async () => {
  const item = await fixture();
  try { assert.equal((await verify(item)).publicationCount, 13); }
  finally { await item.cleanup(); }
});

test('provenance rejects implicit public root before any spawn', async () => {
  await assert.rejects(() => verifyPublicRoot({ publicRoot: '', manifestPath: '', manifestSha256: '0'.repeat(64), sourceRoot: root }), /explicit absolute path/);
});

test('provenance rejects a missing manifest before any spawn', async () => {
  await assert.rejects(() => verifyPublicRoot({ publicRoot: root, manifestPath: path.join(root, 'missing-manifest.json'), manifestSha256: '0'.repeat(64), sourceRoot: root }));
});

rejectsMutation('rejects manifest outside public root', async (item) => {
  const external = `${item.publicRoot}-manifest.json`;
  item.externalPaths.push(external);
  await copyFile(item.manifestPath, external);
  item.manifestPath = external;
}, /manifest.*outside/i);

rejectsMutation('rejects an extra manifest entry', async (item) => {
  await item.writeManifest({ ...item.files, 'extra.txt': sha256('extra') });
}, /exactly match/);

rejectsMutation('rejects a wrong publication SHA', async (item) => {
  await item.writeManifest({ ...item.files, 'items.html': '0'.repeat(64) });
}, /manifest SHA-256 mismatch/);

rejectsMutation('rejects public/source JS mismatch even with updated manifest', async (item) => {
  await writeFile(path.join(item.publicRoot, 'assets/js/bdo-items.js'), '// mutation');
  await item.writeManifest({ ...item.files, 'assets/js/bdo-items.js': sha256('// mutation') });
}, /public\/source SHA-256 mismatch/);

for (const count of [12, 14]) rejectsMutation(`rejects publication count ${count}`, async (item) => {
  const relative = 'assets/data/bdo-productions.json';
  const bytes = JSON.stringify({ productions: Array.from({ length: count }, (_, id) => ({ id })) });
  await writeFile(path.join(item.publicRoot, relative), bytes);
  await item.writeManifest({ ...item.files, [relative]: sha256(bytes) });
}, /publication count mismatch/);

rejectsMutation('rejects malformed publication JSON', async (item) => {
  const relative = 'assets/data/bdo-productions.json';
  await writeFile(path.join(item.publicRoot, relative), '{');
  await item.writeManifest({ ...item.files, [relative]: sha256('{') });
}, /JSON|Unexpected/);

rejectsMutation('rejects a required file symlink escaping public root', async (item) => {
  const target = `${item.publicRoot}-outside.html`;
  item.externalPaths.push(target);
  await writeFile(target, '<!doctype html>');
  await rm(path.join(item.publicRoot, 'items.html'));
  await symlink(target, path.join(item.publicRoot, 'items.html'));
}, /symlink|outside|ELOOP/);

rejectsMutation('rejects a nested directory symlink escaping public root', async (item) => {
  const external = `${item.publicRoot}-outside-data`;
  item.externalPaths.push(external);
  await cp(path.join(item.publicRoot, 'assets/data'), external, { recursive: true });
  await rm(path.join(item.publicRoot, 'assets/data'), { recursive: true });
  await symlink(external, path.join(item.publicRoot, 'assets/data'));
}, /symlink|outside|ELOOP/);

rejectsMutation('rejects a configured public root symlink', async (item) => {
  const linkedRoot = `${item.publicRoot}-link`;
  item.externalPaths.push(linkedRoot);
  await symlink(item.publicRoot, linkedRoot);
  item.publicRoot = linkedRoot;
  item.manifestPath = path.join(linkedRoot, 'manifest.json');
}, /root.*symlink|ancestor.*symlink/i);

rejectsMutation('rejects a configured public root with a symlink ancestor', async (item) => {
  const realParent = `${item.publicRoot}-real-parent`;
  const linkedParent = `${item.publicRoot}-linked-parent`;
  item.externalPaths.push(linkedParent, realParent);
  await mkdir(realParent);
  await rename(item.publicRoot, path.join(realParent, 'public'));
  await symlink(realParent, linkedParent);
  item.publicRoot = path.join(linkedParent, 'public');
  item.manifestPath = path.join(item.publicRoot, 'manifest.json');
}, /root.*symlink|ancestor.*symlink/i);

rejectsMutation('rejects an oversized file before allocating its content buffer', async (item) => {
  await writeFile(path.join(item.publicRoot, 'items.html'), Buffer.alloc(snapshotLimits.maxFileBytes + 1));
}, /per-file byte limit|exceeds byte limit/i);

rejectsMutation('rejects publication files whose cumulative declared size exceeds the snapshot cap', async (item) => {
  const bytes = Buffer.alloc(Math.floor(snapshotLimits.maxTotalSnapshotBytes / 6) + 1);
  const changed = ['assets/data/bdo-productions.json', 'assets/data/bdo-items.json', 'assets/data/bdo-recipes.json',
    'production.html', 'recipes.html', 'items.html'];
  for (const relative of changed) await writeFile(path.join(item.publicRoot, relative), bytes);
  await item.writeManifest({ ...item.files, ...Object.fromEntries(changed.map((relative) => [relative, sha256(bytes)])) });
}, /total snapshot byte limit|exceeds byte limit/i);

test('rejects a missing external manifest trust anchor', async () => {
  const item = await fixture();
  try { await assert.rejects(() => verify(item, { manifestSha256: undefined }), /MANIFEST_SHA256/); }
  finally { await item.cleanup(); }
});

test('rejects a mismatched external manifest trust anchor', async () => {
  const item = await fixture();
  try { await assert.rejects(() => verify(item, { manifestSha256: '0'.repeat(64) }), /external manifest SHA-256 mismatch/); }
  finally { await item.cleanup(); }
});
