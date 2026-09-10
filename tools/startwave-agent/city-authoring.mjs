import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cityId } from '../../GAMES/bdo/tools/atlas-agent/city-id.mjs';

export const CITY_CONTRACT_VERSION = 1;
export const CITY_PATH = 'GAMES/bdo/atlas/data/bdo-cities.json';
export const REGION_PATH = 'GAMES/bdo/atlas/data/bdo-regions.json';
export const OWNER_SOURCE = 'owner:city-intake-v1';
const CONFIRMATION = 'Подтверждаю';
const STATUSES = new Set(['unresearched', 'researching', 'verified']);
const response = (status, extra = {}) => ({ status, modelCalls: 0, ...extra });
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const fileHash = (file) => sha256(fs.readFileSync(file));
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function parseFacts(message) {
  if (message && typeof message === 'object' && !Array.isArray(message)) return { ...message };
  const keys = new Map([['name', 'name'], ['название', 'name'], ['имя', 'name'], ['region', 'region'], ['регион', 'region'], ['citytype', 'cityType'], ['city type', 'cityType'], ['тип', 'cityType'], ['тип города', 'cityType'], ['description', 'description'], ['описание', 'description'], ['status', 'status'], ['статус', 'status']]);
  const facts = {};
  for (const line of String(message ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/);
    const key = match && keys.get(normalize(match[1]).toLowerCase());
    if (key) facts[key] = normalize(match[2]);
  }
  return facts;
}
function load(root) {
  const cityFile = path.resolve(root, CITY_PATH), regionFile = path.resolve(root, REGION_PATH);
  const cityBytes = fs.readFileSync(cityFile), regionBytes = fs.readFileSync(regionFile);
  return { cityFile, regionFile, cityBytes, regionBytes, cities: JSON.parse(cityBytes), regions: JSON.parse(regionBytes) };
}
const fingerprintData = (preview) => ({ contractVersion: preview.contractVersion, city: preview.city, regionChange: preview.regionChange, writeSet: preview.writeSet, preWriteHashes: preview.preWriteHashes });

export function previewCityCreation({ root, message, intakeDate }) {
  const facts = parseFacts(message);
  const missing = ['name', 'region', 'cityType', 'description'].filter((key) => !normalize(facts[key]));
  if (missing.length) return response('NEEDS_INPUT', { missing });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(intakeDate ?? '') || Number.isNaN(Date.parse(`${intakeDate}T00:00:00Z`))) return response('NEEDS_INPUT', { missing: ['intakeDate'] });
  const docs = load(root);
  const regions = docs.regions.regions.filter((region) => normalize(region.name) === normalize(facts.region));
  if (!regions.length) return response('NOT_FOUND', { entity: 'Region', value: facts.region });
  if (regions.length !== 1) return response('NEEDS_INPUT', { reason: 'AMBIGUOUS_REGION', matches: regions.map(({ id }) => id) });
  const region = regions[0], id = cityId(facts.name).cityId;
  const conflicts = docs.cities.cities.filter((city) => city.id === id || normalize(city.name) === normalize(facts.name) || (Object.hasOwn(docs.cities.entitySchema ?? {}, 'aliases') && (city.aliases ?? []).some((alias) => normalize(alias) === normalize(facts.name))));
  if (conflicts.length) return response('EXISTS', { id, conflicts: [...new Set(conflicts.map(({ id: conflictId }) => conflictId))] });
  const status = facts.status || 'unresearched';
  if (!STATUSES.has(status)) return response('NEEDS_INPUT', { reason: 'INVALID_STATUS', allowed: [...STATUSES] });
  if (status !== 'unresearched' && !facts.statusEvidence) return response('NEEDS_INPUT', { reason: 'STRONGER_STATUS_REQUIRES_EVIDENCE' });
  const city = { id, name: normalize(facts.name), region: region.name, cityType: normalize(facts.cityType), description: normalize(facts.description), nodes: [], resources: [], production: [], trade: [], images: [], coordinates: null, source: [OWNER_SOURCE], checkedAt: intakeDate, status, relations: { mapPoints: [], playerJourneySteps: [] } };
  const nextCities = clone(docs.cities); nextCities.cities.push(city);
  const nextRegions = clone(docs.regions), nextRegion = nextRegions.regions.find(({ id: regionId }) => regionId === region.id);
  nextRegion.relations ??= {}; nextRegion.relations.cities ??= [];
  if (!nextRegion.relations.cities.includes(id)) nextRegion.relations.cities.push(id);
  const preview = response('PREVIEW', { contractVersion: CITY_CONTRACT_VERSION, city, regionChange: { regionId: region.id, regionName: region.name, addCityId: id }, writeSet: [CITY_PATH, REGION_PATH], operationalArtifacts: '.startwave-agent/backups/city-authoring/<fingerprint> and same-directory temporary files', preWriteHashes: { [CITY_PATH]: sha256(docs.cityBytes), [REGION_PATH]: sha256(docs.regionBytes) }, resultingHashes: { [CITY_PATH]: sha256(jsonBytes(nextCities)), [REGION_PATH]: sha256(jsonBytes(nextRegions)) } });
  preview.fingerprint = sha256(stable(fingerprintData(preview)));
  return preview;
}

function validPreview(preview) { return preview?.status === 'PREVIEW' && preview.contractVersion === CITY_CONTRACT_VERSION && sha256(stable(fingerprintData(preview))) === preview.fingerprint; }
export function applyCityPreview({ root, message, preview, injectFailureAfterCity = false }) {
  if (normalize(message) !== CONFIRMATION) return response('CONFIRMATION_REQUIRED');
  if (!validPreview(preview)) return response('INVALID_PREVIEW');
  const docs = load(root);
  if (fileHash(docs.cityFile) !== preview.preWriteHashes[CITY_PATH] || fileHash(docs.regionFile) !== preview.preWriteHashes[REGION_PATH]) return response('STALE_PREVIEW');
  if (docs.cities.cities.some((city) => city.id === preview.city.id || normalize(city.name) === normalize(preview.city.name))) return response('EXISTS', { id: preview.city.id });
  const regionMatches = docs.regions.regions.filter((region) => region.id === preview.regionChange.regionId && region.name === preview.regionChange.regionName);
  if (regionMatches.length !== 1) return response('STALE_PREVIEW');
  const nextCities = clone(docs.cities); nextCities.cities.push(preview.city);
  const nextRegions = clone(docs.regions), region = nextRegions.regions.find(({ id }) => id === preview.regionChange.regionId);
  region.relations ??= {}; region.relations.cities ??= [];
  if (region.relations.cities.includes(preview.city.id)) return response('EXISTS', { id: preview.city.id });
  region.relations.cities.push(preview.city.id);
  const cityNext = jsonBytes(nextCities), regionNext = jsonBytes(nextRegions);
  if (sha256(cityNext) !== preview.resultingHashes[CITY_PATH] || sha256(regionNext) !== preview.resultingHashes[REGION_PATH]) return response('INVALID_PREVIEW');
  const backupDir = path.join(root, '.startwave-agent', 'backups', 'city-authoring', preview.fingerprint);
  const cityTemp = `${docs.cityFile}.${preview.fingerprint}.tmp`, regionTemp = `${docs.regionFile}.${preview.fingerprint}.tmp`;
  const cityRollback = `${docs.cityFile}.${preview.fingerprint}.rollback`, regionRollback = `${docs.regionFile}.${preview.fingerprint}.rollback`;
  if (fs.existsSync(backupDir) || [cityTemp, regionTemp, cityRollback, regionRollback].some((file) => fs.existsSync(file))) return response('REPLAY_BLOCKED');
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(docs.cityFile, path.join(backupDir, path.basename(docs.cityFile)), fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(docs.regionFile, path.join(backupDir, path.basename(docs.regionFile)), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(cityTemp, cityNext, { flag: 'wx' }); fs.writeFileSync(regionTemp, regionNext, { flag: 'wx' });
  let cityMoved = false, cityInstalled = false, regionMoved = false, regionInstalled = false;
  try {
    fs.renameSync(docs.cityFile, cityRollback); cityMoved = true; fs.renameSync(cityTemp, docs.cityFile); cityInstalled = true;
    if (injectFailureAfterCity) throw new Error('INJECTED_PARTIAL_FAILURE');
    fs.renameSync(docs.regionFile, regionRollback); regionMoved = true; fs.renameSync(regionTemp, docs.regionFile); regionInstalled = true;
    const post = load(root), reciprocal = post.regions.regions.find(({ id }) => id === preview.regionChange.regionId)?.relations?.cities?.includes(preview.city.id);
    if (!post.cities.cities.some(({ id }) => id === preview.city.id) || !reciprocal || fileHash(post.cityFile) !== preview.resultingHashes[CITY_PATH] || fileHash(post.regionFile) !== preview.resultingHashes[REGION_PATH]) throw new Error('POST_VERIFY_FAILED');
    fs.unlinkSync(cityRollback); fs.unlinkSync(regionRollback);
    return response('APPLIED', { fingerprint: preview.fingerprint, writeSet: preview.writeSet, backupDir: path.relative(root, backupDir).replaceAll('\\', '/') });
  } catch (error) {
    try { if (cityInstalled && fs.existsSync(docs.cityFile)) fs.unlinkSync(docs.cityFile); } catch {}
    try { if (cityMoved && fs.existsSync(cityRollback)) fs.renameSync(cityRollback, docs.cityFile); } catch {}
    try { if (regionInstalled && fs.existsSync(docs.regionFile)) fs.unlinkSync(docs.regionFile); } catch {}
    try { if (regionMoved && fs.existsSync(regionRollback)) fs.renameSync(regionRollback, docs.regionFile); } catch {}
    for (const file of [cityTemp, regionTemp]) try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    return response('ROLLED_BACK', { error: error.message });
  }
}
export function routeCityAuthoring({ root, message, preview, intakeDate }) { return normalize(message) === CONFIRMATION ? applyCityPreview({ root, message, preview }) : previewCityCreation({ root, message, intakeDate }); }
export const internals = { parseFacts, stable, validPreview, sha256 };
