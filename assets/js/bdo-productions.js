(() => {
  const grid = document.getElementById('bdoProductionGrid');
  const search = document.getElementById('productionArchiveSearch');
  const count = document.getElementById('productionArchiveResultCount');
  const empty = document.getElementById('productionArchiveEmptyState');

  if (!grid || !search || !count || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;

  const createCard = (production) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-production-record';
    article.id = production.id;
    article.dataset.productionId = production.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">⚒</span>
        <div><p class="bdo-resource-record__eyebrow">Production record</p><h3>${production.name}</h3></div>
        <span class="bdo-resource-record__status">${statusLabels[production.status] || production.status}</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${production.id}</code></dd></div>
        <div><dt>Тип производства</dt><dd>${production.productionType}</dd></div>
        <div><dt>Источник</dt><dd>${listCount(production.source)} источников</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${production.checkedAt}">${production.checkedAt}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Связи производства">
        <span class="bdo-resource-record__relations-title">Подтверждённые связи</span>
        <span>Ресурсы: <strong>${listCount(production.inputResources)}</strong></span>
        <span>Предметы: <strong>${listCount(production.outputItems)}</strong></span>
        <span>Профессии: <strong>${listCount(production.professions)}</strong></span>
        <span>Города: <strong>${listCount(production.cities)}</strong></span>
        <span>Рабочие: <strong>${listCount(production.workers)}</strong></span>
        <span>Рецепты: <strong>${listCount(production.recipes)}</strong></span>
        <span>Изображения: <strong>${listCount(production.images)}</strong></span>
      </div>`;
    window.BdoWorldRelations?.attach(article, 'production', production);
    return article;
  };

  const render = (productions) => {
    grid.replaceChildren(...productions.map(createCard));
    count.textContent = `${productions.length} записей`;
    empty.hidden = productions.length !== 0;
  };

  fetch('../assets/data/bdo-productions.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Production data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const productions = Array.isArray(data.productions) ? data.productions : [];
      render(productions);
      search.addEventListener('input', () => {
        const query = normalize(search.value);
        render(productions.filter((production) => normalize(`${production.name} ${production.productionType} ${production.id} ${production.status}`).includes(query)));
      });
    })
    .catch(() => {
      count.textContent = 'Данные недоступны';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить архив производства.';
    });
})();
