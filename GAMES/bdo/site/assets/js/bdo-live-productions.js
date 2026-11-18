(() => {
  const grid = document.getElementById('bdoProductionGrid');
  const search = document.getElementById('productionArchiveSearch');
  const count = document.getElementById('productionArchiveResultCount');
  const relationCount = document.getElementById('productionArchiveRelationCount');
  const empty = document.getElementById('productionArchiveEmptyState');
  if (!grid || !search || !count || !empty) return;

  const list = (value) => Array.isArray(value) ? value : [];
  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  });
  const itemLink = (item, id) => {
    const link = document.createElement('a');
    link.href = `items.html#${encodeURIComponent(id)}`;
    link.textContent = item?.name || id;
    return link;
  };

  const recipeOperation = (recipe, itemsById) => {
    const operation = document.createElement('div');
    operation.className = 'bdo-production-operation';
    const materials = document.createElement('div');
    materials.className = 'bdo-production-operation__materials';
    list(recipe.materialItemIds).forEach((id, index) => {
      if (index) materials.append(' + ');
      const link = itemLink(itemsById.get(id), id);
      const quantity = recipe.materialQuantities?.[id];
      if (quantity != null) link.append(` ×${quantity}`);
      materials.append(link);
    });
    const method = document.createElement('span');
    method.className = 'bdo-production-operation__method';
    method.textContent = `${recipe.method}${recipe.workplace ? ` · ${recipe.workplace}` : ''}`;
    const result = document.createElement('div');
    result.className = 'bdo-production-operation__result';
    const output = itemLink(itemsById.get(recipe.resultItemId), recipe.resultItemId);
    output.append(recipe.resultQuantity == null ? ' · выход переменный' : ` ×${recipe.resultQuantity}`);
    result.append(output);
    operation.append(materials, method, result);
    return operation;
  };

  const createProductionCard = (production, itemsById, recipesById) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    article.id = production.id;
    article.dataset.productionId = production.id;
    const header = document.createElement('header');
    header.className = 'bdo-resource-record__header';
    const glyph = document.createElement('span'); glyph.className = 'bdo-resource-record__glyph'; glyph.setAttribute('aria-hidden', 'true'); glyph.textContent = '⚒';
    const heading = document.createElement('div'); const eyebrow = document.createElement('p'); eyebrow.className = 'bdo-resource-record__eyebrow'; eyebrow.textContent = 'Production chain';
    const title = document.createElement('h3'); title.textContent = production.name; heading.append(eyebrow, title);
    const status = document.createElement('span'); status.className = 'bdo-resource-record__status'; status.textContent = production.status || '';
    header.append(glyph, heading, status);
    const description = document.createElement('p'); description.textContent = production.description;
    const flow = document.createElement('div'); flow.className = 'bdo-production-flow';
    const preparation = document.createElement('section'); preparation.className = 'bdo-production-phase bdo-production-phase--preparation';
    const preparationLabel = document.createElement('p'); preparationLabel.className = 'bdo-production-phase__label'; preparationLabel.textContent = 'Подготовка и обработка материалов'; preparation.append(preparationLabel);
    list(production.preparationRecipeIds).forEach((id) => { const recipe = recipesById.get(id); if (recipe) preparation.append(recipeOperation(recipe, itemsById)); });
    const assembly = document.createElement('section'); assembly.className = 'bdo-production-phase bdo-production-phase--assembly';
    const assemblyLabel = document.createElement('p'); assemblyLabel.className = 'bdo-production-phase__label'; assemblyLabel.textContent = 'Финальная сборка'; assembly.append(assemblyLabel);
    const assemblyIds = list(production.assemblyRecipeIds).length ? production.assemblyRecipeIds : [production.assemblyRecipeId].filter(Boolean);
    assemblyIds.forEach((id) => { const recipe = recipesById.get(id); if (recipe) assembly.append(recipeOperation(recipe, itemsById)); });
    flow.append(preparation, assembly);
    const facts = document.createElement('dl'); facts.className = 'bdo-resource-record__facts';
    [['Тип', production.productionType], ['Город', list(production.cities).join(', ')], ['Процессы', list(production.professions).join(' · ')]].forEach(([label, value]) => {
      const row = document.createElement('div'); const term = document.createElement('dt'); const detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value; row.append(term, detail); facts.append(row);
    });
    article.append(header, description, flow, facts);
    window.BdoWorldRelations?.attach(article, 'production', production);
    return article;
  };

  const pineChain = (recipesById) => {
    const first = recipesById.get('SW-RECIPE-023');
    const second = recipesById.get('SW-RECIPE-004');
    const exact = first && second
      && first.materialItemIds.length === 1 && first.materialItemIds[0] === 'SW-ITEM-016' && first.materialQuantities?.['SW-ITEM-016'] === 5
      && first.resultItemId === 'SW-ITEM-150' && first.resultQuantity == null && first.method === 'Рубка' && first.workplace === 'Меню обработки'
      && second.materialItemIds.length === 1 && second.materialItemIds[0] === 'SW-ITEM-150' && second.materialQuantities?.['SW-ITEM-150'] === 10
      && second.resultItemId === 'SW-ITEM-044' && second.resultQuantity == null && second.method === 'Рубка' && second.workplace === 'Меню обработки';
    if (!exact) return null;
    return { id: 'pine-live-chain', name: 'Сосновая обработка', recipes: [first, second] };
  };

  const createRecipeChainCard = (chain, itemsById) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    article.id = chain.id;
    const header = document.createElement('header'); header.className = 'bdo-resource-record__header';
    header.innerHTML = '<span class="bdo-resource-record__glyph" aria-hidden="true">🪵</span><div><p class="bdo-resource-record__eyebrow">LIVE recipes · подтверждённые этапы</p><h3>Сосновая обработка</h3></div><span class="bdo-resource-record__status">LIVE</span>';
    const note = document.createElement('p'); note.textContent = 'Два подтверждённых этапа обработки. Отдельная запись Production для этой цепочки не создаётся.';
    const flow = document.createElement('div'); flow.className = 'bdo-production-flow';
    chain.recipes.forEach((recipe) => {
      const phase = document.createElement('section'); phase.className = 'bdo-production-phase bdo-production-phase--preparation';
      const label = document.createElement('p'); label.className = 'bdo-production-phase__label';
      const link = document.createElement('a'); link.href = `recipes.html#${encodeURIComponent(recipe.id)}`; link.textContent = recipe.id;
      label.append('Этап ', link); phase.append(label, recipeOperation(recipe, itemsById)); flow.append(phase);
    });
    article.append(header, note, flow);
    return article;
  };

  Promise.allSettled([
    loadJson('../assets/data/bdo-productions.json'),
    loadJson('../assets/data/bdo-items.json'),
    loadJson('../assets/data/bdo-recipes.json'),
    window.StartWaveBdoData.loadRecipeArchive()
  ]).then(([productionResult, staticItemResult, staticRecipeResult, liveResult]) => {
    const staticOk = productionResult.status === 'fulfilled' && staticItemResult.status === 'fulfilled' && staticRecipeResult.status === 'fulfilled';
    const liveOk = liveResult.status === 'fulfilled';
    const productions = staticOk ? list(productionResult.value.productions) : [];
    const staticItems = new Map(staticOk ? list(staticItemResult.value.items).map((item) => [item.id, item]) : []);
    const staticRecipes = new Map(staticOk ? list(staticRecipeResult.value.recipes).map((recipe) => [recipe.id, recipe]) : []);
    const liveItems = new Map(liveOk ? liveResult.value.items.map((item) => [item.id, item]) : []);
    const liveRecipes = new Map(liveOk ? liveResult.value.recipes.map((recipe) => [recipe.id, recipe]) : []);
    const chain = liveOk ? pineChain(liveRecipes) : null;
    const records = [...productions.map((production) => ({ type: 'production', value: production }))];
    if (chain) records.unshift({ type: 'recipe-chain', value: chain });
    const searchable = (record) => record.type === 'production'
      ? `${record.value.id} ${record.value.name} ${record.value.productionType} ${record.value.description} ${list(record.value.chainItemIds).flatMap((id) => [id, staticItems.get(id)?.name || '']).join(' ')}`
      : `${record.value.name} ${record.value.recipes.flatMap((recipe) => [recipe.id, recipe.method, recipe.workplace, ...recipe.materialItemIds, recipe.resultItemId, ...recipe.materialItemIds.map((id) => liveItems.get(id)?.name || ''), liveItems.get(recipe.resultItemId)?.name || '']).join(' ')}`;
    const render = () => {
      const query = normalize(search.value);
      const visible = records.filter((record) => normalize(searchable(record)).includes(query));
      grid.replaceChildren(...visible.map((record) => record.type === 'production' ? createProductionCard(record.value, staticItems, staticRecipes) : createRecipeChainCard(record.value, liveItems)));
      grid.setAttribute('aria-busy', 'false');
      const warnings = [!staticOk && 'сохранённые представления недоступны', !liveOk && 'LIVE-рецепты недоступны', liveOk && !chain && 'LIVE pine-контракт не подтверждён'].filter(Boolean);
      count.textContent = `${visible.length} представлений${warnings.length ? ` · ${warnings.join(' · ')}` : ''}`;
      if (relationCount) relationCount.textContent = `${productions.reduce((sum, production) => sum + list(production.chainItemIds).length, 0)} предметных связей${chain ? ' + 2 LIVE-этапа' : ''}`;
      empty.hidden = visible.length !== 0;
    };
    search.addEventListener('input', render); render();
  });
})();
