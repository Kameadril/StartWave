import assert from 'node:assert/strict';
import { lstat, mkdir, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { repositoryTestTemp } from './repository-test-temp.mjs';

const fixtures = [];
const sourceRoot = path.resolve(import.meta.dirname, '..');
const fixture = async () => {
  const outer = await repositoryTestTemp(sourceRoot, 'repository-temp-test-');
  const root = path.join(outer, 'repository');
  await mkdir(root);
  fixtures.push(outer);
  return root;
};

test.after(async () => {
  for (const root of fixtures) await rm(root, { recursive: true, force: true });
});

test('creates fixtures only under the canonical repository temp directory', async () => {
  const root = await fixture();
  const created = await repositoryTestTemp(root, 'safe-');
  assert.equal(path.dirname(created), path.join(await realpath(root), '.startwave-agent', 'tmp'));
  assert.equal((await lstat(created)).isDirectory(), true);
});

for (const linkedComponent of ['.startwave-agent', 'tmp']) {
  test(`rejects a pre-existing ${linkedComponent} symlink before creating outside entries`, async () => {
    const root = await fixture();
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    if (linkedComponent === '.startwave-agent') {
      await symlink(outside, path.join(root, '.startwave-agent'));
    } else {
      await mkdir(path.join(root, '.startwave-agent'));
      await symlink(outside, path.join(root, '.startwave-agent', 'tmp'));
    }
    const before = await readdir(outside);
    await assert.rejects(repositoryTestTemp(root, 'blocked-'), /must not be a symbolic link/);
    assert.deepEqual(await readdir(outside), before);
  });
}

for (const fileComponent of ['.startwave-agent', 'tmp']) {
  test(`rejects a pre-existing ${fileComponent} regular file`, async () => {
    const root = await fixture();
    if (fileComponent === '.startwave-agent') {
      await writeFile(path.join(root, '.startwave-agent'), 'not a directory');
    } else {
      await mkdir(path.join(root, '.startwave-agent'));
      await writeFile(path.join(root, '.startwave-agent', 'tmp'), 'not a directory');
    }
    await assert.rejects(repositoryTestTemp(root, 'blocked-'), /must be a directory/);
  });
}

for (const prefix of ['', '.', '..', '../escape-', 'nested/escape-', 'nested\\escape-']) {
  test(`rejects unsafe prefix ${JSON.stringify(prefix)} without creating the agent directory`, async () => {
    const root = await fixture();
    await assert.rejects(repositoryTestTemp(root, prefix), /simple basename/);
    await assert.rejects(lstat(path.join(root, '.startwave-agent')), { code: 'ENOENT' });
  });
}
