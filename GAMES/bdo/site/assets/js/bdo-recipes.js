(() => {
  const grid = document.getElementById('bdoRecipeGrid');
  const search = document.getElementById('recipeArchiveSearch');
  const resultCount = document.getElementById('recipeArchiveResultCount');
  const relationCount = document.getElementById('recipeArchiveRelationCount');
  const moduleCount = document.getElementById('recipeArchiveModuleCount');
  const empty = document.getElementById('recipeArchiveEmptyState');

  if (!grid || !search || !resultCount || !moduleCount || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const list = (value) => Array.isArray(value) ? value : [];
  const statusLabels = { curated: 'Собрано', verified: 'Подтверждено' };

  const linkedItem = (item, fallbackId) => {
    const link = document.createElement('a');
    link.href = `items.html#${encodeURIComponent(fallbackId)}`;
    link.textContent = item?.name || fallbackId;
    return link;
  };

  const createCard = (recipe, itemsById, productionsById) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    if (recipe.archive) article.classList.add('bdo-resource-record--living');
    article.id = recipe.id;
    article.dataset.recipeId = recipe.id;

    const header = document.createElement('header');
    header.className = 'bdo-resource-record__header';
    const glyph = document.createElement('span'); glyph.className = 'bdo-resource-record__glyph'; glyph.setAttribute('aria-hidden', 'true'); glyph.textContent = '📜';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('p'); eyebrow.className = 'bdo-resource-record__eyebrow'; eyebrow.textContent = `${recipe.id} · ${recipe.recipeType}`;
    const headingTitle = document.createElement('h3'); headingTitle.textContent = recipe.name; heading.append(eyebrow, headingTitle);
    const status = document.createElement('span'); status.className = 'bdo-resource-record__status'; status.textContent = statusLabels[recipe.status] || recipe.status;
    header.append(glyph, heading, status);

    const description = document.createElement('p');
    description.textContent = recipe.description;

    const archiveModule = recipe.archive ? document.createElement('section') : null;
    if (archiveModule) {
      archiveModule.className = 'bdo-resource-data-note';
      const kicker = document.createElement('p');
      kicker.className = 'bdo-resource-kicker';
      kicker.textContent = 'Calpheon Recipe Archive · Recipe module';
      const title = document.createElement('h4');
      title.textContent = recipe.archive.title;
      const note = document.createElement('p');
      note.textContent = recipe.archive.description;
      archiveModule.append(kicker, title, note);
    }

    const flow = document.createElement('div');
    flow.className = 'bdo-node-relation-flow';
    flow.setAttribute('aria-label', `Связи рецепта «${recipe.name}»`);
    const flowSteps = [
      ['Материалы', null],
      ['Рецепт', null],
      ['Результат', recipe.resultItemId]
    ];
    const productionId = list(recipe.productionIds)[0];
    if (productionId) flowSteps.splice(2, 0, ['Производство', productionId]);
    flowSteps.forEach(([label, id], index) => {
      if (index) { const arrow = document.createElement('i'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; flow.append(arrow); }
      const step = document.createElement('span');
      if (label === 'Рецепт') step.textContent = `📜 ${recipe.id}`;
      else if (label === 'Материалы') {
        step.append('🧺 ');
        list(recipe.materialItemIds).forEach((materialId, materialIndex) => {
          if (materialIndex) step.append(' + ');
          const material = linkedItem(itemsById.get(materialId), materialId);
          const quantity = recipe.materialQuantities?.[materialId];
          if (quantity) material.append(` ×${quantity}`);
          step.append(material);
        });
      }
      else if (label === 'Производство') {
        const production = productionsById.get(id);
        const link = document.createElement('a'); link.href = `production.html#${encodeURIComponent(id)}`; link.textContent = `⚒ ${production?.name || id}`; step.append(link);
      } else {
        const output = linkedItem(itemsById.get(id), id);
        output.append(recipe.resultQuantity == null ? ' · выход переменный' : ` ×${recipe.resultQuantity}`);
        step.append(output);
      }
      flow.append(step);
    });

    const facts = document.createElement('dl');
    facts.className = 'bdo-resource-record__facts';
    [['Способ', recipe.method], ['Место', recipe.workplace], ['ID рецепта', recipe.id]].forEach(([label, value]) => {
      const row = document.createElement('div'); const term = document.createElement('dt'); const detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value; row.append(term, detail); facts.append(row);
    });

    const materials = document.createElement('div');
    materials.className = 'bdo-resource-record__relations';
    const title = document.createElement('strong'); title.textContent = 'Необходимые материалы'; materials.append(title);
    const materialList = document.createElement('div'); materialList.className = 'bdo-resource-record__links';
    list(recipe.materialItemIds).forEach((id) => {
      const material = linkedItem(itemsById.get(id), id);
      const quantity = recipe.materialQuantities?.[id];
      if (quantity) material.append(` ×${quantity}`);
      materialList.append(material);
    });
    materials.append(materialList);

    const result = document.createElement('div');
    result.className = 'bdo-resource-record__relations';
    const resultTitle = document.createElement('strong'); resultTitle.textContent = 'Результат'; result.append(resultTitle);
    const resultLinks = document.createElement('div'); resultLinks.className = 'bdo-resource-record__links';
    const resultItem = linkedItem(itemsById.get(recipe.resultItemId), recipe.resultItemId);
    resultItem.append(recipe.resultQuantity == null ? ' · выход переменный' : ` ×${recipe.resultQuantity}`);
    resultLinks.append(resultItem); result.append(resultLinks);

    article.append(header, description);
    if (archiveModule) article.append(archiveModule);
    article.append(flow, facts, materials, result);
    return article;
  };

  window.StartWaveBdoData.loadRecipeArchive().then(({ recipes, items }) => {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const productionsById = new Map();
    const render = () => {
      const query = normalize(search.value);
      const visible = recipes.filter((recipe) => normalize([
        recipe.id, recipe.legacyId, recipe.name, recipe.recipeType, recipe.description,
        recipe.method, recipe.workplace,
        ...list(recipe.materialItemIds).flatMap((id) => [id, itemsById.get(id)?.name || '']),
        recipe.resultItemId, itemsById.get(recipe.resultItemId)?.name || '',
        ...list(recipe.productionIds).map((id) => productionsById.get(id)?.name || id)
      ].join(' ')).includes(query));
      grid.replaceChildren(...visible.map((recipe) => createCard(recipe, itemsById, productionsById)));
      grid.setAttribute('aria-busy', 'false');
      resultCount.textContent = `${visible.length} из ${recipes.length} рецептов`;
      empty.hidden = visible.length > 0;
    };
    relationCount.textContent = `${recipes.reduce((sum, recipe) => sum + list(recipe.materialItemIds).length + list(recipe.productionIds).length + 1, 0)} связей`;
    moduleCount.textContent = `${recipes.length} LIVE-записей`;
    search.addEventListener('input', render);
    render();
  }).catch((error) => {
    console.error('Не удалось загрузить Calpheon Recipe Archive.', error);
    grid.setAttribute('aria-busy', 'false');
    resultCount.textContent = 'Ошибка загрузки';
    empty.hidden = false;
    empty.textContent = 'LIVE-архив рецептов временно недоступен. Статические данные не подставлены, чтобы не показать устаревшие связи.';
  });
})();
