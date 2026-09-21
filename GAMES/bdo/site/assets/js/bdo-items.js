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
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Проверено', curated: 'Архивная запись', active: 'Активно' };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  const glyphs = { 'Материалы': '◆', 'Инструменты': '⚒', 'Кулинария': '♨', 'Алхимия': '⚗', 'Торговля': '◈' };

  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-item-record';
    article.id = item.id;
    article.dataset.itemId = item.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">${glyphs[item.category] || '📦'}</span><div><p class="bdo-resource-record__eyebrow">${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div><span class="bdo-resource-record__status"><i aria-hidden="true"></i>${escapeHtml(statusLabels[item.status] || item.status)}</span></header>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${escapeHtml(item.id)}</code></dd></div><div><dt>Тип</dt><dd>${escapeHtml(item.itemType)}</dd></div></dl>`;
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
      const haystack = `${item.name} ${item.nameEn ?? ''} ${item.category} ${item.itemType} ${item.id}`;
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

  relationCount.hidden = true;
  moduleCount.hidden = true;
  window.StartWaveBdoData.loadItems().then((items) => {
    allItems = items;
    total.textContent = `${allItems.length} ${pluralize(allItems.length)}`;
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
