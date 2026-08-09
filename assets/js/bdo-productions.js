(() => {
  const grid = document.getElementById('bdoProductionGrid');
  const search = document.getElementById('productionArchiveSearch');
  const count = document.getElementById('productionArchiveResultCount');
  const relationCount = document.getElementById('productionArchiveRelationCount');
  const empty = document.getElementById('productionArchiveEmptyState');

  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { curated: 'Собрано', verified: 'Подтверждено' };
  const list = (value) => Array.isArray(value) ? value : [];

  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  });

  const itemLink = (item) => {
    const link = document.createElement('a');
    link.href = `bdo-items.html#${item.id}`;
    link.textContent = item.name;
    link.title = `Открыть предмет: ${item.name}`;
    return link;
  };

  const recipeOperation = (recipe, itemsById) => {
    const operation = document.createElement('div');
    operation.className = 'bdo-production-operation';

    const materials = document.createElement('div');
    materials.className = 'bdo-production-operation__materials';
    list(recipe.materialItemIds).forEach((id, index) => {
      const item = itemsById.get(id);
      if (!item) return;
      if (index) materials.append(document.createTextNode(' + '));
      materials.append(itemLink(item));
    });

    const method = document.createElement('span');
    method.className = 'bdo-production-operation__method';
    method.textContent = recipe.method;

    const result = itemsById.get(recipe.resultItemId);
    const resultNode = document.createElement('div');
    resultNode.className = 'bdo-production-operation__result';
    if (result) resultNode.append(itemLink(result));

    operation.append(materials, method, resultNode);
    return operation;
  };

  const createCard = (production, itemsById, recipesById) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    article.id = production.id;
    article.dataset.productionId = production.id;

    const header = document.createElement('header');
    header.className = 'bdo-resource-record__header';
    header.innerHTML = `<span class="bdo-resource-record__glyph" aria-hidden="true">⚒</span><div><p class="bdo-resource-record__eyebrow">Production chain</p><h3>${production.name}</h3></div><span class="bdo-resource-record__status">${statusLabels[production.status] || production.status}</span>`;

    const description = document.createElement('p');
    description.textContent = production.description;

    const flow = document.createElement('div');
    flow.className = 'bdo-production-flow';
    flow.setAttribute('aria-label', `Этапы цепочки «${production.name}»`);

    const preparation = document.createElement('section');
    preparation.className = 'bdo-production-phase bdo-production-phase--preparation';
    preparation.innerHTML = '<p class="bdo-production-phase__label">Подготовка и обработка материалов</p>';
    list(production.preparationRecipeIds).forEach((id) => {
      const recipe = recipesById.get(id);
      if (recipe) preparation.append(recipeOperation(recipe, itemsById));
    });

    const assembly = document.createElement('section');
    assembly.className = 'bdo-production-phase bdo-production-phase--assembly';
    assembly.innerHTML = '<p class="bdo-production-phase__label">Финальная сборка</p>';
    const assemblyRecipe = recipesById.get(production.assemblyRecipeId);
    if (assemblyRecipe) {
      assembly.append(recipeOperation(assemblyRecipe, itemsById));
      const workplace = document.createElement('p');
      workplace.className = 'bdo-production-phase__workplace';
      workplace.textContent = assemblyRecipe.workplace;
      assembly.append(workplace);
    }
    flow.append(preparation, assembly);

    const facts = document.createElement('dl');
    facts.className = 'bdo-resource-record__facts';
    facts.innerHTML = `<div><dt>Тип</dt><dd>${production.productionType}</dd></div><div><dt>Город</dt><dd>${list(production.cities).join(', ')}</dd></div><div><dt>Процессы</dt><dd>${list(production.professions).join(' · ')}</dd></div><div><dt>Рабочие</dt><dd>${list(production.workers).join(', ')}</dd></div>`;

    const relations = document.createElement('div');
    relations.className = 'bdo-resource-record__relations';
    relations.innerHTML = `<span class="bdo-resource-record__relations-title">Связи записи</span><span>Входы: <strong>${list(production.inputItemIds).length}</strong></span><span>Этапы: <strong>${list(production.chainItemIds).length}</strong></span><span>Результаты: <strong>${list(production.outputItemIds).length}</strong></span><span>Рецепты: <strong>${list(production.recipes).length}</strong></span>`;

    article.append(header, description, flow, facts, relations);
    window.BdoWorldRelations?.attach(article, 'production', production);
    return article;
  };

  Promise.all([
    loadJson('../assets/data/bdo-productions.json'),
    loadJson('../assets/data/bdo-items.json'),
    loadJson('../assets/data/bdo-recipes.json')
  ]).then(([productionData, itemData, recipeData]) => {
    const productions = list(productionData.productions);
    const itemsById = new Map(list(itemData.items).map((item) => [item.id, item]));
    const recipesById = new Map(list(recipeData.recipes).map((recipe) => [recipe.id, recipe]));
    const render = (records) => {
      grid.replaceChildren(...records.map((record) => createCard(record, itemsById, recipesById)));
      grid.setAttribute('aria-busy', 'false');
      count.textContent = `${records.length} цепочка`;
      if (relationCount) relationCount.textContent = `${records.reduce((sum, record) => sum + list(record.chainItemIds).length, 0)} предметных связей`;
      empty.hidden = records.length !== 0;
    };
    render(productions);
    search.addEventListener('input', () => {
      const query = normalize(search.value);
      render(productions.filter((production) => {
        const itemNames = list(production.chainItemIds).map((id) => itemsById.get(id)?.name || '').join(' ');
        return normalize(`${production.name} ${production.productionType} ${production.description} ${itemNames}`).includes(query);
      }));
    });
  }).catch(() => {
    count.textContent = 'Данные недоступны';
    grid.setAttribute('aria-busy', 'false');
    empty.hidden = false;
    empty.textContent = 'Не удалось загрузить производственные цепочки и связанные предметы.';
  });
})();
