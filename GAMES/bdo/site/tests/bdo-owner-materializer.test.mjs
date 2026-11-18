import assert from 'node:assert/strict';
import { chmodSync, closeSync, constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../../..');
const tool = path.join(root, 'GAMES/bdo/site/tools/bdo-owner-materializer');
const fixture = path.join(here, 'fixtures/bdo-owner-materializer');

const openDirectory = (target) => openSync(target, constants.O_RDONLY);
const invoke = (args, fds) => spawnSync(tool, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe', ...fds] });
const makeOwnerRoot = () => {
  const base = mkdtempSync(path.join(os.tmpdir(), 'startwave-materializer-'));
  const publicationParent = path.join(base, 'publications');
  const anchorParent = path.join(base, 'anchors');
  mkdirSync(publicationParent, { mode: 0o700 }); mkdirSync(anchorParent, { mode: 0o700 });
  return { base, publicationParent, anchorParent };
};
const makeWritable = (target) => {
  try {
    const info = lstatSync(target); if (info.isDirectory()) { chmodSync(target, 0o700); for (const entry of readdirSync(target)) makeWritable(path.join(target, entry)); }
    else if (!info.isSymbolicLink()) chmodSync(target, 0o600);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
};
const cleanup = async (base) => { makeWritable(base); await rm(base, { recursive: true, force: true }); };
const inheritedAcl = 'everyone allow list,search,add_file,delete_child,file_inherit,directory_inherit';
const addInheritedAcl = (target) => {
  const result = spawnSync('chmod', ['+a', inheritedAcl, target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};

test('materialize and independent seal-anchor create exact immutable candidate', async () => {
  const item = makeOwnerRoot();
  const sourceFd = openDirectory(fixture), publicationFd = openDirectory(item.publicationParent), anchorFd = openDirectory(item.anchorParent);
  try {
    const materialized = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', 'candidate'], [sourceFd, publicationFd]);
    assert.equal(materialized.status, 0, materialized.stderr); const receipt = JSON.parse(materialized.stdout);
    assert.equal(Object.keys(receipt.files).length, 10); assert.equal(receipt.publicationCount, 13);
    const publication = path.join(item.publicationParent, 'candidate');
    const sealed = invoke(['seal-anchor', '--publication-parent-fd', '3', '--publication-leaf', 'candidate', '--anchor-parent-fd', '4', '--anchor-leaf', 'anchor.json', '--expected-manifest-sha256', receipt.manifestSha256, '--identity-publication-root', publication, '--identity-manifest-path', path.join(publication, 'manifest.json')], [publicationFd, anchorFd]);
    assert.equal(sealed.status, 0, sealed.stderr);
    assert.equal(statSync(publication).mode & 0o222, 0); assert.equal(statSync(path.join(item.anchorParent, 'anchor.json')).mode & 0o222, 0);
  } finally { closeSync(sourceFd); closeSync(publicationFd); closeSync(anchorFd); await cleanup(item.base); }
});

test('existing publication is never overwritten', async () => {
  const item = makeOwnerRoot(); mkdirSync(path.join(item.publicationParent, 'candidate')); writeFileSync(path.join(item.publicationParent, 'candidate', 'sentinel'), 'unchanged');
  const sourceFd = openDirectory(fixture), publicationFd = openDirectory(item.publicationParent);
  try {
    const result = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', 'candidate'], [sourceFd, publicationFd]);
    assert.notEqual(result.status, 0); assert.equal(readFileSync(path.join(item.publicationParent, 'candidate', 'sentinel'), 'utf8'), 'unchanged');
  } finally { closeSync(sourceFd); closeSync(publicationFd); await rm(item.base, { recursive: true, force: true }); }
});

test('malformed leaf and source symlink fail closed without final target', async () => {
  const item = makeOwnerRoot(); const source = path.join(item.base, 'source');
  mkdirSync(path.join(source, 'assets/js'), { recursive: true }); mkdirSync(path.join(source, 'assets/data'), { recursive: true });
  for (const relative of ['assets/js/bdo-live-data.js','assets/js/bdo-recipes.js','assets/js/bdo-items.js','assets/js/bdo-live-productions.js','assets/data/bdo-productions.json','assets/data/bdo-items.json','assets/data/bdo-recipes.json','production.html','recipes.html','items.html']) {
    const target = path.join(source, relative); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(path.join(fixture, relative), target);
  }
  await rm(path.join(source, 'assets/js/bdo-live-data.js')); (await import('node:fs')).symlinkSync(path.join(fixture, 'assets/js/bdo-live-data.js'), path.join(source, 'assets/js/bdo-live-data.js'));
  const sourceFd = openDirectory(source), publicationFd = openDirectory(item.publicationParent);
  try {
    const malformed = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', '../bad'], [sourceFd, publicationFd]); assert.notEqual(malformed.status, 0);
    const symlink = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', 'candidate'], [sourceFd, publicationFd]); assert.notEqual(symlink.status, 0);
    assert.throws(() => statSync(path.join(item.publicationParent, 'candidate')));
  } finally { closeSync(sourceFd); closeSync(publicationFd); await rm(item.base, { recursive: true, force: true }); }
});

test('inherited extended ACL on owner-only parent is blocked before publication', async () => {
  const item = makeOwnerRoot();
  addInheritedAcl(item.publicationParent);
  const sourceFd = openDirectory(fixture), publicationFd = openDirectory(item.publicationParent);
  try {
    const result = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', 'candidate'], [sourceFd, publicationFd]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not carry an extended ACL/);
    assert.throws(() => statSync(path.join(item.publicationParent, 'candidate')), { code: 'ENOENT' });
  } finally {
    closeSync(sourceFd); closeSync(publicationFd);
    spawnSync('chmod', ['-N', item.publicationParent], { encoding: 'utf8' });
    await cleanup(item.base);
  }
});

test('extended ACL on final publication candidate is blocked before anchor sealing', async () => {
  const item = makeOwnerRoot();
  const sourceFd = openDirectory(fixture), publicationFd = openDirectory(item.publicationParent), anchorFd = openDirectory(item.anchorParent);
  const publication = path.join(item.publicationParent, 'candidate');
  try {
    const materialized = invoke(['materialize', '--source-fd', '3', '--publication-parent-fd', '4', '--publication-leaf', 'candidate'], [sourceFd, publicationFd]);
    assert.equal(materialized.status, 0, materialized.stderr);
    const receipt = JSON.parse(materialized.stdout);
    addInheritedAcl(publication);
    const sealed = invoke(['seal-anchor', '--publication-parent-fd', '3', '--publication-leaf', 'candidate', '--anchor-parent-fd', '4', '--anchor-leaf', 'anchor.json', '--expected-manifest-sha256', receipt.manifestSha256, '--identity-publication-root', publication, '--identity-manifest-path', path.join(publication, 'manifest.json')], [publicationFd, anchorFd]);
    assert.notEqual(sealed.status, 0);
    assert.match(sealed.stderr, /must not carry an extended ACL/);
    assert.throws(() => statSync(path.join(item.anchorParent, 'anchor.json')), { code: 'ENOENT' });
  } finally {
    closeSync(sourceFd); closeSync(publicationFd); closeSync(anchorFd);
    spawnSync('chmod', ['-N', publication], { encoding: 'utf8' });
    await cleanup(item.base);
  }
});
