(() => {
  const grid = document.getElementById('bdoResourceGrid');
  const search = document.getElementById('archiveSearch');
  const count = document.getElementById('archiveResultCount');
  const total = document.getElementById('resourceArchiveTotal');
  const liveState = document.getElementById('resourceLiveState');
  const empty = document.getElementById('archiveEmptyState');

  if (!grid || !search || !count || !total || !liveState || !empty || !window.StartWaveBdoData?.loadResources) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const statusLabels = { curated: 'Архивная запись', 'seed-list-verified': 'Подтверждено' };
  let allResources = [];

  const createRelationSection = (title, entries, route, emptyText) => `
    <section>
      <h4>${escapeHtml(title)} · ${entries.length}</h4>
      ${entries.length
        ? `<ul>${entries.map((entry) => `<li><a href="${route}#${encodeURIComponent(entry.id)}">${escapeHtml(entry.name || entry.id)}</a></li>`).join('')}</ul>`
        : `<p class="bdo-item-detail-empty">${escapeHtml(emptyText)}</p>`}
    </section>`;

  const createCard = (resource) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record';
    article.id = resource.id;
    article.dataset.resourceId = resource.id;
    article.dataset.nodeCount = String(resource.nodes.length);
    article.dataset.itemCount = String(resource.items.length);

    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">🌲</span>
        <div>
          <p class="bdo-resource-record__eyebrow">Resource record</p>
          <h3>${escapeHtml(resource.name)}</h3>
        </div>
        <span class="bdo-resource-record__status"><i aria-hidden="true"></i>${escapeHtml(statusLabels[resource.status] || resource.status || '—')}</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${escapeHtml(resource.id)}</code></dd></div>
        <div><dt>Категория</dt><dd>${escapeHtml(resource.category || '—')}</dd></div>
        <div><dt>Тип</dt><dd>${escapeHtml(resource.resourceType || '—')}</dd></div>
        ${resource.nameEn ? `<div><dt>English</dt><dd>${escapeHtml(resource.nameEn)}</dd></div>` : ''}
      </dl>
      <div class="bdo-item-record__details" aria-label="Подтверждённые связи ресурса">
        ${createRelationSection('Узлы', resource.nodes, '/nodes', 'Связанные узлы не найдены.')}
        ${createRelationSection('Предметы', resource.items, '/items', 'Связанные предметы не найдены.')}
      </div>`;

    return article;
  };

  const render = () => {
    const query = normalize(search.value);
    const resources = allResources.filter((resource) => normalize([
      resource.id,
      resource.name,
      resource.nameEn,
      resource.category,
      resource.resourceType,
      resource.status,
      ...resource.nodes.flatMap((node) => [node.id, node.name, node.nameEn, node.nodeType]),
      ...resource.items.flatMap((item) => [item.id, item.name, item.nameEn, item.category, item.itemType])
    ].join(' ')).includes(query));
    grid.replaceChildren(...resources.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `${resources.length} из ${allResources.length} ресурсов`;
    empty.hidden = resources.length !== 0;
  };

  grid.setAttribute('aria-busy', 'true');
  window.StartWaveBdoData.loadResources()
    .then((resources) => {
      allResources = resources;
      total.textContent = String(allResources.length);
      liveState.textContent = 'Список ресурсов загружен из LIVE Supabase.';
      render();
      search.addEventListener('input', render);
    })
    .catch(() => {
      grid.setAttribute('aria-busy', 'false');
      count.textContent = 'Данные недоступны';
      total.textContent = '—';
      liveState.textContent = 'Не удалось загрузить LIVE-данные ресурсов.';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить каталог ресурсов.';
    });
})();
