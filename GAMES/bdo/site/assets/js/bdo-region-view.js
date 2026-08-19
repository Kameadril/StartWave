(() => {
  const root = document.getElementById('bdoRegionView');
  const title = document.getElementById('regionViewTitle');
  const cityName = document.getElementById('regionCityName');
  const cityNote = document.getElementById('regionCityNote');
  const cityLink = document.getElementById('regionCityLink');
  const objectList = document.getElementById('regionLivingObjects');
  const relationList = document.getElementById('regionConfirmedRelations');
  const awaitingList = document.getElementById('regionAwaitingLayers');
  const mapState = document.getElementById('regionMapState');

  if (!root || !title || !cityName || !objectList || !relationList || !awaitingList || !mapState) return;

  const entityRoutes = { resource: 'bdo-resources.html' };
  const entityIcons = { resource: '🌲' };

  Promise.all([
    fetch('../assets/data/bdo-region-views.json').then((response) => {
      if (!response.ok) throw new Error(`Region data request failed: ${response.status}`);
      return response.json();
    }),
    fetch('../assets/data/bdo-knowledge-graph.json').then((response) => {
      if (!response.ok) throw new Error(`Knowledge graph request failed: ${response.status}`);
      return response.json();
    })
  ]).then(([data, graph]) => {
    const region = data.regions?.[0];
    if (!region) throw new Error('Region view is empty');

    const city = (graph.entities?.city || []).find((entry) => entry.id === region.cityContext.entityId);
    title.textContent = region.name;
    cityName.textContent = city?.name || 'Город ожидает проверки';
    cityNote.textContent = region.cityContext.note;
    cityLink.href = city ? `bdo-cities.html#${encodeURIComponent(city.id)}` : 'bdo-cities.html';

    const objects = region.livingObjects.map((object) => {
      const entity = (graph.entities?.[object.type] || []).find((entry) => entry.id === object.entityId);
      if (!entity || object.status !== 'verified') return null;
      const article = document.createElement('article');
      article.className = 'bdo-region-object';
      article.innerHTML = `<span class="bdo-region-object__icon" aria-hidden="true">${entityIcons[object.type] || '◆'}</span>
        <div><p>Живой объект · подтверждённая запись</p><h3>${entity.name}</h3><span>${object.note}</span></div>
        <a href="${entityRoutes[object.type]}#${encodeURIComponent(entity.id)}">Открыть объект <span aria-hidden="true">→</span></a>`;
      return article;
    }).filter(Boolean);
    objectList.replaceChildren(...objects);

    const confirmed = region.confirmedWorldRelations || [];
    relationList.textContent = confirmed.length
      ? `${confirmed.length} подтверждённых связей`
      : 'Подтверждённых игровых связей пока нет.';

    awaitingList.replaceChildren(...region.awaitingLayers.map((layer) => {
      const item = document.createElement('li');
      item.innerHTML = `<span aria-hidden="true">⏳</span><div><strong>${layer.label}</strong><small>Ожидает подтверждённых данных</small></div><a href="${layer.route}">Открыть слой →</a>`;
      return item;
    }));

    mapState.textContent = region.map.coordinates === null
      ? 'Карта зарезервирована и ожидает подтверждённых координат и связей.'
      : 'Для карты доступны подтверждённые данные.';
    root.setAttribute('aria-busy', 'false');
  }).catch(() => {
    title.textContent = 'Регион временно недоступен';
    root.setAttribute('aria-busy', 'false');
  });
})();
