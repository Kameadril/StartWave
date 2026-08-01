(() => {
  const graphUrl = '../assets/data/bdo-knowledge-graph.json';
  let graphPromise;

  const loadGraph = () => graphPromise || (graphPromise = fetch(graphUrl).then((response) => {
    if (!response.ok) throw new Error(`Knowledge graph request failed: ${response.status}`);
    return response.json();
  }));

  const list = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const relationValues = (entity, field) => field === 'city'
    ? list(entity.relations?.city)
    : list(entity[field] ?? entity.relations?.[field]);

  const createWorldRelations = (entityType, entity, graph) => {
    const section = document.createElement('section');
    section.className = 'bdo-world-relations';
    section.setAttribute('aria-label', `Связи мира: ${entity.name}`);

    const aliases = graph.relationAliases?.[entityType] || {};
    const cards = Object.entries(aliases).map(([field, targetType]) => {
      const meta = graph.entityTypes[targetType];
      const ids = relationValues(entity, field);
      const index = new Map((graph.entities[targetType] || []).map((item) => [item.id, item]));
      const links = ids.map((id) => {
        const target = index.get(id);
        if (!target || !meta.route) return '';
        return `<a href="${meta.route}#${encodeURIComponent(id)}">${target.name}</a>`;
      }).filter(Boolean).join('');
      const route = meta.route
        ? `<a class="bdo-world-relations__layer-link" href="${meta.route}">Открыть слой →</a>`
        : '<span class="bdo-world-relations__reserved">Слой зарезервирован</span>';
      return `<article class="bdo-world-relations__card">
        <span class="bdo-world-relations__icon" aria-hidden="true">${meta.icon}</span>
        <div><h4>${meta.label} <strong>${ids.length}</strong></h4>
        <div class="bdo-world-relations__objects">${links || '<span>Подтверждённых связей пока нет</span>'}</div>${route}</div>
      </article>`;
    }).join('');

    section.innerHTML = `<header><p>Knowledge Graph · v0.1</p><h4>Связи мира</h4></header><div class="bdo-world-relations__grid">${cards}</div>`;
    return section;
  };

  const createKnowledgeChain = (entityType, entity, graph) => {
    const chain = (graph.knowledgeChains || []).find((entry) =>
      entry.rootEntity?.type === entityType && entry.rootEntity?.id === entity.id);
    if (!chain) return null;

    const section = document.createElement('section');
    section.className = 'bdo-knowledge-chain';
    section.setAttribute('aria-label', chain.title);

    const stages = chain.stages.map((stage, index) => {
      const meta = graph.entityTypes[stage.type];
      const entities = graph.entities[stage.type] || [];
      const names = stage.entityIds.map((id) => entities.find((entry) => entry.id === id)?.name).filter(Boolean);
      const isVerified = stage.status === 'verified';
      const target = stage.entityIds.length === 1 ? `#${encodeURIComponent(stage.entityIds[0])}` : '';
      const content = isVerified ? names.join(', ') : 'Ожидает подтверждённых данных';
      const link = meta.route
        ? `<a href="${meta.route}${target}">${isVerified ? 'Открыть запись' : 'Перейти в слой'} →</a>`
        : '<span>Маршрут зарезервирован</span>';
      const connector = index < chain.stages.length - 1 ? '<i aria-hidden="true">↓</i>' : '';
      return `<li class="${isVerified ? 'is-verified' : 'is-awaiting'}">
        <article><span class="bdo-knowledge-chain__icon" aria-hidden="true">${meta.icon}</span><div>
          <p>${meta.label}</p><strong>${content}</strong>${link}
        </div></article>${connector}</li>`;
    }).join('');

    section.innerHTML = `<header><p>First Knowledge Chain · v0.1</p><h4>${chain.title}</h4><span>1 подтверждённая ступень · ложных связей нет</span><a class="bdo-knowledge-chain__explorer-link" href="bdo-knowledge-chain.html?chain=${encodeURIComponent(chain.id)}">Исследовать всю цепочку →</a></header><ol>${stages}</ol>`;
    return section;
  };

  window.BdoWorldRelations = {
    attach(container, entityType, entity) {
      if (!container) return;
      loadGraph().then((graph) => {
        const chain = createKnowledgeChain(entityType, entity, graph);
        if (chain) container.append(chain);
        container.append(createWorldRelations(entityType, entity, graph));
      }).catch(() => {
        container.dataset.relationsState = 'unavailable';
      });
    }
  };
})();
