(() => {
  const grid = document.getElementById('bdoNodeGrid');
  const search = document.getElementById('nodeArchiveSearch');
  const count = document.getElementById('nodeArchiveResultCount');
  const empty = document.getElementById('nodeArchiveEmptyState');
  const mapState = document.getElementById('nodeMapState');

  if (!grid || !search || !count || !empty || !mapState) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Подтверждено' };
  const listCount = (value) => Array.isArray(value) ? value.length : 0;

  const createCard = (node) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-node-record';
    article.id = node.id;
    article.dataset.nodeId = node.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">🗺</span>
        <div><p class="bdo-resource-record__eyebrow">Node record</p><h3>${node.name}</h3></div>
        <span class="bdo-resource-record__status">${statusLabels[node.status] || node.status}</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${node.id}</code></dd></div>
        <div><dt>Регион</dt><dd>${node.region}</dd></div>
        <div><dt>Тип</dt><dd>${node.nodeType}</dd></div>
        <div><dt>Координаты</dt><dd>${node.coordinates === null ? 'Не подтверждены' : 'Подтверждены'}</dd></div>
        <div><dt>Источник</dt><dd>${node.source}</dd></div>
        <div><dt>Дата проверки</dt><dd><time datetime="${node.checkedAt}">${node.checkedAt}</time></dd></div>
      </dl>
      <div class="bdo-resource-record__relations" aria-label="Связи узла">
        <span class="bdo-resource-record__relations-title">Подтверждённые связи</span>
        <span>Ресурсы: <strong>${listCount(node.resources)}</strong></span>
        <span>Рабочие: <strong>${listCount(node.workers)}</strong></span>
        <span>Производство: <strong>${listCount(node.production)}</strong></span>
        <span>Изображения: <strong>${listCount(node.images)}</strong></span>
      </div>`;
    window.BdoWorldRelations?.attach(article, 'node', node);
    return article;
  };

  const render = (nodes) => {
    grid.replaceChildren(...nodes.map(createCard));
    count.textContent = `${nodes.length} записей`;
    empty.hidden = nodes.length !== 0;
  };

  fetch('../assets/data/bdo-nodes.json')
    .then((response) => {
      if (!response.ok) throw new Error(`Node data request failed: ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      render(nodes);
      mapState.textContent = nodes.some((node) => node.coordinates !== null)
        ? 'Для карты доступны подтверждённые точки.'
        : 'Карта ожидает подтверждённых координат.';
      search.addEventListener('input', () => {
        const query = normalize(search.value);
        render(nodes.filter((node) => normalize(`${node.name} ${node.region} ${node.nodeType} ${node.id} ${node.status}`).includes(query)));
      });
    })
    .catch(() => {
      grid.setAttribute('aria-busy', 'false');
      count.textContent = 'Данные недоступны';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить архив узлов.';
    });
})();
