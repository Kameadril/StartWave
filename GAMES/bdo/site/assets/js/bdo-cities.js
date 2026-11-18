(() => {
  const grid = document.getElementById('bdoCityGrid');
  const search = document.getElementById('cityArchiveSearch');
  const count = document.getElementById('cityArchiveResultCount');
  const empty = document.getElementById('cityArchiveEmptyState');
  const mapState = document.getElementById('cityMapState');
  if (!grid || !search || !count || !empty || !mapState || !window.StartWaveBdoData?.loadCities) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено', curated: 'Архивная запись', active: 'Активно' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;

  const createCard = (city) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-city-record';
    article.id = city.id;
    article.dataset.cityId = city.id;

    const sources = Array.isArray(city.source) ? city.source : [city.source];
    const sourceLinks = sources.filter(Boolean).map((source, index) =>
      `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Официальный источник ${index + 1}</a>`
    ).join(', ');

    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">🏰</span>
        <div><p class="bdo-resource-record__eyebrow">City record</p><h3>${escapeHtml(city.name)}</h3></div>
        <span class="bdo-resource-record__status">${escapeHtml(statusLabels[city.status] || city.status)}</span>
      </header>
      ${city.description ? `<p class="bdo-city-record__description">${escapeHtml(city.description)}</p>` : ''}
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${escapeHtml(city.id)}</code></dd></div>
        <div><dt>Регион</dt><dd>${escapeHtml(city.region)}</dd></div>
        <div><dt>Тип</dt><dd>${escapeHtml(city.cityType)}</dd></div>
        <div><dt>Координаты</dt><dd>${city.coordinates === null ? 'Не подтверждены' : 'Подтверждены'}</dd></div>
        <div><dt>Источник</dt><dd>${sourceLinks || 'Не указан'}</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${escapeHtml(city.checkedAt)}">${escapeHtml(city.checkedAt || 'Не указана')}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Связи города">
        <span class="bdo-resource-record__relations-title">Подтверждённые связи</span>
        <span>Узлы: <strong>${listCount(city.nodes)}</strong></span>
        <span>Ресурсы: <strong>${listCount(city.resources)}</strong></span>
        <span>Производство: <strong>${listCount(city.production)}</strong></span>
        <span>Торговля: <strong>${listCount(city.trade)}</strong></span>
        <span>Изображения: <strong>${listCount(city.images)}</strong></span>
      </div>`;
    window.BdoWorldRelations?.attach(article, 'city', city);
    return article;
  };

  const render = () => {
    const query = normalize(search.value);
    const cities = allCities.filter((city) => normalize(`${city.name} ${city.nameEn ?? ''} ${city.cityType ?? ''} ${city.regionId ?? ''} ${city.id}`).includes(query));
    grid.replaceChildren(...cities.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `${cities.length} из ${allCities.length}`;
    empty.hidden = cities.length !== 0;
  };

  window.StartWaveBdoData.loadCities()
    .then((cities) => {
      render(cities, cities.length);
      mapState.textContent = cities.some((city) => city.coordinates !== null)
        ? 'Для карты доступны подтверждённые точки.'
        : 'Карта ожидает подтверждённых координат городов.';
      search.addEventListener('input', () => {
        const query = normalize(search.value);
        const matches = cities.filter((city) =>
          normalize(`${city.name} ${city.region} ${city.cityType} ${city.id} ${city.status}`).includes(query)
        );
        render(matches, cities.length);
      });
    })
    .catch(() => {
      grid.setAttribute('aria-busy', 'false');
      count.textContent = 'Данные недоступны';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить архив городов.';
    });
})();
