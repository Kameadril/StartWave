import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const here = new URL('./', import.meta.url);
const response = (rows, from, total) => ({ ok: true, headers: { get: (name) => name.toLowerCase() === 'content-range' ? `${from}-${from + rows.length - 1}/${total}` : null }, json: async () => rows });
const loadAdapter = async (fetch) => {
  const source = await readFile(new URL('bdo-live-data.js', here), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window, fetch, URL, Object, Map, Array, String, Number, Error });
  return window.StartWaveBdoData;
};

test('LIVE adapter preserves exact pine quantities, null outputs, and filters inputs', async () => {
  const rows = {
    recipes: [
      { id: 'SW-RECIPE-004', name: 'Фанера из сосны', method: 'Рубка', workplace: 'Меню обработки', result_item_id: 'SW-ITEM-044', result_quantity: null, status: 'curated' },
      { id: 'SW-RECIPE-023', name: 'Доски из сосны', method: 'Рубка', workplace: 'Меню обработки', result_item_id: 'SW-ITEM-150', result_quantity: null, status: 'curated' }
    ],
    recipe_inputs: [
      { recipe_id: 'SW-RECIPE-004', item_id: 'SW-ITEM-150', quantity: 10 },
      { recipe_id: 'SW-RECIPE-023', item_id: 'SW-ITEM-016', quantity: 5 }
    ]
  };
  const urls = [];
  const data = await loadAdapter(async (url) => { const parsed = new URL(url); urls.push(parsed); const table = parsed.pathname.split('/').pop(); return response(rows[table], 0, rows[table].length); });
  const recipes = await data.loadRecipes();
  assert.equal(recipes[0].materialQuantities['SW-ITEM-150'], 10);
  assert.equal(recipes[1].materialQuantities['SW-ITEM-016'], 5);
  assert.equal(recipes[0].resultQuantity, null);
  assert.equal(recipes[1].resultQuantity, null);
  assert.match(urls.find((url) => url.pathname.endsWith('/recipe_inputs')).searchParams.get('recipe_id'), /^in\.\(SW-RECIPE-004,SW-RECIPE-023\)$/);
});

test('pagination follows Content-Range beyond one page and memoizes', async () => {
  const all = Array.from({ length: 251 }, (_, index) => ({ id: `I-${index}`, name: `Item ${index}`, category: 'Материалы', item_type: 'Материал', status: 'curated' }));
  let calls = 0;
  const data = await loadAdapter(async (_url, options) => { calls += 1; const from = Number(options.headers.Range.split('-')[0]); const page = all.slice(from, from + 250); return response(page, from, all.length); });
  const [first, second] = await Promise.all([data.loadItems(), data.loadItems()]);
  assert.equal(first.length, 251); assert.equal(second, first); assert.equal(calls, 2);
});

test('a rejected memoized request is evicted and the next call retries', async () => {
  let calls = 0;
  const data = await loadAdapter(async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary failure');
    return response([{ id: 'SW-ITEM-150', name: 'Сосновая доска', category: 'Материалы', item_type: 'Материал', status: 'curated' }], 0, 1);
  });
  await assert.rejects(data.loadItems(), /temporary failure/);
  const items = await data.loadItems();
  assert.equal(items.length, 1);
  assert.equal(calls, 2);
});

test('missing Content-Range fails closed', async () => {
  const data = await loadAdapter(async () => ({ ok: true, headers: { get: () => null }, json: async () => [] }));
  await assert.rejects(data.loadItems(), { code: 'LIVE_DATA_INCOMPLETE_RESPONSE' });
});
