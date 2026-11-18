const results = document.getElementById('results');
const summary = document.getElementById('summary');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(actual === expected, `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const waitFor = async (predicate, message, timeout = 3000) => {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeout) throw new Error(`timeout: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const payload = '<img src=x onerror="globalThis.pwned=1">';

const items = [
  { id: 'SW-ITEM-016', name: 'Сосновое бревно', category: 'Материалы', itemType: 'Материал', status: 'curated' },
  { id: 'SW-ITEM-150', name: 'Сосновая доска', category: 'Материалы', itemType: 'Материал', status: 'curated' },
  { id: 'SW-ITEM-044', name: 'Фанера из сосны', category: 'Материалы', itemType: 'Материал', status: 'curated' }
];
const recipes = [
  { id: 'SW-RECIPE-004', name: 'Фанера из сосны', recipeType: 'Обработка', description: 'Второй этап', method: 'Рубка', workplace: 'Меню обработки', materialItemIds: ['SW-ITEM-150'], materialQuantities: { 'SW-ITEM-150': 10 }, resultItemId: 'SW-ITEM-044', resultQuantity: null, productionIds: [], status: 'curated' },
  { id: 'SW-RECIPE-023', name: 'Доски из сосны', recipeType: 'Обработка', description: 'Первый этап', method: 'Рубка', workplace: 'Меню обработки', materialItemIds: ['SW-ITEM-016'], materialQuantities: { 'SW-ITEM-016': 5 }, resultItemId: 'SW-ITEM-150', resultQuantity: null, productionIds: [], status: 'curated' }
];
const liveArchive = { items, recipes };

const skeletons = {
  production: `<base href="/production.html"><input id="productionArchiveSearch"><strong id="productionArchiveResultCount">Загрузка представлений…</strong><strong id="productionArchiveRelationCount">Загрузка связей…</strong><div id="bdoProductionGrid" aria-busy="true"></div><p id="productionArchiveEmptyState" hidden></p>`,
  recipes: `<base href="/recipes.html"><input id="recipeArchiveSearch"><strong id="recipeArchiveResultCount">Загрузка рецептов…</strong><strong id="recipeArchiveRelationCount"></strong><strong id="recipeArchiveModuleCount"></strong><div id="bdoRecipeGrid" aria-busy="true"></div><p id="recipeArchiveEmptyState" hidden></p>`,
  items: `<base href="/items.html"><input id="itemArchiveSearch"><button id="itemArchiveClear"></button><strong id="itemArchiveResultCount"></strong><strong id="itemArchiveTotalCount"></strong><strong id="itemArchiveRelationCount"></strong><strong id="itemArchiveModuleCount"></strong><div id="itemArchiveCategories"></div><div id="bdoItemGrid" aria-busy="true"></div><p id="itemArchiveEmptyState" hidden></p>`
};

const makeFrame = async (kind, { fetchImpl = fetch, data = null } = {}) => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(`<!doctype html><html><body>${skeletons[kind]}</body></html>`); doc.close();
  frame.contentWindow.fetch = fetchImpl;
  frame.contentWindow.BdoWorldRelations = { attach() {} };
  if (data) frame.contentWindow.StartWaveBdoData = data;
  const source = await fetch(`/assets/js/bdo-${kind === 'production' ? 'live-productions' : kind}.js`).then((response) => response.text());
  const script = doc.createElement('script'); script.textContent = source; doc.body.append(script);
  return { frame, window: frame.contentWindow, document: doc, dispose: () => frame.remove() };
};

const published = async () => {
  const [productions, staticItems, staticRecipes] = await Promise.all([
    fetch('/assets/data/bdo-productions.json').then((r) => r.json()),
    fetch('/assets/data/bdo-items.json').then((r) => r.json()),
    fetch('/assets/data/bdo-recipes.json').then((r) => r.json())
  ]);
  return { productions, staticItems, staticRecipes };
};

test('malicious LIVE fields render literally without DOM XSS', async () => {
  const hostileItems = items.map((item, index) => index ? item : { ...item, name: payload, category: payload, itemType: payload });
  const hostileRecipes = recipes.map((recipe, index) => index ? recipe : { ...recipe, name: payload, description: payload, method: payload, workplace: payload, status: payload });
  for (const [kind, data] of [
    ['recipes', { loadRecipeArchive: async () => ({ items: hostileItems, recipes: hostileRecipes }) }],
    ['items', { loadItems: async () => hostileItems, loadRecipes: async () => hostileRecipes }]
  ]) {
    const page = await makeFrame(kind, { data });
    await waitFor(() => page.document.querySelectorAll('article').length > 0, `${kind} rendered`);
    equal(page.document.querySelectorAll('img').length, 0, `${kind} created no img`);
    assert(page.document.body.textContent.includes(payload), `${kind} preserves literal payload`);
    equal(page.window.pwned, undefined, `${kind} executes no event handler`);
    page.dispose();
  }
});

test('production → recipe → item uses real clicks, HTTP 200, and target fragments', async () => {
  const staticData = await published();
  const production = await makeFrame('production', { data: { loadRecipeArchive: async () => liveArchive } });
  await waitFor(() => production.document.getElementById('pine-live-chain'), 'pine card');
  for (const route of ['/production.html', '/recipes.html', '/items.html']) equal((await fetch(route)).status, 200, `${route} HTTP status`);
  const recipeLink = production.document.querySelector('#pine-live-chain a[href="recipes.html#SW-RECIPE-023"]');
  assert(recipeLink, 'production recipe link exists');
  let clickedRecipe = false;
  recipeLink.addEventListener('click', (event) => { event.preventDefault(); clickedRecipe = true; });
  recipeLink.click(); assert(clickedRecipe, 'production recipe link click dispatched');
  const recipePage = await makeFrame('recipes', { data: { loadRecipeArchive: async () => liveArchive } });
  await waitFor(() => recipePage.document.getElementById('SW-RECIPE-023'), 'recipe target');
  const itemLink = recipePage.document.querySelector('#SW-RECIPE-023 a[href="items.html#SW-ITEM-150"]');
  assert(itemLink, 'recipe result item link exists');
  let clickedItem = false;
  itemLink.addEventListener('click', (event) => { event.preventDefault(); clickedItem = true; });
  itemLink.click(); assert(clickedItem, 'recipe item link click dispatched');
  const itemPage = await makeFrame('items', { data: { loadItems: async () => items, loadRecipes: async () => recipes } });
  await waitFor(() => itemPage.document.getElementById('SW-ITEM-150'), 'item target');
  production.dispose(); recipePage.dispose(); itemPage.dispose();
  assert(staticData.productions.productions.length === 13, 'publication fixture loaded during route test');
});

test('all 13 packing cards match built publication data', async () => {
  const data = await published();
  const page = await makeFrame('production', { data: { loadRecipeArchive: async () => { throw new Error('LIVE intentionally unavailable'); } } });
  await waitFor(() => page.document.querySelectorAll('[data-production-id]').length === 13, '13 publication cards');
  const itemById = new Map(data.staticItems.items.map((item) => [item.id, item]));
  const recipeById = new Map(data.staticRecipes.recipes.map((recipe) => [recipe.id, recipe]));
  for (const production of data.productions.productions) {
    const card = page.document.querySelector(`[data-production-id="${production.id}"]`);
    assert(card, `${production.id} card exists`);
    const ids = [...(production.preparationRecipeIds || []), ...(production.assemblyRecipeIds?.length ? production.assemblyRecipeIds : [production.assemblyRecipeId].filter(Boolean))];
    for (const id of ids) {
      const recipe = recipeById.get(id); assert(recipe, `${production.id} recipe ${id} exists`);
      for (const itemId of recipe.materialItemIds || []) {
        assert(card.textContent.includes(`${itemById.get(itemId)?.name || itemId} ×${recipe.materialQuantities[itemId]}`), `${production.id} material ${itemId}`);
      }
      const resultSuffix = recipe.resultQuantity == null ? 'выход переменный' : `×${recipe.resultQuantity}`;
      assert(card.textContent.includes(itemById.get(recipe.resultItemId)?.name || recipe.resultItemId), `${production.id} result ${recipe.resultItemId}`);
      assert(card.textContent.includes(resultSuffix), `${production.id} result quantity`);
    }
  }
  page.dispose();
});

test('partial failures keep static and LIVE domains independent', async () => {
  const liveOnly = await makeFrame('production', {
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    data: { loadRecipeArchive: async () => liveArchive }
  });
  await waitFor(() => liveOnly.document.getElementById('pine-live-chain'), 'LIVE-only pine card');
  equal(liveOnly.document.querySelectorAll('[data-production-id]').length, 0, 'LIVE-only has no static cards');
  assert(liveOnly.document.getElementById('productionArchiveResultCount').textContent.includes('сохранённые представления недоступны'), 'static failure warning');
  liveOnly.dispose();

  const staticOnly = await makeFrame('production', { data: { loadRecipeArchive: async () => { throw new Error('LIVE down'); } } });
  await waitFor(() => staticOnly.document.querySelectorAll('[data-production-id]').length === 13, 'static-only cards');
  assert(!staticOnly.document.getElementById('pine-live-chain'), 'static-only has no pine card');
  assert(staticOnly.document.getElementById('productionArchiveResultCount').textContent.includes('LIVE-рецепты недоступны'), 'LIVE failure warning');
  staticOnly.dispose();

  const itemPage = await makeFrame('items', { data: { loadItems: async () => items, loadRecipes: async () => { throw new Error('recipes down'); } } });
  await waitFor(() => itemPage.document.querySelectorAll('article').length === items.length, 'items survive recipe failure');
  assert(itemPage.document.getElementById('itemArchiveRelationCount').textContent.includes('временно недоступны'), 'item relation failure warning');
  itemPage.dispose();
});

test('loading, success, error, and pine contract drift are visible states', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const loading = await makeFrame('recipes', { data: { loadRecipeArchive: () => pending } });
  equal(loading.document.getElementById('recipeArchiveResultCount').textContent, 'Загрузка рецептов…', 'loading text before settlement');
  equal(loading.document.getElementById('bdoRecipeGrid').getAttribute('aria-busy'), 'true', 'loading aria-busy');
  release(liveArchive);
  await waitFor(() => loading.document.querySelectorAll('article').length === 2, 'recipe success');
  equal(loading.document.getElementById('bdoRecipeGrid').getAttribute('aria-busy'), 'false', 'success aria-busy');
  loading.dispose();

  const errorPage = await makeFrame('recipes', { data: { loadRecipeArchive: async () => { throw new Error('offline'); } } });
  await waitFor(() => errorPage.document.getElementById('recipeArchiveResultCount').textContent === 'Ошибка загрузки', 'recipe error');
  equal(errorPage.document.getElementById('bdoRecipeGrid').getAttribute('aria-busy'), 'false', 'error aria-busy');
  errorPage.dispose();

  const drifted = structuredClone(liveArchive);
  drifted.recipes.find((recipe) => recipe.id === 'SW-RECIPE-023').materialQuantities['SW-ITEM-016'] = 6;
  const driftPage = await makeFrame('production', { data: { loadRecipeArchive: async () => drifted } });
  await waitFor(() => driftPage.document.querySelectorAll('[data-production-id]').length === 13, 'drift static cards');
  assert(!driftPage.document.getElementById('pine-live-chain'), 'drift suppresses pine card');
  assert(driftPage.document.getElementById('productionArchiveResultCount').textContent.includes('LIVE pine-контракт не подтверждён'), 'drift warning');
  driftPage.dispose();
});

test('pine contract, exact search, and item relations render in DOM', async () => {
  const production = await makeFrame('production', { data: { loadRecipeArchive: async () => liveArchive } });
  await waitFor(() => production.document.getElementById('pine-live-chain'), 'pine card');
  const pineText = production.document.getElementById('pine-live-chain').textContent;
  for (const token of ['Сосновое бревно ×5', 'Сосновая доска ×10', 'Фанера из сосны', 'выход переменный', 'Рубка · Меню обработки']) assert(pineText.includes(token), `pine DOM contains ${token}`);

  const recipePage = await makeFrame('recipes', { data: { loadRecipeArchive: async () => liveArchive } });
  await waitFor(() => recipePage.document.querySelectorAll('article').length === 2, 'recipes rendered');
  const search = recipePage.document.getElementById('recipeArchiveSearch'); search.value = 'SW-ITEM-150'; search.dispatchEvent(new Event('input'));
  const recipeIds = [...recipePage.document.querySelectorAll('[data-recipe-id]')].map((node) => node.dataset.recipeId).sort();
  equal(recipeIds.join(','), 'SW-RECIPE-004,SW-RECIPE-023', 'exact SW-ITEM-150 result IDs');
  equal(recipePage.document.getElementById('recipeArchiveResultCount').textContent, '2 из 2 рецептов', 'exact search count');

  const itemPage = await makeFrame('items', { data: { loadItems: async () => items, loadRecipes: async () => recipes } });
  await waitFor(() => itemPage.document.getElementById('SW-ITEM-150'), 'SW-ITEM-150 item card');
  const relationText = itemPage.document.getElementById('SW-ITEM-150').textContent;
  assert(relationText.includes('Производится по') && relationText.includes('SW-RECIPE-023'), 'item produced-by relation');
  assert(relationText.includes('Используется в') && relationText.includes('SW-RECIPE-004'), 'item used-in relation');
  production.dispose(); recipePage.dispose(); itemPage.dispose();
});

let failures = 0;
for (const entry of tests) {
  const row = document.createElement('li'); results.append(row);
  try {
    await entry.run(); row.className = 'pass'; row.textContent = `PASS — ${entry.name}`;
  } catch (error) {
    failures += 1; row.className = 'fail'; row.textContent = `FAIL — ${entry.name}: ${error.stack || error}`;
  }
}
summary.textContent = failures ? `FAIL: ${failures}/${tests.length}` : `PASS: ${tests.length}/${tests.length}`;
summary.className = failures ? 'fail' : 'pass';
document.documentElement.dataset.testStatus = failures ? 'fail' : 'pass';
