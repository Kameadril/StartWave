import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  access, lstat, mkdir, open, readFile, realpath, rename, rm, stat, writeFile
} from 'node:fs/promises';
import path from 'node:path';

export const EXPORTER_VERSION = '1.0.0';
export const MANIFEST_SCHEMA_VERSION = '1.0.0';
export const EXPORT_ALLOWLIST = Object.freeze([
  Object.freeze({ source: 'GAMES/bdo/atlas/data/bdo-items.json', output: 'assets/data/bdo-items.json', collection: 'items' }),
  Object.freeze({ source: 'GAMES/bdo/atlas/data/bdo-knowledge-graph.json', output: 'assets/data/bdo-knowledge-graph.json', collection: 'knowledgeGraph' }),
  Object.freeze({ source: 'GAMES/bdo/atlas/data/bdo-productions.json', output: 'assets/data/bdo-productions.json', collection: 'productions' }),
  Object.freeze({ source: 'GAMES/bdo/atlas/data/bdo-recipes.json', output: 'assets/data/bdo-recipes.json', collection: 'recipes' }),
  Object.freeze({ source: 'GAMES/bdo/atlas/data/bdo-resources.json', output: 'assets/data/bdo-resources.json', collection: 'resources' })
]);

const STAGING_DIR = '.publication-factory-staging';
const RELATION_FIELDS = Object.freeze({
  items: { relatedItemIds: 'items', resources: 'resources', productions: 'productions', recipes: 'recipes', cities: 'cities' },
  recipes: { materialItemIds: 'items', resultItemId: 'items', productionIds: 'productions' },
  productions: {
    inputItemIds: 'items', outputItemIds: 'items', chainItemIds: 'items',
    preparationRecipeIds: 'recipes', assemblyRecipeId: 'recipes', assemblyRecipeIds: 'recipes', recipes: 'recipes',
    professions: 'professions', cities: 'cities', workers: 'workers'
  }
});
const TOP_LEVEL_ORDERS = Object.freeze({
  items: ['schemaVersion', 'collectionId', 'title', 'updatedAt', 'stage', 'entitySchema', 'relationModel', 'verificationPolicy', 'items'],
  knowledgeGraph: ['schemaVersion', 'collectionId', 'title', 'updatedAt', 'stage', 'entityTypes', 'relationChain', 'relationAliases', 'chainArchitecture', 'entities', 'edges', 'livingObjectPreviews', 'regionPreparations', 'knowledgeChains', 'policy'],
  productions: ['schemaVersion', 'collectionId', 'title', 'updatedAt', 'stage', 'entitySchema', 'relationModel', 'productions'],
  recipes: ['schemaVersion', 'collectionId', 'title', 'updatedAt', 'stage', 'entitySchema', 'relationModel', 'verificationPolicy', 'recipes'],
  resources: ['schemaVersion', 'collectionId', 'title', 'updatedAt', 'verificationPolicy', 'resources'],
  manifest: ['manifestSchemaVersion', 'exporterVersion', 'packageId', 'files', 'aggregateSourceHash', 'aggregateOutputSetHash', 'warningCount', 'complete']
});

export class PublicationDataError extends Error {
  constructor(message, diagnostics = []) {
    super(message);
    this.name = 'PublicationDataError';
    this.diagnostics = diagnostics;
  }
}

const slash = (value) => value.replaceAll('\\', '/');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const diagnostic = (severity, code, file, location, message) => ({ severity, code, file, location, message });
const errorsOf = (diagnostics) => diagnostics.filter(({ severity }) => severity === 'ERROR');

function assertNoErrors(diagnostics, context) {
  const errors = errorsOf(diagnostics);
  if (errors.length) throw new PublicationDataError(`${context}: ${errors.length} error(s)`, diagnostics);
}

function isDescendant(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function safeRelative(relative, label) {
  if (!nonempty(relative) || path.isAbsolute(relative)) throw new PublicationDataError(`${label} must be a relative path`);
  const normalized = slash(path.normalize(relative));
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new PublicationDataError(`${label} escapes its allowed root`);
  }
  return normalized;
}

async function assertRegularNoLink(filePath, label) {
  let info;
  try { info = await lstat(filePath); } catch (error) {
    throw new PublicationDataError(`${label} is not accessible: ${error.message}`);
  }
  if (info.isSymbolicLink() || !info.isFile()) throw new PublicationDataError(`${label} must be a regular file (no symlink/reparse point)`);
}

async function assertSafeExistingAncestors(rootReal, target, includeTarget = false) {
  const resolved = path.resolve(target);
  if (!isDescendant(rootReal, resolved)) throw new PublicationDataError(`Path is not a strict descendant of the repository: ${resolved}`);
  const relative = path.relative(rootReal, resolved);
  const parts = relative.split(path.sep).filter(Boolean);
  let cursor = rootReal;
  const limit = includeTarget ? parts.length : Math.max(0, parts.length - 1);
  for (let index = 0; index < limit; index += 1) {
    cursor = path.join(cursor, parts[index]);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink() || (!info.isDirectory() && index < parts.length - 1)) {
        throw new PublicationDataError(`Unsafe symlink/reparse or non-directory path component: ${cursor}`);
      }
      const cursorReal = await realpath(cursor);
      if (cursorReal !== rootReal && !isDescendant(rootReal, cursorReal)) throw new PublicationDataError(`Real path escapes repository: ${cursor}`);
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
  }
}

async function resolveRepo(repoRoot) {
  if (!nonempty(repoRoot)) throw new PublicationDataError('repoRoot is required');
  const root = await realpath(path.resolve(repoRoot));
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new PublicationDataError('repoRoot must be a real directory');
  return root;
}

function decodeStrictUtf8(buffer, file) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    throw new PublicationDataError(`${file}: UTF-8 BOM is not allowed`);
  }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch {
    throw new PublicationDataError(`${file}: invalid UTF-8`);
  }
  return text;
}

function parsePlainJson(buffer, file) {
  const text = decodeStrictUtf8(buffer, file);
  let value;
  try { value = JSON.parse(text); } catch (error) {
    throw new PublicationDataError(`${file}: malformed JSON: ${error.message}`);
  }
  if (!plainObject(value)) throw new PublicationDataError(`${file}: top level must be a plain JSON object`);
  return value;
}

function validateRecordCollection(file, collectionName, records, diagnostics) {
  if (!Array.isArray(records)) {
    diagnostics.push(diagnostic('ERROR', 'COLLECTION_TYPE', file, collectionName, `${collectionName} must be an array`));
    return;
  }
  const ids = new Set();
  records.forEach((record, index) => {
    const location = `${collectionName}[${index}]`;
    if (!plainObject(record)) {
      diagnostics.push(diagnostic('ERROR', 'RECORD_TYPE', file, location, 'record must be a plain object'));
      return;
    }
    if (!nonempty(record.id)) diagnostics.push(diagnostic('ERROR', 'RECORD_ID', file, `${location}.id`, 'id must be a nonempty string'));
    else if (ids.has(record.id)) diagnostics.push(diagnostic('ERROR', 'DUPLICATE_ID', file, `${location}.id`, `duplicate id: ${record.id}`));
    else ids.add(record.id);
    if (!nonempty(record.name)) diagnostics.push(diagnostic('ERROR', 'RECORD_NAME', file, `${location}.name`, 'name must be a nonempty string'));
  });
}

function validateIdValue(value, many, file, location, target, diagnostics, refs) {
  if (value === undefined || value === null) return;
  const values = many ? value : [value];
  if (many && !Array.isArray(value)) {
    diagnostics.push(diagnostic('ERROR', 'RELATION_CONTAINER', file, location, 'relation container must be an array'));
    return;
  }
  values.forEach((id, index) => {
    const itemLocation = many ? `${location}[${index}]` : location;
    if (!nonempty(id)) diagnostics.push(diagnostic('ERROR', 'RELATION_ID_TYPE', file, itemLocation, 'relation id must be a nonempty string'));
    else refs.push({ file, location: itemLocation, target, id });
  });
}

function validateKnowledgeGraph(file, graph, diagnostics, refs) {
  if (!plainObject(graph.entities)) diagnostics.push(diagnostic('ERROR', 'ENTITIES_TYPE', file, 'entities', 'entities must be a plain object'));
  else for (const [type, records] of Object.entries(graph.entities)) {
    if (!Array.isArray(records)) {
      diagnostics.push(diagnostic('ERROR', 'ENTITY_COLLECTION_TYPE', file, `entities.${type}`, 'entity collection must be an array'));
      continue;
    }
    validateRecordCollection(file, `entities.${type}`, records, diagnostics);
  }
  if (!Array.isArray(graph.edges)) diagnostics.push(diagnostic('ERROR', 'EDGES_TYPE', file, 'edges', 'edges must be an array'));
  else graph.edges.forEach((edge, index) => {
    if (!plainObject(edge)) return diagnostics.push(diagnostic('ERROR', 'EDGE_TYPE', file, `edges[${index}]`, 'edge must be a plain object'));
    for (const endpoint of ['from', 'to']) {
      const ref = edge[endpoint];
      if (!plainObject(ref) || !nonempty(ref.type) || !nonempty(ref.id)) diagnostics.push(diagnostic('ERROR', 'GRAPH_REF', file, `edges[${index}].${endpoint}`, 'graph reference must contain nonempty string type and id'));
      else refs.push({ file, location: `edges[${index}].${endpoint}`, target: `graph:${ref.type}`, id: ref.id });
    }
  });
  for (const arrayName of ['livingObjectPreviews', 'regionPreparations', 'knowledgeChains']) {
    if (!Array.isArray(graph[arrayName])) diagnostics.push(diagnostic('ERROR', 'GRAPH_COLLECTION_TYPE', file, arrayName, `${arrayName} must be an array`));
  }
  (graph.livingObjectPreviews || []).forEach((preview, index) => {
    const base = `livingObjectPreviews[${index}]`;
    if (!plainObject(preview) || !nonempty(preview.id)) diagnostics.push(diagnostic('ERROR', 'PREVIEW_CONTRACT', file, base, 'preview requires a nonempty string id'));
    for (const field of ['objectRef', 'contextRef']) {
      const ref = preview?.[field];
      if (!plainObject(ref) || !nonempty(ref.type) || !nonempty(ref.id)) diagnostics.push(diagnostic('ERROR', 'GRAPH_REF', file, `${base}.${field}`, 'graph reference must contain nonempty string type and id'));
      else refs.push({ file, location: `${base}.${field}`, target: `graph:${ref.type}`, id: ref.id });
    }
    validateIdValue(preview?.chainId, false, file, `${base}.chainId`, 'graph:chain', diagnostics, refs);
  });
  (graph.regionPreparations || []).forEach((preparation, index) => {
    const base = `regionPreparations[${index}]`;
    if (!plainObject(preparation) || !nonempty(preparation.id) || !nonempty(preparation.title)) diagnostics.push(diagnostic('ERROR', 'PREPARATION_CONTRACT', file, base, 'region preparation requires nonempty string id and title'));
    const ref = preparation?.cityRef;
    if (!plainObject(ref) || !nonempty(ref.type) || !nonempty(ref.id)) diagnostics.push(diagnostic('ERROR', 'GRAPH_REF', file, `${base}.cityRef`, 'cityRef must contain nonempty string type and id'));
    else refs.push({ file, location: `${base}.cityRef`, target: `graph:${ref.type}`, id: ref.id });
    validateIdValue(preparation?.chainId, false, file, `${base}.chainId`, 'graph:chain', diagnostics, refs);
  });
  (graph.knowledgeChains || []).forEach((chain, chainIndex) => {
    if (!plainObject(chain) || !nonempty(chain.id) || !nonempty(chain.title)) diagnostics.push(diagnostic('ERROR', 'CHAIN_CONTRACT', file, `knowledgeChains[${chainIndex}]`, 'chain requires nonempty string id and title'));
    const root = chain?.rootEntity;
    if (!plainObject(root) || !nonempty(root.type) || !nonempty(root.id)) diagnostics.push(diagnostic('ERROR', 'GRAPH_REF', file, `knowledgeChains[${chainIndex}].rootEntity`, 'rootEntity must contain nonempty string type and id'));
    else refs.push({ file, location: `knowledgeChains[${chainIndex}].rootEntity`, target: `graph:${root.type}`, id: root.id });
    if (!Array.isArray(chain?.stages)) diagnostics.push(diagnostic('ERROR', 'STAGES_TYPE', file, `knowledgeChains[${chainIndex}].stages`, 'stages must be an array'));
    else chain.stages.forEach((stage, stageIndex) => {
      const location = `knowledgeChains[${chainIndex}].stages[${stageIndex}]`;
      if (!plainObject(stage) || !nonempty(stage.type)) return diagnostics.push(diagnostic('ERROR', 'STAGE_TYPE', file, location, 'stage requires a nonempty string type'));
      validateIdValue(stage.entityIds, true, file, `${location}.entityIds`, `graph:${stage.type}`, diagnostics, refs);
    });
  });
}

export function validateConsumerContracts(input) {
  const files = input?.files || input;
  if (!files || typeof files !== 'object') throw new PublicationDataError('validateConsumerContracts requires inspected files');
  const diagnostics = [];
  const refs = [];
  const indexes = new Map();
  for (const spec of EXPORT_ALLOWLIST) {
    const entry = files[spec.collection] || files[spec.source];
    if (!entry) {
      diagnostics.push(diagnostic('ERROR', 'MISSING_SOURCE', spec.source, '', 'allowlisted source is missing'));
      continue;
    }
    const data = entry.data ?? entry;
    if (!plainObject(data)) {
      diagnostics.push(diagnostic('ERROR', 'TOP_LEVEL_TYPE', spec.source, '', 'top level must be a plain object'));
      continue;
    }
    if (spec.collection === 'knowledgeGraph') {
      validateKnowledgeGraph(spec.source, data, diagnostics, refs);
      if (plainObject(data.entities)) for (const [type, records] of Object.entries(data.entities)) {
        indexes.set(`graph:${type}`, new Set((Array.isArray(records) ? records : []).filter(plainObject).map(({ id }) => id).filter(nonempty)));
      }
      indexes.set('graph:chain', new Set((Array.isArray(data.knowledgeChains) ? data.knowledgeChains : []).filter(plainObject).map(({ id }) => id).filter(nonempty)));
    } else {
      const records = data[spec.collection];
      validateRecordCollection(spec.source, spec.collection, records, diagnostics);
      indexes.set(spec.collection, new Set((Array.isArray(records) ? records : []).filter(plainObject).map(({ id }) => id).filter(nonempty)));
      (Array.isArray(records) ? records : []).forEach((record, index) => {
        if (!plainObject(record)) return;
        for (const [field, target] of Object.entries(RELATION_FIELDS[spec.collection] || {})) {
          const many = field !== 'resultItemId' && field !== 'assemblyRecipeId';
          validateIdValue(record[field], many, spec.source, `${spec.collection}[${index}].${field}`, target, diagnostics, refs);
        }
        if (spec.collection === 'resources') {
          if (!plainObject(record.relations)) diagnostics.push(diagnostic('ERROR', 'RELATION_CONTAINER', spec.source, `${spec.collection}[${index}].relations`, 'relations must be a plain object'));
          else for (const target of ['nodes', 'workers', 'recipes', 'items', 'productions', 'mapPoints', 'playerJourneySteps']) validateIdValue(record.relations[target], true, spec.source, `${spec.collection}[${index}].relations.${target}`, target, diagnostics, refs);
        }
      });
    }
  }
  for (const ref of refs) {
    const target = indexes.get(ref.target);
    if (target && !target.has(ref.id)) diagnostics.push(diagnostic('WARNING', 'UNRESOLVED_REFERENCE', ref.file, ref.location, `unresolved ${ref.target} id: ${ref.id}`));
  }
  return { diagnostics, errors: errorsOf(diagnostics), warnings: diagnostics.filter(({ severity }) => severity === 'WARNING'), valid: errorsOf(diagnostics).length === 0 };
}

export async function inspectCanonicalPackage({ repoRoot }) {
  const root = await resolveRepo(repoRoot);
  const files = {};
  for (const spec of EXPORT_ALLOWLIST) {
    const sourcePath = path.resolve(root, safeRelative(spec.source, 'source'));
    if (!isDescendant(root, sourcePath)) throw new PublicationDataError(`Source escapes repository: ${spec.source}`);
    await assertSafeExistingAncestors(root, sourcePath, true);
    await assertRegularNoLink(sourcePath, spec.source);
    const sourceReal = await realpath(sourcePath);
    if (!isDescendant(root, sourceReal)) throw new PublicationDataError(`Source real path escapes repository: ${spec.source}`);
    const bytes = await readFile(sourcePath);
    const data = parsePlainJson(bytes, spec.source);
    files[spec.collection] = { spec, data, bytes, sha256: sha256(bytes), sourcePath };
  }
  const validation = validateConsumerContracts({ files });
  return { repoRoot: root, files, ...validation };
}

export function serializePublicationFile(value) {
  if (!plainObject(value)) throw new PublicationDataError('Publication JSON top level must be a plain object');
  const kind = value.manifestSchemaVersion ? 'manifest'
    : value.items ? 'items'
      : value.entities && value.knowledgeChains ? 'knowledgeGraph'
        : value.productions ? 'productions'
          : value.recipes ? 'recipes'
            : value.resources ? 'resources'
              : null;
  const order = TOP_LEVEL_ORDERS[kind] || [];
  const ordered = {};
  for (const key of order) if (Object.hasOwn(value, key)) ordered[key] = value[key];
  for (const key of Object.keys(value).filter((key) => !order.includes(key)).sort()) ordered[key] = value[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function orderedManifest(manifest) {
  return {
    manifestSchemaVersion: manifest.manifestSchemaVersion,
    exporterVersion: manifest.exporterVersion,
    packageId: manifest.packageId,
    files: manifest.files,
    aggregateSourceHash: manifest.aggregateSourceHash,
    aggregateOutputSetHash: manifest.aggregateOutputSetHash,
    warningCount: manifest.warningCount,
    complete: manifest.complete
  };
}

function aggregateSourceHash(entries) {
  return sha256(entries.map(({ source, sourceSha256 }) => `${source}\t${sourceSha256}`).join('\n'));
}

function aggregateOutputHash(entries) {
  return sha256(entries.map(({ output, outputSha256 }) => `${output}\t${outputSha256}`).join('\n'));
}

async function verifyPackageAt(packagePath, expectedPackageId) {
  const info = await lstat(packagePath);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new PublicationDataError('Package must be a real directory');
  const manifestPath = path.join(packagePath, 'manifest.json');
  await assertRegularNoLink(manifestPath, 'manifest.json');
  const manifest = parsePlainJson(await readFile(manifestPath), 'manifest.json');
  const diagnostics = [];
  if (manifest.manifestSchemaVersion !== MANIFEST_SCHEMA_VERSION) diagnostics.push(diagnostic('ERROR', 'MANIFEST_SCHEMA', 'manifest.json', 'manifestSchemaVersion', 'unexpected manifest schema version'));
  if (manifest.exporterVersion !== EXPORTER_VERSION) diagnostics.push(diagnostic('ERROR', 'EXPORTER_VERSION', 'manifest.json', 'exporterVersion', 'unexpected exporter version'));
  if (!nonempty(manifest.packageId) || (expectedPackageId && manifest.packageId !== expectedPackageId)) diagnostics.push(diagnostic('ERROR', 'PACKAGE_ID', 'manifest.json', 'packageId', 'package id mismatch'));
  if (manifest.complete !== true) diagnostics.push(diagnostic('ERROR', 'INCOMPLETE_PACKAGE', 'manifest.json', 'complete', 'package is not complete'));
  const expectedOutputs = EXPORT_ALLOWLIST.map(({ output }) => output);
  if (!Array.isArray(manifest.files) || manifest.files.length !== EXPORT_ALLOWLIST.length) diagnostics.push(diagnostic('ERROR', 'MANIFEST_FILES', 'manifest.json', 'files', 'manifest must contain exactly five file entries'));
  const entries = Array.isArray(manifest.files) ? manifest.files : [];
  entries.forEach((entry, index) => {
    const spec = EXPORT_ALLOWLIST[index];
    if (!plainObject(entry) || entry.source !== spec?.source || entry.output !== spec?.output || entry.collection !== spec?.collection) {
      diagnostics.push(diagnostic('ERROR', 'MANIFEST_ALLOWLIST', 'manifest.json', `files[${index}]`, 'manifest entry does not match exact allowlist order'));
      return;
    }
    const output = safeRelative(entry.output, 'manifest output');
    if (!expectedOutputs.includes(output)) diagnostics.push(diagnostic('ERROR', 'OUTPUT_NOT_ALLOWED', 'manifest.json', `files[${index}].output`, 'output is not allowlisted'));
  });
  const discovered = [];
  async function walk(dir, relative = '') {
    const { readdir } = await import('node:fs/promises');
    for (const child of await readdir(dir, { withFileTypes: true })) {
      const childRelative = slash(path.join(relative, child.name));
      const childPath = path.join(dir, child.name);
      const childInfo = await lstat(childPath);
      if (childInfo.isSymbolicLink()) diagnostics.push(diagnostic('ERROR', 'PACKAGE_LINK', childRelative, '', 'package contains a symlink/reparse point'));
      else if (childInfo.isDirectory()) await walk(childPath, childRelative);
      else if (childInfo.isFile()) discovered.push(childRelative);
      else diagnostics.push(diagnostic('ERROR', 'PACKAGE_SPECIAL_FILE', childRelative, '', 'package contains a non-regular file'));
    }
  }
  await walk(packagePath);
  const expectedFiles = [...expectedOutputs, 'manifest.json'].sort();
  if (JSON.stringify(discovered.sort()) !== JSON.stringify(expectedFiles)) diagnostics.push(diagnostic('ERROR', 'PACKAGE_FILE_SET', '', '', 'package file set differs from allowlist plus manifest'));
  for (const entry of entries) {
    if (!plainObject(entry) || !expectedOutputs.includes(entry.output)) continue;
    const outputPath = path.resolve(packagePath, entry.output);
    if (!isDescendant(packagePath, outputPath)) {
      diagnostics.push(diagnostic('ERROR', 'OUTPUT_ESCAPE', entry.output, '', 'output escapes package'));
      continue;
    }
    try {
      await assertRegularNoLink(outputPath, entry.output);
      const bytes = await readFile(outputPath);
      const data = parsePlainJson(bytes, entry.output);
      const serialized = Buffer.from(serializePublicationFile(data), 'utf8');
      if (!bytes.equals(serialized)) diagnostics.push(diagnostic('ERROR', 'NON_CANONICAL_SERIALIZATION', entry.output, '', 'output serialization is not canonical'));
      if (sha256(bytes) !== entry.outputSha256) diagnostics.push(diagnostic('ERROR', 'OUTPUT_HASH', entry.output, '', 'output hash mismatch'));
      const records = entry.collection === 'knowledgeGraph'
        ? Object.values(data.entities || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0)
        : Array.isArray(data[entry.collection]) ? data[entry.collection].length : -1;
      if (records !== entry.recordCount) diagnostics.push(diagnostic('ERROR', 'RECORD_COUNT', entry.output, '', 'record count mismatch'));
    } catch (error) {
      diagnostics.push(diagnostic('ERROR', 'OUTPUT_READ', entry.output, '', error.message));
    }
  }
  if (entries.length === EXPORT_ALLOWLIST.length) {
    if (aggregateSourceHash(entries) !== manifest.aggregateSourceHash) diagnostics.push(diagnostic('ERROR', 'SOURCE_SET_HASH', 'manifest.json', 'aggregateSourceHash', 'aggregate source hash mismatch'));
    if (aggregateOutputHash(entries) !== manifest.aggregateOutputSetHash) diagnostics.push(diagnostic('ERROR', 'OUTPUT_SET_HASH', 'manifest.json', 'aggregateOutputSetHash', 'aggregate output-set hash mismatch'));
    const packageId = sha256(`publication-data-exporter-v1\n${manifest.aggregateSourceHash}`).slice(0, 32);
    if (packageId !== manifest.packageId) diagnostics.push(diagnostic('ERROR', 'PACKAGE_ID_DERIVATION', 'manifest.json', 'packageId', 'package id is not derived from source hashes'));
  }
  assertNoErrors(diagnostics, 'Package verification failed');
  return { valid: true, packagePath, manifest, diagnostics };
}

export async function verifyStagedPackage({ repoRoot, packagePath, packageId }) {
  const root = await resolveRepo(repoRoot);
  const stagingRoot = path.join(root, STAGING_DIR);
  const resolved = path.resolve(packagePath);
  if (!isDescendant(stagingRoot, resolved) || !isDescendant(root, resolved)) throw new PublicationDataError('Package path is outside the allowed staging zone');
  await assertSafeExistingAncestors(root, resolved, true);
  const packageReal = await realpath(resolved);
  if (!isDescendant(stagingRoot, packageReal)) throw new PublicationDataError('Package real path escapes the allowed staging zone');
  return verifyPackageAt(packageReal, packageId);
}

export async function exportPublicationDataPackage({ repoRoot, runId } = {}) {
  const inspection = await inspectCanonicalPackage({ repoRoot });
  assertNoErrors(inspection.diagnostics, 'Canonical package validation failed');
  const entries = EXPORT_ALLOWLIST.map((spec) => {
    const file = inspection.files[spec.collection];
    const outputBytes = Buffer.from(serializePublicationFile(file.data), 'utf8');
    const recordCount = spec.collection === 'knowledgeGraph'
      ? Object.values(file.data.entities).reduce((sum, value) => sum + value.length, 0)
      : file.data[spec.collection].length;
    const warningCount = inspection.warnings.filter(({ file: warningFile }) => warningFile === spec.source).length;
    return { source: spec.source, output: spec.output, collection: spec.collection, sourceSha256: file.sha256, outputSha256: sha256(outputBytes), recordCount, warningCount, outputBytes };
  });
  const sourceSetHash = aggregateSourceHash(entries);
  const packageId = sha256(`publication-data-exporter-v1\n${sourceSetHash}`).slice(0, 32);
  const effectiveRunId = runId ?? packageId;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(effectiveRunId) || effectiveRunId === '.' || effectiveRunId === '..') throw new PublicationDataError('runId contains unsafe characters');
  const root = inspection.repoRoot;
  const stagingRoot = path.join(root, STAGING_DIR);
  const runRoot = path.join(stagingRoot, effectiveRunId);
  const finalPath = path.join(runRoot, packageId);
  const tempPath = path.join(runRoot, `.tmp-${packageId}-${process.pid}`);
  for (const candidate of [stagingRoot, runRoot, finalPath, tempPath]) {
    if (!isDescendant(root, candidate)) throw new PublicationDataError('Staging path must be a strict repository descendant');
  }
  await assertSafeExistingAncestors(root, runRoot);
  await mkdir(runRoot, { recursive: true });
  const stagingReal = await realpath(stagingRoot);
  const runReal = await realpath(runRoot);
  if (!isDescendant(root, stagingReal) || !isDescendant(stagingReal, runReal)) throw new PublicationDataError('Staging real path containment failed');
  try { await access(finalPath, fsConstants.F_OK); throw new PublicationDataError(`Final package already exists: ${slash(path.relative(root, finalPath))}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  let finalized = false;
  try {
    await mkdir(tempPath, { recursive: false });
    for (const entry of entries) {
      const destination = path.resolve(tempPath, safeRelative(entry.output, 'output'));
      if (!isDescendant(tempPath, destination) || entry.output.startsWith('dist/')) throw new PublicationDataError(`Unsafe output destination: ${entry.output}`);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entry.outputBytes, { flag: 'wx' });
    }
    const manifestEntries = entries.map(({ outputBytes, ...entry }) => entry);
    const manifest = orderedManifest({
      manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
      exporterVersion: EXPORTER_VERSION,
      packageId,
      files: manifestEntries,
      aggregateSourceHash: sourceSetHash,
      aggregateOutputSetHash: aggregateOutputHash(manifestEntries),
      warningCount: inspection.warnings.length,
      complete: true
    });
    await writeFile(path.join(tempPath, 'manifest.json'), serializePublicationFile(manifest), { flag: 'wx' });
    await verifyPackageAt(tempPath, packageId);
    await rename(tempPath, finalPath);
    finalized = true;
    const verified = await verifyStagedPackage({ repoRoot: root, packagePath: finalPath, packageId });
    return { packageId, packagePath: finalPath, manifest: verified.manifest, diagnostics: inspection.diagnostics };
  } catch (error) {
    await rm(tempPath, { recursive: true, force: true });
    if (finalized) await rm(finalPath, { recursive: true, force: true });
    try { const children = (await import('node:fs/promises')).readdir(runRoot); if ((await children).length === 0) await rm(runRoot); } catch {}
    throw error;
  }
}
