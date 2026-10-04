(() => {
  const grid = document.getElementById('bdoItemGrid');
  const search = document.getElementById('itemArchiveSearch');
  const count = document.getElementById('itemArchiveResultCount');
  const total = document.getElementById('itemArchiveTotalCount');
  const relationCount = document.getElementById('itemArchiveRelationCount');
  const moduleCount = document.getElementById('itemArchiveModuleCount');
  const categories = document.getElementById('itemArchiveCategories');
  const clear = document.getElementById('itemArchiveClear');
  const empty = document.getElementById('itemArchiveEmptyState');
  if (!grid || !search || !count || !total || !relationCount || !moduleCount || !categories || !clear || !empty) return;

  const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();
  const statusLabels = { unresearched: 'Не исследовано', researching: 'Исследуется', verified: 'Проверено', curated: 'Архивная запись', active: 'Активно' };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  const glyphs = { 'Материалы': '◆', 'Инструменты': '⚒', 'Кулинария': '♨', 'Алхимия': '⚗', 'Торговля': '◈' };
  const marketRegions = ['ru', 'eu', 'na'];
  const marketNumber = new Intl.NumberFormat('ru-RU');
  const externalIdentities = new Map();
  const selectedMarketRegions = new Map();
  const marketCache = new Map();
  const marketRequests = new Map();

  const getMarketData = (externalItemId, region, refresh = false) => {
    const cacheKey = `${externalItemId}:${region}`;
    if (!refresh && marketCache.has(cacheKey)) return Promise.resolve(marketCache.get(cacheKey));
    if (!refresh && marketRequests.has(cacheKey)) return marketRequests.get(cacheKey);

    const request = window.StartWaveBdoData.loadBdoCurrentMarket(externalItemId, region)
      .then((market) => {
        marketCache.set(cacheKey, market);
        return market;
      })
      .finally(() => {
        if (marketRequests.get(cacheKey) === request) marketRequests.delete(cacheKey);
      });
    marketRequests.set(cacheKey, request);
    return request;
  };

  const createMarketPanel = (item, identity) => {
    const panel = document.createElement('section');
    panel.className = 'bdo-item-market';
    panel.setAttribute('aria-label', `Central Market: ${item.name}`);
    const selectedRegion = selectedMarketRegions.get(item.id) || 'ru';
    panel.innerHTML = `
      <header class="bdo-item-market__header"><div><p>BDO Market</p><h4>Central Market / Аукцион</h4></div><div class="bdo-item-market__regions" role="group" aria-label="Регион рынка">${marketRegions.map((region) => `<button type="button" data-market-region="${region}" aria-pressed="${region === selectedRegion}">${region.toUpperCase()}</button>`).join('')}</div></header>
      <div class="bdo-item-market__content" aria-live="polite"></div>
      <footer class="bdo-item-market__footer"><span class="bdo-item-market__freshness"></span><button class="bdo-item-market__refresh" type="button">Обновить</button></footer>`;

    const content = panel.querySelector('.bdo-item-market__content');
    const freshness = panel.querySelector('.bdo-item-market__freshness');
    const refreshButton = panel.querySelector('.bdo-item-market__refresh');
    const regionButtons = [...panel.querySelectorAll('[data-market-region]')];
    let currentRegion = selectedRegion;
    let renderVersion = 0;

    const renderMarket = (refresh = false) => {
      const requestedRegion = currentRegion;
      const version = ++renderVersion;
      content.className = 'bdo-item-market__content is-loading';
      content.textContent = 'Загрузка данных рынка…';
      freshness.textContent = '';
      refreshButton.disabled = true;

      getMarketData(identity.externalItemId, requestedRegion, refresh).then((market) => {
        if (version !== renderVersion || requestedRegion !== currentRegion) return;
        content.className = 'bdo-item-market__content';
        content.innerHTML = `<dl class="bdo-item-market__values"><div><dt>Цена</dt><dd>${marketNumber.format(market.basePrice)}</dd></div><div><dt>На рынке</dt><dd>${marketNumber.format(market.currentStock)}</dd></div><div><dt>Всего сделок</dt><dd>${marketNumber.format(market.totalTrades)}</dd></div></dl>`;
        const observedAt = new Date(market.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        freshness.textContent = `Обновлено ${observedAt} · данные могут запаздывать до 30 минут`;
      }).catch((error) => {
        if (version !== renderVersion || requestedRegion !== currentRegion) return;
        content.className = 'bdo-item-market__content is-unavailable';
        if (error?.code === 'MARKET_EMPTY') {
          content.textContent = 'Данные для этого предмета не найдены';
        } else if (error?.code === 'MARKET_NETWORK_ERROR' || error?.code === 'MARKET_TIMEOUT') {
          content.textContent = 'Не удалось получить данные рынка';
        } else {
          content.textContent = 'Данные рынка временно недоступны';
        }
      }).finally(() => {
        if (version === renderVersion && requestedRegion === currentRegion) refreshButton.disabled = false;
      });
    };

    regionButtons.forEach((button) => button.addEventListener('click', () => {
      currentRegion = button.dataset.marketRegion;
      selectedMarketRegions.set(item.id, currentRegion);
      regionButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
      renderMarket();
    }));
    refreshButton.addEventListener('click', () => renderMarket(true));
    renderMarket();
    return panel;
  };

  const createCard = (item) => {
    const article = document.createElement('article');
    article.className = 'bdo-resource-record bdo-item-record';
    article.id = item.id;
    article.dataset.itemId = item.id;
    article.innerHTML = `
      <header class="bdo-resource-record__header"><span class="bdo-resource-record__glyph" aria-hidden="true">${glyphs[item.category] || '📦'}</span><div><p class="bdo-resource-record__eyebrow">${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div><span class="bdo-resource-record__status"><i aria-hidden="true"></i>${escapeHtml(statusLabels[item.status] || item.status)}</span></header>
      <dl class="bdo-resource-record__facts"><div><dt>ID</dt><dd><code>${escapeHtml(item.id)}</code></dd></div><div><dt>Тип</dt><dd>${escapeHtml(item.itemType)}</dd></div></dl>`;
    const identity = externalIdentities.get(item.id);
    if (identity?.provider === 'bdo' && identity.externalItemId) {
      article.append(createMarketPanel(item, identity));
    }
    window.BdoWorldRelations?.attach(article, 'item', item);
    return article;
  };

  let activeCategory = 'Все';
  let allItems = [];
  const pluralize = (value) => value % 10 === 1 && value % 100 !== 11 ? 'предмет' : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 'предмета' : 'предметов';

  const render = () => {
    const query = normalize(search.value);
    const items = allItems.filter((item) => {
      const categoryMatches = activeCategory === 'Все' || item.category === activeCategory;
      const haystack = `${item.name} ${item.nameEn ?? ''} ${item.category} ${item.itemType} ${item.id}`;
      return categoryMatches && normalize(haystack).includes(query);
    });
    grid.replaceChildren(...items.map(createCard));
    grid.setAttribute('aria-busy', 'false');
    count.textContent = `Показано ${items.length} из ${allItems.length}`;
    empty.hidden = items.length !== 0;
  };

  const renderCategories = () => {
    const names = ['Все', ...new Set(allItems.map((item) => item.category))];
    categories.replaceChildren(...names.map((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdo-item-category';
      button.textContent = name;
      button.setAttribute('aria-pressed', String(name === activeCategory));
      button.addEventListener('click', () => { activeCategory = name; renderCategories(); render(); });
      return button;
    }));
  };

  relationCount.hidden = true;
  moduleCount.hidden = true;
  window.StartWaveBdoData.loadItems().then((items) => {
    allItems = items;
    total.textContent = `${allItems.length} ${pluralize(allItems.length)}`;
    renderCategories();
    render();
    search.addEventListener('input', render);
    clear.addEventListener('click', () => { search.value = ''; activeCategory = 'Все'; renderCategories(); render(); search.focus(); });
    window.StartWaveBdoData.loadBdoExternalIdentities().then((identities) => {
      identities.forEach((identity) => {
        if (identity.provider === 'bdo' && identity.itemId && identity.externalItemId) {
          externalIdentities.set(identity.itemId, identity);
        }
      });
      render();
    }).catch(() => {});
  }).catch(() => {
    grid.setAttribute('aria-busy', 'false');
    count.textContent = 'Данные недоступны';
    empty.hidden = false;
    empty.textContent = 'Не удалось загрузить архив предметов.';
  });
})();
