(() => {
  const selector = document.getElementById('chainSelector');
  const canvas = document.querySelector('.bdo-chain-explorer__canvas');
  const list = document.getElementById('chainStageList');
  const title = document.getElementById('active-chain-title');
  const version = document.getElementById('activeChainVersion');
  const chainCount = document.getElementById('chainCount');
  const verifiedCount = document.getElementById('verifiedStageCount');
  const edgeCount = document.getElementById('edgeCount');

  if (!selector || !canvas || !list || !title || !version) return;

  const statusMeta = {
    verified: { label: 'Подтверждено', className: 'is-verified' },
    researching: { label: 'Исследуется', className: 'is-researching' },
    'awaiting-data': { label: 'Неизвестно', className: 'is-unknown' },
    unknown: { label: 'Неизвестно', className: 'is-unknown' }
  };

  const findEntities = (graph, stage) => {
    const index = new Map((graph.entities?.[stage.type] || []).map((entity) => [entity.id, entity]));
    return (stage.entityIds || []).map((id) => index.get(id)).filter(Boolean);
  };

  const renderChain = (graph, chain) => {
    title.textContent = chain.title;
    version.textContent = `Версия ${chain.version}`;

    const stages = chain.stages.map((stage, index) => {
      const meta = graph.entityTypes[stage.type];
      const entities = findEntities(graph, stage);
      const status = statusMeta[stage.status] || statusMeta.unknown;
      const stageItem = document.createElement('li');
      stageItem.className = status.className;

      const entityNames = entities.length
        ? entities.map((entity) => entity.name).join(', ')
        : 'Подтверждённых данных пока нет';
      const anchor = entities.length === 1 ? `#${encodeURIComponent(entities[0].id)}` : '';

      const routeControl = meta.route
        ? `<a href="${meta.route}${anchor}">${entities.length ? 'Открыть запись' : 'Перейти в слой'} <span aria-hidden="true">→</span></a>`
        : '<span class="bdo-chain-explorer__reserved">Маршрут слоя зарезервирован</span>';

      stageItem.innerHTML = `<article>
        <div class="bdo-chain-explorer__stage-number">${String(index + 1).padStart(2, '0')}</div>
        <span class="bdo-chain-explorer__stage-icon" aria-hidden="true">${meta.icon}</span>
        <div class="bdo-chain-explorer__stage-copy">
          <p>${meta.label}</p>
          <h3>${entityNames}</h3>
          <span class="bdo-chain-explorer__status"><i aria-hidden="true"></i>${status.label}</span>
        </div>
        ${routeControl}
      </article>${index < chain.stages.length - 1 ? '<div class="bdo-chain-explorer__connector" aria-hidden="true"><i></i><span>↓</span></div>' : ''}`;
      return stageItem;
    });

    list.replaceChildren(...stages);
    canvas.setAttribute('aria-busy', 'false');
  };

  fetch('../assets/data/bdo-knowledge-graph.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Knowledge graph request failed: ${response.status}`);
      return response.json();
    })
    .then((graph) => {
      const chains = graph.knowledgeChains || [];
      if (!chains.length) {
        title.textContent = 'Цепочки ожидают исследования';
        version.textContent = '';
        selector.disabled = true;
        chainCount.textContent = '0';
        verifiedCount.textContent = '0';
        edgeCount.textContent = String((graph.edges || []).length);
        canvas.setAttribute('aria-busy', 'false');
        return;
      }

      selector.replaceChildren(...chains.map((chain) => {
        const option = document.createElement('option');
        option.value = chain.id;
        option.textContent = chain.title;
        return option;
      }));

      chainCount.textContent = String(chains.length);
      verifiedCount.textContent = String(chains.reduce((sum, chain) =>
        sum + chain.stages.filter((stage) => stage.status === 'verified').length, 0));
      edgeCount.textContent = String((graph.edges || []).length);

      const selectChain = () => {
        const chain = chains.find((entry) => entry.id === selector.value) || chains[0];
        if (chain) renderChain(graph, chain);
      };

      const requestedChain = new URLSearchParams(window.location.search).get('chain');
      if (requestedChain && chains.some((chain) => chain.id === requestedChain)) selector.value = requestedChain;
      selector.addEventListener('change', selectChain);
      selectChain();
    })
    .catch(() => {
      title.textContent = 'Knowledge Graph временно недоступен';
      version.textContent = '';
      canvas.setAttribute('aria-busy', 'false');
    });
})();
