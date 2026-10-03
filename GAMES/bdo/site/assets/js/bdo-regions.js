(() => {
  const grid = document.getElementById('bdoRegionGrid');
  const search = document.getElementById('regionArchiveSearch');
  const count = document.getElementById('regionArchiveResultCount');
  const total = document.getElementById('regionArchiveTotal');
  const cityTotal = document.getElementById('regionCityTotal');
  const nodeTotal = document.getElementById('regionNodeTotal');
  const liveState = document.getElementById('regionLiveState');
  const empty = document.getElementById('regionArchiveEmptyState');

  if (!grid || !search || !count || !total || !cityTotal || !nodeTotal || !liveState || !empty || !window.StartWaveBdoData?.loadRegions) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const statusLabels = { curated: 'Архивная запись', active: 'Активно', verified: 'Подтверждено' };
  let allRegions = [];

  const createRelationSection = (title, entries, route, emptyText) => `
    <section>
      <h4>${escapeHtml(title)} · ${entries.length}</h4>
      ${entries.length
        ? `<ul>${entries.map((entry) => `<li><a href="${route}#${encodeURIComponent(entry.id)}">${escapeHtml(entry.name || entry.id)}</a></li>`).join('')}</ul>`
        : `<p class="bdo-item-detail-empty">${escapeHtml(emptyText)}</p>`}
    </section>`;

  const createCard = (region) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-region-record';
    article.id = region.id;
    article.dataset.regionId = region.id;
    article.dataset.cityCount = String(region.cities.length);
    article.dataset.nodeCount = String(region.nodes.length);
    article.innerHTML = `
      <header class="bdo-resource-record__header">
        <span class="bdo-resource-record__glyph" aria-hidden="true">🗺</span>
        <div><p class="bdo-resource-record__eyebrow">Region record</p><h3>${escapeHtml(region.name)}</h3></div>
        <span class="bdo-resource-record__status"><i aria-hidden="true"></i>${escapeHtml(statusLabels[region.status] || region.status || '—')}</span>
      </header>
      <dl class="bdo-resource-record__facts">
        <div><dt>ID</dt><dd><code>${escapeHtml(region.id)}</code></dd></div>
        ${region.regionType ? `<div><dt>Тип</dt><dd>${escapeHtml(region.regionType)}</dd></div>` : ''}
        ${region.nameEn ? `<div><dt>English</dt><dd>${escapeHtml(region.nameEn)}</dd></div>` : ''}
      </dl>
      <div class="bdo-item-record__details" aria-label="Подтверждённые связи региона">
        ${createRelationSection('Города', region.cities, '/cities', 'Города пока не связаны')}
        ${createRelationSection('Узлы', region.nodes, '/nodes', 'Узлы пока не связаны')}
      </div>`;
    return article;
  };

  const render = () => {
    const query = normalize(search.value);
    const regions = allRegions.filter((region) => normalize([
      region.id,
      region.name,
      region.nameEn,
      region.regionType,
      region.status,
      ...region.cities.flatMap((city) => [city.id, city.name, city.nameEn, city.cityType]),
      ...region.nodes.flatMap((node) => [node.id, node.name, node.nameEn, node.nodeType])
    ].join(' ')).includes(query));
    grid.replaceChildren(...regions.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `${regions.length} из ${allRegions.length} регионов`;
    empty.hidden = regions.length !== 0;
    empty.textContent = allRegions.length ? 'Регионов по этому запросу нет.' : 'Регионы не найдены';
  };

  grid.setAttribute('aria-busy', 'true');
  window.StartWaveBdoData.loadRegions()
    .then((regions) => {
      allRegions = regions;
      total.textContent = String(allRegions.length);
      cityTotal.textContent = String(allRegions.reduce((sum, region) => sum + region.cities.length, 0));
      nodeTotal.textContent = String(allRegions.reduce((sum, region) => sum + region.nodes.length, 0));
      liveState.textContent = allRegions.length
        ? 'Список регионов загружен из LIVE Supabase.'
        : 'LIVE Supabase не вернул регионы.';
      render();
      search.addEventListener('input', render);
    })
    .catch(() => {
      grid.setAttribute('aria-busy', 'false');
      count.textContent = 'Данные недоступны';
      total.textContent = '—';
      cityTotal.textContent = '—';
      nodeTotal.textContent = '—';
      liveState.textContent = 'Не удалось загрузить LIVE-данные регионов.';
      empty.hidden = false;
      empty.textContent = 'Не удалось загрузить каталог регионов.';
    });
})();
