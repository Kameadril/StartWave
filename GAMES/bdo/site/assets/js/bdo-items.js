(() => {
  const grid = document.getElementById('bdoItemGrid');
  const search = document.getElementById('itemArchiveSearch');
  const count = document.getElementById('itemArchiveResultCount');
  const total = document.getElementById('itemArchiveTotalCount');
  const relationCount = document.getElementById('itemArchiveRelationCount');
  const moduleCount = document.getElementById('itemArchiveModuleCount');
  const categories = document.getElementById('itemArchiveCategories');
  const clear = document.getElementById('itemArchiveClear');
  const empty = document.getElementById('itemArchiveEmptyState');
  if (!grid || !search || !count || !total || !relationCount || !moduleCount || !categories || !clear || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Проверено', curated: 'Архивная запись' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  const glyphs = { 'Материалы': '◆', 'Инструменты': '⚒', 'Кулинария': '♨', 'Алхимия': '⚗', 'Торговля': '◈' };
  const renderList = (values, emptyText) => {
    const entries = Array.isArray(values) ? values : [];
    return entries.length
      ? `<ul>${entries.map((entry) => `<li>${escapeHtml(typeof entry === 'string' ? entry : entry.label)}</li>`).join('')}</ul>`
      : `<p class="bdo-item-detail-empty">${emptyText}</p>`;
  };
  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-item-record';
    if (item.archive) article.classList.add('bdo-resource-record--living');
    article.id = item.id;
    article.dataset.itemId = item.id;
    const archiveModule = item.archive ? `<section><p class="bdo-resource-record__eyebrow">Calpheon Item Archive · Item module</p><h4>${escapeHtml(item.archive.title)}</h4><p class="bdo-item-detail-empty">${escapeHtml(item.archive.description)}</p></section>` : '';
    const archiveView = item.archiveView ? `<section aria-label="Archive View предмета ${escapeHtml(item.archiveView.title)}"><p class="bdo-resource-record__eyebrow">${escapeHtml(item.archiveView.view)}</p><h4>${escapeHtml(item.archiveView.title)}</h4><p class="bdo-item-detail-empty">${escapeHtml(item.archiveView.summary)}</p><h4>Категория и тип</h4><p class="bdo-item-detail-empty">${escapeHtml(item.archiveView.category)}</p><h4>Статус записи</h4><p class="bdo-item-detail-empty">${escapeHtml(statusLabels[item.archiveView.status] || item.archiveView.status)}</p><h4>Источник и проверка</h4><p class="bdo-item-detail-empty">${escapeHtml(item.archiveView.source)} · ${escapeHtml(item.archiveView.checkedAt)}</p><h4>Подтверждённые связи</h4>${renderList(item.archiveView.confirmedRelations, 'Подтверждённые связи отсутствуют.')}<h4>Границы подтверждения</h4><ul><li>${escapeHtml(item.archiveView.recipeStatus)}</li><li>${escapeHtml(item.archiveView.productionStatus)}</li></ul></section>` : '';
    const atlasView = item.atlas ? `<section aria-label="Atlas-путь предмета ${escapeHtml(item.atlas.title)}"><p class="bdo-resource-record__eyebrow">${escapeHtml(item.atlas.view || 'Production Atlas View')}</p><h4>${escapeHtml(item.atlas.title)}</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.summary)}</p><h4>Источник получения</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.source)}</p><h4>Тип получения</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.acquisitionType)}</p><h4>Обработка</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.processing)}</p><h4>Использование</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.usage)}</p><h4>Производственная последовательность</h4><p class="bdo-item-detail-empty">${escapeHtml(item.atlas.productionSequence)}</p></section>` : '';
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">${glyphs[item.category] || '📦'}</span><div><p class="bdo-resource-record__eyebrow">${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div><span class="bdo-resource-record__status"><i aria-hidden="true"></i>${escapeHtml(statusLabels[item.status] || item.status)}</span></header>
      <p class="bdo-item-record__description">${escapeHtml(item.description)}</p>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${escapeHtml(item.id)}</code></dd></div>${item.gameId != null ? `<div><dt>Игровой ID</dt><dd><code>${escapeHtml(item.gameId)}</code></dd></div>` : ''}<div><dt>Тип</dt><dd>${escapeHtml(item.itemType)}</dd></div><div><dt>Качество</dt><dd>${escapeHtml(item.grade)}</dd></div>${item.weightLT != null ? `<div><dt>Вес</dt><dd>${escapeHtml(Number(item.weightLT).toFixed(2))} LT</dd></div>` : ''}<div><dt>Проверено</dt><dd><time datetime="${escapeHtml(item.checkedAt)}">${escapeHtml(item.checkedAt)}</time></dd></div></dl>
      <div class="bdo-item-record__details">${archiveModule}${archiveView}${atlasView}<section><h4>Получение</h4>${renderList(item.acquisition, 'Способ получения уточняется.')}</section><section><h4>Производство</h4>${renderList(item.production, 'Производственная цепочка уточняется.')}</section><section><h4>Использование</h4>${renderList(item.usage, 'Применение уточняется.')}</section><section><h4>Связи</h4>${renderList(item.relatedObjects, 'Связи будут добавлены позднее.')}</section></div>
      <div class="bdo-resource-record__relations" aria-label="Связи предмета"><span class="bdo-resource-record__relations-title">Индекс связей</span><span>Предметы: <strong>${listCount(item.relatedItemIds)}</strong></span><span>Ресурсы: <strong>${listCount(item.resources)}</strong></span><span>Производства: <strong>${listCount(item.productions)}</strong></span><span>Рецепты: <strong>${listCount(item.recipes)}</strong></span><span>Города: <strong>${listCount(item.cities)}</strong></span></div>`;
    window.BdoWorldRelations?.attach(article, 'item', item);
    return article;
  };
  let activeCategory = 'Все';
  let allItems = [];
  const pluralize = (value) => value % 10 === 1 && value % 100 !== 11 ? 'предмет' : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 'предмета' : 'предметов';
  const render = () => {
    const query = normalize(search.value);
    const items = allItems.filter((item) => {
      const categoryMatches = activeCategory === 'Все' || item.category === activeCategory;
      const haystack = `${item.name} ${item.category} ${item.itemType} ${item.id} ${item.description}`;
      return categoryMatches && normalize(haystack).includes(query);
    });
    grid.replaceChildren(...items.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `Показано ${items.length} из ${allItems.length}`;
    empty.hidden = items.length !== 0;
  };
  const renderCategories = () => {
    const names = ['Все', ...new Set(allItems.map((item) => item.category))];
    categories.replaceChildren(...names.map((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdo-item-category';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(name === activeCategory));
      button.addEventListener('click', () => { activeCategory = name; renderCategories(); render(); });
      return button;
    }));
  };
  fetch('../assets/data/bdo-items.json').then((response) => {
    if (!response.ok) throw new Error(`Item data request failed: ${response.status}`);
    return response.json();
  }).then((data) => {
    allItems = Array.isArray(data.items) ? data.items : [];
    const relations = allItems.reduce((sum, item) => sum + ['relatedItemIds', 'resources', 'productions', 'recipes', 'cities'].reduce((subtotal, key) => subtotal + listCount(item[key]), 0), 0);
    total.textContent = `${allItems.length} ${pluralize(allItems.length)}`;
    relationCount.textContent = `${relations} связей`;
    moduleCount.textContent = `${allItems.filter((item) => item.archive).length} модуль`;
    renderCategories();
    render();
    search.addEventListener('input', render);
    clear.addEventListener('click', () => { search.value = ''; activeCategory = 'Все'; renderCategories(); render(); search.focus(); });
  }).catch(() => {
    grid.setAttribute('aria-busy', 'false');
    count.textContent = 'Данные недоступны';
    empty.hidden = false;
    empty.textContent = 'Не удалось загрузить архив предметов.';
  });
})();
