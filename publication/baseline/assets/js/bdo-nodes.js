(() => {
  const grid = document.getElementById('bdoNodeGrid');
  const search = document.getElementById('nodeArchiveSearch');
  const count = document.getElementById('nodeArchiveResultCount');
  const empty = document.getElementById('nodeArchiveEmptyState');
  const mapState = document.getElementById('nodeMapState');
  if (!grid || !search || !count || !empty || !mapState || !window.StartWaveBdoData?.loadNodes) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const statusLabels = { curated: 'Архивная запись', active: 'Активно', verified: 'Подтверждено' };
  let allNodes = [];

  const createCard = (node) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-node-record';
    article.id = node.id;
    article.dataset.nodeId = node.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">🌲</span><div><p class="bdo-resource-record__eyebrow">Node record</p><h3>${escapeHtml(node.name)}</h3></div><span class="bdo-resource-record__status">${escapeHtml(statusLabels[node.status] || node.status)}</span></header>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${escapeHtml(node.id)}</code></dd></div><div><dt>Регион</dt><dd>${escapeHtml(node.region || node.regionId || '—')}</dd></div><div><dt>Тип</dt><dd>${escapeHtml(node.nodeType || '—')}</dd></div>${node.nameEn ? `<div><dt>English</dt><dd>${escapeHtml(node.nameEn)}</dd></div>` : ''}</dl>`;
    return article;
  };

  const render = () => {
    const query = normalize(search.value);
    const nodes = allNodes.filter((node) => normalize(`${node.name} ${node.nameEn ?? ''} ${node.nodeType ?? ''} ${node.region ?? ''} ${node.regionId ?? ''} ${node.id}`).includes(query));
    grid.replaceChildren(...nodes.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `${nodes.length} из ${allNodes.length}`;
    empty.hidden = nodes.length !== 0;
  };

  grid.setAttribute('aria-busy', 'true');
  window.StartWaveBdoData.loadNodes().then((nodes) => {
    allNodes = nodes;
    mapState.textContent = 'Список узлов загружен из LIVE Supabase.';
    render();
    search.addEventListener('input', render);
  }).catch(() => {
    grid.setAttribute('aria-busy', 'false');
    count.textContent = 'Данные недоступны';
    empty.hidden = false;
    empty.textContent = 'Не удалось загрузить список узлов.';
  });
})();
