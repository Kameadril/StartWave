(() => {
  const grid = document.getElementById('bdoCityGrid');
  const search = document.getElementById('cityArchiveSearch');
  const count = document.getElementById('cityArchiveResultCount');
  const empty = document.getElementById('cityArchiveEmptyState');
  const mapState = document.getElementById('cityMapState');

  if (!grid || !search || !count || !empty || !mapState) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;

  const createCard = (city) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-city-record';
    article.id = city.id;
    article.dataset.cityId = city.id;

    const sources = Array.isArray(city.source) ? city.source : [city.source];
    const sourceLinks = sources.filter(Boolean).map((source, index) =>
      `<a href="${source}" target="_blank" rel="noopener noreferrer">Официальный источник ${index + 1}</a>`
    ).join(', ');

    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">🏰</span>
        <div><p class="bdo-resource-record__eyebrow">City record</p><h3>${city.name}</h3></div>
        <span class="bdo-resource-record__status">${statusLabels[city.status] || city.status}</span>
      </header>
      <p class="bdo-city-record__description">${city.description}</p>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${city.id}</code></dd></div>
        <div><dt>Регион</dt><dd>${city.region}</dd></div>
        <div><dt>Тип</dt><dd>${city.cityType}</dd></div>
        <div><dt>Координаты</dt><dd>${city.coordinates === null ? 'Не подтверждены' : 'Подтверждены'}</dd></div>
        <div><dt>Источник</dt><dd>${sourceLinks}</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${city.checkedAt}">${city.checkedAt}</time></dd></div>
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

  const render = (cities, total) => {
    grid.replaceChildren(...cities.map(createCard));
    count.textContent = `${cities.length} из ${total} записей`;
    empty.hidden = cities.length !== 0;
  };

  fetch('../assets/data/bdo-cities.json')
    .then((response) => {
      if (!response.ok) throw new Error(`City data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const cities = Array.isArray(data.cities) ? data.cities : [];
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
