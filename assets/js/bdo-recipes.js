(() => {
  const grid = document.getElementById('bdoRecipeGrid');
  const search = document.getElementById('recipeArchiveSearch');
  const resultCount = document.getElementById('recipeArchiveResultCount');
  const relationCount = document.getElementById('recipeArchiveRelationCount');
  const empty = document.getElementById('recipeArchiveEmptyState');

  if (!grid || !search || !resultCount || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const list = (value) => Array.isArray(value) ? value : [];
  const statusLabels = { curated: 'Собрано', verified: 'Подтверждено' };
  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  });

  const linkedItem = (item, fallbackId) => {
    const link = document.createElement('a');
    link.href = `bdo-items.html#${fallbackId}`;
    link.textContent = item?.name || fallbackId;
    return link;
  };

  const createCard = (recipe, itemsById, productionsById) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    article.id = recipe.id;
    article.dataset.recipeId = recipe.id;

    const header = document.createElement('header');
    header.className = 'bdo-resource-record__header';
    header.innerHTML = `<span class="bdo-resource-record__glyph" aria-hidden="true">📜</span><div><p class="bdo-resource-record__eyebrow">${recipe.id} · ${recipe.recipeType}</p><h3>${recipe.name}</h3></div><span class="bdo-resource-record__status">${statusLabels[recipe.status] || recipe.status}</span>`;

    const description = document.createElement('p');
    description.textContent = recipe.description;

    const flow = document.createElement('div');
    flow.className = 'bdo-node-relation-flow';
    flow.setAttribute('aria-label', `Связи рецепта «${recipe.name}»`);
    const flowSteps = [
      ['Предмет', list(recipe.materialItemIds)[0]],
      ['Рецепт', null],
      ['Материалы', null],
      ['Производство', list(recipe.productionIds)[0]],
      ['Результат', recipe.resultItemId]
    ];
    flowSteps.forEach(([label, id], index) => {
      if (index) { const arrow = document.createElement('i'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; flow.append(arrow); }
      const step = document.createElement('span');
      if (label === 'Рецепт') step.textContent = `📜 ${recipe.id}`;
      else if (label === 'Материалы') step.textContent = `🧺 ${list(recipe.materialItemIds).length}`;
      else if (label === 'Производство') {
        const production = productionsById.get(id);
        const link = document.createElement('a'); link.href = `bdo-production.html#${id}`; link.textContent = `⚒ ${production?.name || id}`; step.append(link);
      } else step.append(linkedItem(itemsById.get(id), id));
      flow.append(step);
    });

    const facts = document.createElement('dl');
    facts.className = 'bdo-resource-record__facts';
    facts.innerHTML = `<div><dt>Способ</dt><dd>${recipe.method}</dd></div><div><dt>Место</dt><dd>${recipe.workplace}</dd></div><div><dt>Код рецепта</dt><dd>${recipe.legacyId}</dd></div>`;

    const materials = document.createElement('div');
    materials.className = 'bdo-resource-record__relations';
    const title = document.createElement('strong'); title.textContent = 'Необходимые материалы'; materials.append(title);
    const materialList = document.createElement('div'); materialList.className = 'bdo-resource-record__links';
    list(recipe.materialItemIds).forEach((id) => materialList.append(linkedItem(itemsById.get(id), id)));
    materials.append(materialList);

    const result = document.createElement('div');
    result.className = 'bdo-resource-record__relations';
    const resultTitle = document.createElement('strong'); resultTitle.textContent = 'Результат'; result.append(resultTitle);
    const resultLinks = document.createElement('div'); resultLinks.className = 'bdo-resource-record__links'; resultLinks.append(linkedItem(itemsById.get(recipe.resultItemId), recipe.resultItemId)); result.append(resultLinks);

    article.append(header, description, flow, facts, materials, result);
    return article;
  };

  Promise.all([
    loadJson('../assets/data/bdo-recipes.json'),
    loadJson('../assets/data/bdo-items.json'),
    loadJson('../assets/data/bdo-productions.json')
  ]).then(([recipeData, itemData, productionData]) => {
    const recipes = list(recipeData.recipes);
    const itemsById = new Map(list(itemData.items).map((item) => [item.id, item]));
    const productionsById = new Map(list(productionData.productions).map((production) => [production.id, production]));
    const render = () => {
      const query = normalize(search.value);
      const visible = recipes.filter((recipe) => normalize([
        recipe.id, recipe.legacyId, recipe.name, recipe.recipeType, recipe.description,
        recipe.method, recipe.workplace,
        ...list(recipe.materialItemIds).map((id) => itemsById.get(id)?.name || id),
        itemsById.get(recipe.resultItemId)?.name || recipe.resultItemId,
        ...list(recipe.productionIds).map((id) => productionsById.get(id)?.name || id)
      ].join(' ')).includes(query));
      grid.replaceChildren(...visible.map((recipe) => createCard(recipe, itemsById, productionsById)));
      grid.setAttribute('aria-busy', 'false');
      resultCount.textContent = `${visible.length} из ${recipes.length} рецептов`;
      empty.hidden = visible.length > 0;
    };
    relationCount.textContent = `${recipes.reduce((sum, recipe) => sum + list(recipe.materialItemIds).length + list(recipe.productionIds).length + 1, 0)} связей`;
    search.addEventListener('input', render);
    render();
  }).catch((error) => {
    console.error('Не удалось загрузить Calpheon Recipe Archive.', error);
    grid.setAttribute('aria-busy', 'false');
    resultCount.textContent = 'Ошибка загрузки';
    empty.hidden = false;
    empty.textContent = 'Архив рецептов временно недоступен. Проверьте подключение файлов данных.';
  });
})();
