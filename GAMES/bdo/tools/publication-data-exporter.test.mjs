import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  EXPORT_ALLOWLIST,
  PublicationDataError,
  exportPublicationDataPackage,
  inspectCanonicalPackage,
  serializePublicationFile,
  validateConsumerContracts,
  verifyStagedPackage
} from './publication-data-exporter.mjs';

const scratchParent = path.join(process.cwd(), '.publication-exporter-test-tmp');

function fixtureData() {
  return {
    items: { schemaVersion: '1', collectionId: 'items', items: [{ id: 'item-1', name: 'Item', relatedItemIds: [], resources: ['resource-1'], productions: ['production-1'], recipes: ['recipe-1'] }] },
    knowledgeGraph: {
      schemaVersion: '1', collectionId: 'knowledge-graph',
      entities: {
        resource: [{ id: 'resource-1', name: 'Resource' }], item: [{ id: 'item-1', name: 'Item' }],
        recipe: [{ id: 'recipe-1', name: 'Recipe' }], production: [{ id: 'production-1', name: 'Production' }]
      },
      edges: [{ from: { type: 'resource', id: 'resource-1' }, to: { type: 'item', id: 'item-1' } }],
      livingObjectPreviews: [], regionPreparations: [],
      knowledgeChains: [{ id: 'chain-1', title: 'Chain', rootEntity: { type: 'resource', id: 'resource-1' }, stages: [{ type: 'item', entityIds: ['item-1'] }] }]
    },
    productions: { schemaVersion: '1', collectionId: 'productions', productions: [{ id: 'production-1', name: 'Production', inputItemIds: ['item-1'], outputItemIds: ['item-1'], chainItemIds: ['item-1'], preparationRecipeIds: ['recipe-1'], assemblyRecipeId: 'recipe-1', recipes: ['recipe-1'] }] },
    recipes: { schemaVersion: '1', collectionId: 'recipes', recipes: [{ id: 'recipe-1', name: 'Recipe', materialItemIds: ['item-1'], resultItemId: 'item-1', productionIds: ['production-1'] }] },
    resources: { schemaVersion: '1', collectionId: 'resources', resources: [{ id: 'resource-1', name: 'Resource', relations: { items: ['item-1'], recipes: ['recipe-1'], productions: ['production-1'] } }] }
  };
}

async function makeRepo(mutator) {
  await mkdir(scratchParent, { recursive: true });
  const repo = await mkdtemp(path.join(scratchParent, 'repo-'));
  const data = fixtureData();
  if (mutator) await mutator(data, repo);
  for (const spec of EXPORT_ALLOWLIST) {
    const target = path.join(repo, spec.source);
    await mkdir(path.dirname(target), { recursive: true });
    const value = data[spec.collection];
    if (Buffer.isBuffer(value) || typeof value === 'string') await writeFile(target, value);
    else await writeFile(target, serializePublicationFile(value));
  }
  return repo;
}

async function withRepo(t, mutator) {
  const repo = await makeRepo(mutator);
  t.after(() => rm(repo, { recursive: true, force: true }));
  return repo;
}

test.after(async () => { await rm(scratchParent, { recursive: true, force: true }); });

test('happy path inspects, exports and verifies exactly five allowlisted outputs', async (t) => {
  const repo = await withRepo(t);
  await writeFile(path.join(repo, 'GAMES/bdo/atlas/data/bdo-workers.json'), '{}\n');
  await writeFile(path.join(repo, 'GAMES/bdo/atlas/data/bdo-knowledge-layer.json'), '{}\n');
  const inspected = await inspectCanonicalPackage({ repoRoot: repo });
  assert.equal(inspected.valid, true);
  assert.equal(Object.keys(inspected.files).length, 5);
  const exported = await exportPublicationDataPackage({ repoRoot: repo, runId: 'happy' });
  const verified = await verifyStagedPackage({ repoRoot: repo, packagePath: exported.packagePath, packageId: exported.packageId });
  assert.equal(verified.valid, true);
  assert.deepEqual(verified.manifest.files.map(({ output }) => output), EXPORT_ALLOWLIST.map(({ output }) => output));
  const files = [];
  async function walk(dir, rel = '') { for (const entry of await readdir(dir, { withFileTypes: true })) { const next = path.join(rel, entry.name); if (entry.isDirectory()) await walk(path.join(dir, entry.name), next); else files.push(next.replaceAll('\\', '/')); } }
  await walk(exported.packagePath);
  assert.deepEqual(files.sort(), [...EXPORT_ALLOWLIST.map(({ output }) => output), 'manifest.json'].sort());
});

test('determinism preserves semantic array order and produces identical package bytes', async (t) => {
  const repo = await withRepo(t, (data) => { data.items.items.push({ id: 'item-2', name: 'Second', relatedItemIds: ['item-1'], resources: [], productions: [], recipes: [] }); });
  const first = await exportPublicationDataPackage({ repoRoot: repo, runId: 'run-a' });
  const second = await exportPublicationDataPackage({ repoRoot: repo, runId: 'run-b' });
  assert.equal(first.packageId, second.packageId);
  assert.deepEqual(first.manifest, second.manifest);
  for (const { output } of EXPORT_ALLOWLIST) assert.deepEqual(await readFile(path.join(first.packagePath, output)), await readFile(path.join(second.packagePath, output)));
  const output = JSON.parse(await readFile(path.join(first.packagePath, EXPORT_ALLOWLIST[0].output), 'utf8'));
  assert.deepEqual(output.items.map(({ id }) => id), ['item-1', 'item-2']);
  const serialized = serializePublicationFile({ z: 1, a: [2, 1] });
  assert.equal(serialized, '{\n  "a": [\n    2,\n    1\n  ],\n  "z": 1\n}\n');
});

for (const [label, mutate, code] of [
  ['schema', (data) => { data.items.items = {}; }, 'COLLECTION_TYPE'],
  ['duplicate IDs', (data) => { data.items.items.push({ ...data.items.items[0] }); }, 'DUPLICATE_ID'],
  ['malformed relation IDs', (data) => { data.recipes.recipes[0].materialItemIds = ['item-1', 42]; }, 'RELATION_ID_TYPE'],
  ['malformed relation container', (data) => { data.resources.resources[0].relations.items = 'item-1'; }, 'RELATION_CONTAINER']
]) test(`rejects invalid ${label}`, async (t) => {
  const repo = await withRepo(t, mutate);
  const inspected = await inspectCanonicalPackage({ repoRoot: repo });
  assert.equal(inspected.valid, false);
  assert.ok(inspected.errors.some((entry) => entry.code === code));
  await assert.rejects(exportPublicationDataPackage({ repoRoot: repo, runId: 'failure' }), PublicationDataError);
  await assert.rejects(readdir(path.join(repo, '.publication-factory-staging/failure')), { code: 'ENOENT' });
});

test('rejects malformed JSON, invalid UTF-8 and BOM', async (t) => {
  for (const [name, bytes] of [['json', '{'], ['utf8', Buffer.from([0xc3, 0x28])], ['bom', Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])]]) {
    await t.test(name, async () => {
      const repo = await makeRepo((data) => { data.items = bytes; });
      try { await assert.rejects(inspectCanonicalPackage({ repoRoot: repo }), PublicationDataError); } finally { await rm(repo, { recursive: true, force: true }); }
    });
  }
});

test('structurally valid unresolved references are warnings, not errors', async (t) => {
  const repo = await withRepo(t, (data) => { data.recipes.recipes[0].resultItemId = 'future-item'; });
  const inspected = await inspectCanonicalPackage({ repoRoot: repo });
  assert.equal(inspected.valid, true);
  assert.equal(inspected.errors.length, 0);
  assert.ok(inspected.warnings.some(({ code, message }) => code === 'UNRESOLVED_REFERENCE' && message.includes('future-item')));
});

test('validateConsumerContracts works on in-memory fixture data', () => {
  const result = validateConsumerContracts(fixtureData());
  assert.equal(result.valid, true);
  assert.deepEqual(result.diagnostics, []);
});

test('rejects staging path escape attempts', async (t) => {
  const repo = await withRepo(t);
  await assert.rejects(exportPublicationDataPackage({ repoRoot: repo, runId: '../escape' }), /unsafe characters/);
  await assert.rejects(verifyStagedPackage({ repoRoot: repo, packagePath: path.dirname(repo) }), /outside the allowed staging zone/);
});

test('rejects a symlinked canonical source where Windows permits symlink creation', async (t) => {
  const repo = await withRepo(t);
  const source = path.join(repo, EXPORT_ALLOWLIST[0].source);
  const actual = `${source}.actual`;
  await writeFile(actual, await readFile(source));
  await rm(source);
  try { await symlink(actual, source, 'file'); } catch (error) { if (['EPERM', 'EACCES', 'UNKNOWN'].includes(error.code)) return t.skip(`symlink unavailable: ${error.code}`); throw error; }
  await assert.rejects(inspectCanonicalPackage({ repoRoot: repo }), /symlink\/reparse/);
});

test('manifest or output tampering causes verification failure', async (t) => {
  await t.test('output hash mismatch', async () => {
    const repo = await makeRepo();
    try {
      const result = await exportPublicationDataPackage({ repoRoot: repo, runId: 'tamper-output' });
      await writeFile(path.join(result.packagePath, EXPORT_ALLOWLIST[0].output), '{}\n');
      await assert.rejects(verifyStagedPackage({ repoRoot: repo, packagePath: result.packagePath }), PublicationDataError);
    } finally { await rm(repo, { recursive: true, force: true }); }
  });
  await t.test('manifest hash mismatch', async () => {
    const repo = await makeRepo();
    try {
      const result = await exportPublicationDataPackage({ repoRoot: repo, runId: 'tamper-manifest' });
      const manifestPath = path.join(result.packagePath, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.files[0].outputSha256 = '0'.repeat(64);
      await writeFile(manifestPath, serializePublicationFile(manifest));
      await assert.rejects(verifyStagedPackage({ repoRoot: repo, packagePath: result.packagePath }), PublicationDataError);
    } finally { await rm(repo, { recursive: true, force: true }); }
  });
});
