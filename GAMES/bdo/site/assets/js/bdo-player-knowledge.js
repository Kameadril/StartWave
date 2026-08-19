(() => {
  const chainPanel = document.querySelector('.bdo-player-progress__chain');
  const stageList = document.getElementById('playerStageList');
  const journalList = document.getElementById('journalList');
  if (!chainPanel || !stageList || !journalList) return;

  const statusMeta = {
    unknown: { label: 'Неизвестно', className: 'is-unknown' },
    researching: { label: 'Исследуется', className: 'is-researching' },
    studied: { label: 'Изучено', className: 'is-studied' }
  };

  const loadJson = (url) => fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  });

  Promise.all([
    loadJson('../assets/data/bdo-knowledge-graph.json'),
    loadJson('../assets/data/bdo-player-knowledge.json')
  ]).then(([graph, playerData]) => {
    const progress = playerData.playerJourney?.knowledgeProgress?.[0];
    const chain = (graph.knowledgeChains || []).find((entry) => entry.id === progress?.chainId);
    if (!progress || !chain) throw new Error('Player progress chain is unavailable');

    const entities = (type) => new Map((graph.entities?.[type] || []).map((entity) => [entity.id, entity]));
    const root = entities(progress.rootEntity.type).get(progress.rootEntity.id);
    document.getElementById('playerChainTitle').textContent = root?.name || chain.title;
    document.getElementById('openExplorerLink').href = `bdo-knowledge-chain.html?chain=${encodeURIComponent(chain.id)}`;

    stageList.replaceChildren(...progress.stages.map((stage, index) => {
      const meta = graph.entityTypes[stage.type];
      const status = statusMeta[stage.status] || statusMeta.unknown;
      const knownEntities = (stage.entityIds || []).map((id) => entities(stage.type).get(id)).filter(Boolean);
      const item = document.createElement('li');
      item.className = status.className;
      item.innerHTML = `<span class="bdo-player-progress__step">${String(index + 1).padStart(2, '0')}</span><span class="bdo-player-progress__icon" aria-hidden="true">${meta.icon}</span><div><p>${meta.label}</p><h3>${knownEntities.length ? knownEntities.map((entity) => entity.name).join(', ') : `Исследовать слой «${meta.label}»`}</h3><span class="bdo-player-progress__status"><i aria-hidden="true"></i>${status.label}</span></div>`;
      return item;
    }));

    journalList.replaceChildren(...progress.journal.map((entry) => {
      const item = document.createElement('li');
      item.innerHTML = `<time datetime="${entry.createdAt}">${new Date(`${entry.createdAt}T00:00:00`).toLocaleDateString('ru-RU')}</time><h3>${entry.title}</h3><p>${entry.note}</p>`;
      return item;
    }));

    const studied = progress.stages.filter((stage) => stage.status === 'studied').length;
    const researching = progress.stages.filter((stage) => stage.status === 'researching').length;
    const percent = Math.round((studied / progress.stages.length) * 100);
    document.getElementById('progressStudied').textContent = String(studied);
    document.getElementById('progressResearching').textContent = String(researching);
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressMeter').style.width = `${percent}%`;
    chainPanel.setAttribute('aria-busy', 'false');
  }).catch(() => {
    document.getElementById('playerChainTitle').textContent = 'Прогресс временно недоступен';
    chainPanel.setAttribute('aria-busy', 'false');
  });
})();
