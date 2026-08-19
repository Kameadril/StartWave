import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..', '..');
const configPath = path.join(toolDir, 'atlas-agent.config.json');
const mode = process.argv[2];

if (!['validate', 'report'].includes(mode) || process.argv.length !== 3) {
  console.error('Usage: node tools/atlas-agent/agent.mjs <validate|report>');
  process.exit(2);
}

function insideRoot(candidate) {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes project root: ${candidate}`);
  }
  return resolved;
}

const findings = [];
const add = (level, code, file, location, message) => findings.push({ level, code, file, location, message });
let config;
try {
  config = JSON.parse(fs.readFileSync(insideRoot(configPath), 'utf8'));
} catch (error) {
  console.error(`ERROR CONFIG: ${error.message}`);
  process.exit(2);
}

const atlasDir = insideRoot(config.atlasDirectory);
const documents = new Map();
const checkedFiles = [];

for (const [file, collection] of Object.entries(config.files)) {
  const fullPath = insideRoot(path.join(config.atlasDirectory, file));
  checkedFiles.push(path.relative(root, fullPath).replaceAll('\\', '/'));
  let value;
  try {
    value = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    add('ERROR', 'JSON_INVALID', file, '$', error.message);
    continue;
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    add('ERROR', 'TOP_LEVEL_INVALID', file, '$', 'Top-level JSON value must be an object.');
    continue;
  }
  documents.set(file, value);
  for (const field of ['schemaVersion', 'collectionId', 'updatedAt']) {
    if (!(field in value)) add('ERROR', 'TOP_LEVEL_REQUIRED', file, '$', `Missing top-level field ${field}.`);
  }
  if (collection !== null && !Array.isArray(value[collection])) {
    add('ERROR', 'COLLECTION_INVALID', file, `$.${collection}`, 'Expected an array.');
  }
}

const collections = {};
for (const [file, collection] of Object.entries(config.files)) {
  if (collection && documents.has(file) && Array.isArray(documents.get(file)[collection])) collections[collection] = documents.get(file)[collection];
}

for (const layer of config.emptyLayers) {
  for (const [file, document] of documents) {
    if (Array.isArray(document[layer]) && document[layer].length === 0) add('INFO', 'EMPTY_LAYER', file, `$.${layer}`, `Layer ${layer} is empty.`);
  }
}

const indexes = {};
const globalIds = new Map();
for (const [name, records] of Object.entries(collections)) {
  indexes[name] = new Map();
  records.forEach((record, index) => {
    const loc = `$.${name}[${index}]`;
    if (!record || Array.isArray(record) || typeof record !== 'object') {
      add('ERROR', 'ENTITY_INVALID', Object.entries(config.files).find(([, c]) => c === name)?.[0] ?? name, loc, 'Entity must be an object.');
      return;
    }
    for (const field of config.requiredFields[name] ?? []) {
      if (!(field in record) || record[field] === null || record[field] === '') add('ERROR', 'FIELD_REQUIRED', name, loc, `Missing required field ${field}.`);
    }
    if (typeof record.id === 'string') {
      if (indexes[name].has(record.id)) add('ERROR', 'ID_DUPLICATE', name, `${loc}.id`, `Duplicate ID ${record.id}.`);
      indexes[name].set(record.id, record);
      if (globalIds.has(record.id)) add('ERROR', 'ID_DUPLICATE_GLOBAL', name, `${loc}.id`, `ID ${record.id} also occurs in ${globalIds.get(record.id)}.`);
      else globalIds.set(record.id, name);
      const pattern = config.idPatterns[name];
      if (pattern && !new RegExp(pattern).test(record.id)) add('ERROR', 'ID_FORMAT', name, `${loc}.id`, `Invalid ${name} ID ${record.id}.`);
    }
    checkDatesAndStatuses(record, name, loc);
  });
}

function checkDatesAndStatuses(record, file, loc) {
  for (const [key, value] of Object.entries(record)) {
    if ((key === 'checkedAt' || key === 'updatedAt') && value != null) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) add('ERROR', 'DATE_INVALID', file, `${loc}.${key}`, `Invalid ISO date ${String(value)}.`);
    }
    if (key === 'status' && typeof value === 'string' && !config.allowedStatuses.includes(value)) add('WARNING', 'STATUS_UNKNOWN', file, `${loc}.status`, `Unrecognized status ${value}.`);
    if (value && typeof value === 'object' && !Array.isArray(value)) checkDatesAndStatuses(value, file, `${loc}.${key}`);
  }
}

function strictRefs(records, field, target, owner) {
  records.forEach((record, i) => {
    const values = Array.isArray(record[field]) ? record[field] : record[field] == null ? [] : [record[field]];
    values.forEach((id, j) => {
      if (typeof id !== 'string') return add('ERROR', 'REFERENCE_TYPE', owner, `$.${owner}[${i}].${field}[${j}]`, 'Reference must be a string.');
      if (!indexes[target]?.has(id)) add('ERROR', 'REFERENCE_MISSING', owner, `$.${owner}[${i}].${field}[${j}]`, `${field} references missing ${target} ID ${id}.`);
    });
  });
}

strictRefs(collections.items ?? [], 'relatedItemIds', 'items', 'items');
strictRefs(collections.recipes ?? [], 'materialItemIds', 'items', 'recipes');
strictRefs(collections.recipes ?? [], 'resultItemId', 'items', 'recipes');
strictRefs(collections.recipes ?? [], 'productionIds', 'productions', 'recipes');
for (const field of ['inputItemIds', 'outputItemIds', 'chainItemIds']) strictRefs(collections.productions ?? [], field, 'items', 'productions');
for (const field of ['preparationRecipeIds', 'assemblyRecipeId']) strictRefs(collections.productions ?? [], field, 'recipes', 'productions');
for (const field of ['items', 'recipes', 'productions']) strictRefs((collections.resources ?? []).map(r => ({ ...r, [field]: r.relations?.[field] ?? [] })), field, field, 'resources');

function warnLegacy(records, field, canonicalPattern, owner) {
  records.forEach((record, i) => (record[field] ?? []).forEach((id, j) => {
    if (typeof id === 'string' && !canonicalPattern.test(id)) add('WARNING', 'REFERENCE_NONCANONICAL', owner, `$.${owner}[${i}].${field}[${j}]`, `Non-canonical reference ${id}; verify whether this is an intentional legacy ID.`);
  }));
}
warnLegacy(collections.items ?? [], 'resources', /^bdo-resource-/i, 'items');
warnLegacy(collections.items ?? [], 'productions', /^SW-PROD-/i, 'items');
warnLegacy(collections.items ?? [], 'recipes', /^SW-RECIPE-/i, 'items');
warnLegacy(collections.items ?? [], 'cities', /^bdo-city-/i, 'items');
warnLegacy(collections.productions ?? [], 'cities', /^bdo-city-/i, 'productions');
warnLegacy(collections.productions ?? [], 'recipes', /^SW-RECIPE-/i, 'productions');

for (const item of collections.items ?? []) for (const otherId of item.relatedItemIds ?? []) {
  const other = indexes.items?.get(otherId);
  if (other && !(other.relatedItemIds ?? []).includes(item.id)) add('WARNING', 'RELATION_ASYMMETRIC', 'items', item.id, `${item.id} links to ${otherId}, but the reverse relatedItemIds link is absent.`);
}

for (const recipe of collections.recipes ?? []) for (const productionId of recipe.productionIds ?? []) {
  const production = indexes.productions?.get(productionId);
  if (!production) continue;
  const recipeIds = [...(production.preparationRecipeIds ?? []), production.assemblyRecipeId].filter(Boolean);
  if (!recipeIds.includes(recipe.id)) add('WARNING', 'RECIPE_PRODUCTION_ASYMMETRIC', 'recipes', recipe.id, `${recipe.id} references ${productionId}, but its canonical recipe fields do not link back.`);
  const recipeInputs = new Set(recipe.materialItemIds ?? []), productionInputs = new Set(production.inputItemIds ?? []);
  if (![...recipeInputs].every(id => productionInputs.has(id))) add('WARNING', 'RECIPE_PRODUCTION_INPUT_MISMATCH', 'recipes', recipe.id, `Recipe inputs are not all present in ${productionId}.inputItemIds.`);
  if (!(production.outputItemIds ?? []).includes(recipe.resultItemId)) add('WARNING', 'RECIPE_PRODUCTION_OUTPUT_MISMATCH', 'recipes', recipe.id, `${recipe.resultItemId} is absent from ${productionId}.outputItemIds.`);
}

for (const production of collections.productions ?? []) {
  const expected = new Set([...(production.inputItemIds ?? []), ...(production.outputItemIds ?? [])]);
  for (const id of expected) if (!(production.chainItemIds ?? []).includes(id)) add('WARNING', 'PRODUCTION_CHAIN_INCOMPLETE', 'productions', production.id, `${id} is absent from chainItemIds.`);
}

findings.sort((a, b) => ['ERROR', 'WARNING', 'INFO'].indexOf(a.level) - ['ERROR', 'WARNING', 'INFO'].indexOf(b.level) || a.file.localeCompare(b.file) || a.location.localeCompare(b.location));
const counts = Object.fromEntries(['ERROR', 'WARNING', 'INFO'].map(level => [level, findings.filter(x => x.level === level).length]));
const exitCode = counts.ERROR > 0 ? 1 : 0;

for (const finding of findings) console.log(`${finding.level} ${finding.code} ${finding.file} ${finding.location}: ${finding.message}`);
console.log(`SUMMARY files=${checkedFiles.length} errors=${counts.ERROR} warnings=${counts.WARNING} info=${counts.INFO} exitCode=${exitCode}`);

if (mode === 'report') {
  const reportDir = insideRoot(config.reportDirectory);
  fs.mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const report = { timestamp, mode, projectRoot: '.', checkedFiles, findings, summary: { ...counts, exitCode } };
  const filename = `atlas-report-${timestamp.replaceAll(':', '-')}.json`;
  const reportPath = insideRoot(path.join(config.reportDirectory, filename));
  if (fs.existsSync(reportPath)) throw new Error(`Refusing to overwrite existing report: ${filename}`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'w' });
  console.log(`REPORT ${path.posix.join(config.reportDirectory, filename)}`);
}
process.exit(exitCode);
