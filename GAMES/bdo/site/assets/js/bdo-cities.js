(() => {
  const grid = document.getElementById('bdoCityGrid');
  const search = document.getElementById('cityArchiveSearch');
  const count = document.getElementById('cityArchiveResultCount');
  const empty = document.getElementById('cityArchiveEmptyState');
  const mapState = document.getElementById('cityMapState');
  if (!grid || !search || !count || !empty || !mapState || !window.StartWaveBdoData?.loadCities) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const statusLabels = { curated: 'Архивная запись', active: 'Активно', verified: 'Подтверждено' };
  let allCities = [];

  const createCard = (city) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-city-record';
    article.id = city.id;
    article.dataset.cityId = city.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">🏰</span><div><p class="bdo-resource-record__eyebrow">City record</p><h3>${escapeHtml(city.name)}</h3></div><span class="bdo-resource-record__status">${escapeHtml(statusLabels[city.status] || city.status)}</span></header>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${escapeHtml(city.id)}</code></dd></div><div><dt>Регион</dt><dd>${escapeHtml(city.regionId || '—')}</dd></div><div><dt>Тип</dt><dd>${escapeHtml(city.cityType || '—')}</dd></div>${city.nameEn ? `<div><dt>English</dt><dd>${escapeHtml(city.nameEn)}</dd></div>` : ''}</dl>`;
    return article;
  };

  const render = () => {
    const query = normalize(search.value);
    const cities = allCities.filter((city) => normalize(`${city.name} ${city.nameEn ?? ''} ${city.cityType ?? ''} ${city.regionId ?? ''} ${city.id}`).includes(query));
    grid.replaceChildren(...cities.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `${cities.length} из ${allCities.length}`;
    empty.hidden = cities.length !== 0;
  };

  grid.setAttribute('aria-busy', 'true');
  window.StartWaveBdoData.loadCities().then((cities) => {
    allCities = cities;
    mapState.textContent = 'Список городов загружен из LIVE Supabase.';
    render();
    search.addEventListener('input', render);
  }).catch(() => {
    grid.setAttribute('aria-busy', 'false');
    count.textContent = 'Данные недоступны';
    empty.hidden = false;
    empty.textContent = 'Не удалось загрузить список городов.';
  });
})();
