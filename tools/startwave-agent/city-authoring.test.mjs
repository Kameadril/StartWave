import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyCityPreview, previewCityCreation, routeCityAuthoring } from './city-authoring.mjs';

const CITY = 'GAMES/bdo/atlas/data/bdo-cities.json';
const REGION = 'GAMES/bdo/atlas/data/bdo-regions.json';
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureParent = path.join(process.cwd(), '.startwave-agent', 'tmp');
const fixtureRoots = [];
process.on('exit', () => { for (const root of fixtureRoots) fs.rmSync(root, { recursive: true, force: true }); });
function prompt(overrides = {}) {
  const facts = { name: 'Лаграс', region: 'Баленос', cityType: 'Поселение', description: 'Лаграс — владельческое поселение.', ...overrides };
  return `Создай город\nНазвание: ${facts.name ?? ''}\nРегион: ${facts.region ?? ''}\nТип города: ${facts.cityType ?? ''}\nОписание: ${facts.description ?? ''}`;
}
function fixture({ duplicate = false, ambiguous = false } = {}) {
  fs.mkdirSync(fixtureParent, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureParent, 'city-contract-'));
  fixtureRoots.push(root);
  const data = path.join(root, 'GAMES/bdo/atlas/data');
  fs.mkdirSync(data, { recursive: true });
  const cities = { schemaVersion: '0.1.0', collectionId: 'bdo-city-atlas', updatedAt: '2026-09-05', entitySchema: { id: 'string', name: 'string' }, cities: duplicate ? [{ id: 'bdo-city-lagras', name: 'Лаграс' }] : [] };
  const regions = { schemaVersion: '0.1.0', collectionId: 'bdo-regions', updatedAt: '2026-09-05', regions: [{ id: 'BDO-REGION-balenos', name: 'Баленос', relations: { nodes: [] } }, ...(ambiguous ? [{ id: 'BDO-REGION-balenos-2', name: 'Баленос', relations: {} }] : [])] };
  fs.writeFileSync(path.join(root, CITY), `${JSON.stringify(cities, null, 2)}\n`);
  fs.writeFileSync(path.join(root, REGION), `${JSON.stringify(regions, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'sentinel.txt'), 'unchanged');
  return root;
}

test('generic creation reaches PREVIEW with city-only ID and canonical fields', () => {
  const root = fixture(), before = [hash(path.join(root, CITY)), hash(path.join(root, REGION))];
  const preview = routeCityAuthoring({ root, message: prompt(), intakeDate: '2026-09-05' });
  assert.equal(preview.status, 'PREVIEW');
  assert.equal(preview.city.id, 'bdo-city-lagras');
  assert.ok(!preview.city.id.includes('balenos'));
  assert.deepEqual(Object.keys(preview.city), ['id', 'name', 'region', 'cityType', 'description', 'nodes', 'resources', 'production', 'trade', 'images', 'coordinates', 'source', 'checkedAt', 'status', 'relations']);
  for (const forbidden of ['names', 'regionId', 'entityType', 'provenance']) assert.ok(!(forbidden in preview.city));
  assert.equal(preview.modelCalls, 0);
  assert.deepEqual([hash(path.join(root, CITY)), hash(path.join(root, REGION))], before);
});

test('missing/unknown/ambiguous region and missing owner facts block', () => {
  const root = fixture();
  assert.equal(previewCityCreation({ root, message: prompt({ region: '' }), intakeDate: '2026-09-05' }).status, 'NEEDS_INPUT');
  assert.equal(previewCityCreation({ root, message: prompt({ region: 'Неизвестно' }), intakeDate: '2026-09-05' }).status, 'NOT_FOUND');
  assert.equal(previewCityCreation({ root: fixture({ ambiguous: true }), message: prompt(), intakeDate: '2026-09-05' }).status, 'NEEDS_INPUT');
  assert.equal(previewCityCreation({ root, message: prompt({ cityType: '' }), intakeDate: '2026-09-05' }).status, 'NEEDS_INPUT');
  assert.equal(previewCityCreation({ root, message: prompt({ description: '' }), intakeDate: '2026-09-05' }).status, 'NEEDS_INPUT');
});

test('duplicate ID or canonical name blocks', () => {
  assert.equal(previewCityCreation({ root: fixture({ duplicate: true }), message: prompt(), intakeDate: '2026-09-05' }).status, 'EXISTS');
});

test('wrong confirmation and stale preview write nothing', () => {
  const root = fixture(), preview = previewCityCreation({ root, message: prompt(), intakeDate: '2026-09-05' });
  const before = hash(path.join(root, CITY));
  assert.equal(applyCityPreview({ root, message: 'да', preview }).status, 'CONFIRMATION_REQUIRED');
  assert.equal(hash(path.join(root, CITY)), before);
  fs.appendFileSync(path.join(root, REGION), ' ');
  const stale = [hash(path.join(root, CITY)), hash(path.join(root, REGION))];
  assert.equal(applyCityPreview({ root, message: 'Подтверждаю', preview }).status, 'STALE_PREVIEW');
  assert.deepEqual([hash(path.join(root, CITY)), hash(path.join(root, REGION))], stale);
});

test('confirmation changes City+Region, verifies reciprocal relation, and blocks replay', () => {
  const root = fixture(), preview = previewCityCreation({ root, message: prompt(), intakeDate: '2026-09-05' }), sentinel = hash(path.join(root, 'sentinel.txt'));
  const applied = applyCityPreview({ root, message: 'Подтверждаю', preview });
  assert.equal(applied.status, 'APPLIED');
  const cities = JSON.parse(fs.readFileSync(path.join(root, CITY))), regions = JSON.parse(fs.readFileSync(path.join(root, REGION)));
  assert.equal(cities.cities.filter(({ id }) => id === 'bdo-city-lagras').length, 1);
  assert.ok(regions.regions[0].relations.cities.includes('bdo-city-lagras'));
  assert.equal(hash(path.join(root, 'sentinel.txt')), sentinel);
  assert.equal(applied.modelCalls, 0);
  assert.equal(applyCityPreview({ root, message: 'Подтверждаю', preview }).status, 'STALE_PREVIEW');
});

test('partial failure rolls both canonical fixture files back', () => {
  const root = fixture(), preview = previewCityCreation({ root, message: prompt(), intakeDate: '2026-09-05' });
  const before = [hash(path.join(root, CITY)), hash(path.join(root, REGION))];
  assert.equal(applyCityPreview({ root, message: 'Подтверждаю', preview, injectFailureAfterCity: true }).status, 'ROLLED_BACK');
  assert.deepEqual([hash(path.join(root, CITY)), hash(path.join(root, REGION))], before);
});
