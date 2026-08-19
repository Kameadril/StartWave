(() => {
  const root = document.getElementById('bdoWorldView');
  const stage = document.getElementById('worldConnectionStage');
  const relationStatus = document.getElementById('worldRelationStatus');
  const futureLayers = document.getElementById('worldFutureLayers');
  if (!root || !stage || !relationStatus || !futureLayers) return;

  const getJson = (path, label) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
    return response.json();
  });

  Promise.all([
    getJson('../assets/data/bdo-region-views.json', 'Region view'),
    getJson('../assets/data/bdo-knowledge-layer.json', 'Knowledge layer'),
    getJson('../assets/data/bdo-knowledge-graph.json', 'Knowledge graph'),
    getJson('../assets/data/bdo-resources.json', 'Resources')
  ]).then(([regionData, knowledgeData, graph, resourceData]) => {
    const region = regionData.regions?.[0];
    const city = (graph.entities?.city || []).find((entry) => entry.id === region?.cityContext?.entityId);
    const livingObject = region?.livingObjects?.find((entry) => entry.status === 'verified');
    const resource = (resourceData.resources || []).find((entry) => entry.id === livingObject?.entityId);
    const knowledgeEntries = (knowledgeData.categories || []).flatMap((category) => category.entries || []).filter((entry) => entry.status === 'verified');
    const confirmedRelations = graph.edges || [];
    const awaiting = region?.awaitingLayers || [];
    const cards = [
      { className: 'is-city', icon: '🏰', eyebrow: 'Регион / город · контекст', title: city?.name || 'Ожидает данных', text: region?.cityContext?.note || 'Городской контекст ожидает проверки.', href: 'bdo-region-calpheon.html', link: 'Открыть регион' },
      { className: 'is-knowledge', icon: '📖', eyebrow: 'Knowledge Layer', title: 'Библиотека знаний', text: `${knowledgeEntries.length} подтверждённые записи распределены по существующим категориям.`, href: 'bdo-knowledge-layer.html', link: 'Открыть знания' },
      { className: 'is-resource', icon: '🌲', eyebrow: 'Живой объект · ресурс', title: resource?.name || 'Ожидает данных', text: livingObject?.note || 'Ресурсный объект ожидает проверки.', href: `bdo-resources.html#${encodeURIComponent(resource?.id || '')}`, link: 'Открыть объект' },
      { className: 'is-future', icon: '🔗', eyebrow: 'Будущие связи', title: confirmedRelations.length ? `${confirmedRelations.length} подтверждено` : 'Ожидают данных', text: confirmedRelations.length ? 'Граф содержит проверенные игровые связи.' : 'Knowledge Graph пока не содержит подтверждённых игровых связей.', href: 'bdo-knowledge-chain.html', link: 'Открыть Explorer' }
    ];
    stage.replaceChildren(...cards.map((card) => {
      const article = document.createElement('article');
      article.className = `bdo-world-node ${card.className}`;
      article.innerHTML = `<span class="bdo-world-node__icon" aria-hidden="true">${card.icon}</span><div><p>${card.eyebrow}</p><h3>${card.title}</h3><span>${card.text}</span></div><a href="${card.href}">${card.link} <span aria-hidden="true">→</span></a>`;
      return article;
    }));
    futureLayers.replaceChildren(...awaiting.map((layer) => {
      const article = document.createElement('article');
      article.innerHTML = `<span aria-hidden="true">⏳</span><div><h3>${layer.label}</h3><p>Ожидает подтверждённых данных и связей</p></div><a href="${layer.route}">Открыть слой →</a>`;
      return article;
    }));
    document.getElementById('worldVerifiedCount').textContent = String([city, resource, ...knowledgeEntries].filter(Boolean).length);
    document.getElementById('worldRelationCount').textContent = String(confirmedRelations.length);
    document.getElementById('worldAwaitingCount').textContent = String(awaiting.length);
    relationStatus.textContent = confirmedRelations.length ? `${confirmedRelations.length} подтверждённых игровых связей доступны в графе.` : 'Подтверждённых игровых связей пока нет. Контекстные линии остаются пунктирными.';
    root.setAttribute('aria-busy', 'false');
  }).catch(() => {
    stage.innerHTML = '<p class="bdo-resource-empty">Обзор мира временно недоступен.</p>';
    relationStatus.textContent = 'Не удалось проверить Knowledge Graph.';
    root.setAttribute('aria-busy', 'false');
  });
})();
