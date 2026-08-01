(() => {
  const grid = document.getElementById('bdoItemGrid');
  const search = document.getElementById('itemArchiveSearch');
  const count = document.getElementById('itemArchiveResultCount');
  const empty = document.getElementById('itemArchiveEmptyState');
  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;
  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-item-record';
    article.id = item.id;
    article.dataset.itemId = item.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">📦</span><div><p class="bdo-resource-record__eyebrow">Item record</p><h3>${item.name}</h3></div><span class="bdo-resource-record__status">${statusLabels[item.status] || item.status}</span></header>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${item.id}</code></dd></div><div><dt>Категория</dt><dd>${item.category}</dd></div><div><dt>Тип</dt><dd>${item.itemType}</dd></div><div><dt>Дата проверки</dt><dd><time datetime="${item.checkedAt}">${item.checkedAt}</time></dd></div></dl>
      <div class="bdo-resource-record__relations" aria-label="Связи предмета"><span class="bdo-resource-record__relations-title">Подтверждённые связи</span><span>Получение: <strong>${listCount(item.acquisition)}</strong></span><span>Использование: <strong>${listCount(item.usage)}</strong></span><span>Ресурсы: <strong>${listCount(item.resources)}</strong></span><span>Производства: <strong>${listCount(item.productions)}</strong></span><span>Рецепты: <strong>${listCount(item.recipes)}</strong></span><span>Города: <strong>${listCount(item.cities)}</strong></span><span>Изображения: <strong>${listCount(item.images)}</strong></span><span>Источники: <strong>${listCount(item.source)}</strong></span></div>`;
    window.BdoWorldRelations?.attach(article, 'item', item);
    return article;
  };
  const render = (items) => { grid.replaceChildren(...items.map(createCard)); count.textContent = `${items.length} записей`; empty.hidden = items.length !== 0; };
  fetch('../assets/data/bdo-items.json').then((response) => { if (!response.ok) throw new Error(`Item data request failed: ${response.status}`); return response.json(); }).then((data) => {
    const items = Array.isArray(data.items) ? data.items : [];
    render(items);
    search.addEventListener('input', () => { const query = normalize(search.value); render(items.filter((item) => normalize(`${item.name} ${item.category} ${item.itemType} ${item.id}`).includes(query))); });
  }).catch(() => { count.textContent = 'Данные недоступны'; empty.hidden = false; empty.textContent = 'Не удалось загрузить архив предметов.'; });
})();
