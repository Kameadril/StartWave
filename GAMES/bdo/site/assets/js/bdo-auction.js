(() => {
  const results = document.getElementById('auctionResults');
  const state = document.getElementById('auctionState');
  const search = document.getElementById('auctionSearch');
  const resultCount = document.getElementById('auctionResultCount');
  const mappedCount = document.getElementById('auctionMappedCount');
  const pagination = document.getElementById('auctionPagination');
  const refreshButton = document.getElementById('auctionRefresh');
  const regionButtons = [...document.querySelectorAll('[data-auction-region]')];
  const categoryButtons = [...document.querySelectorAll('[data-auction-category]')];
  const categoryLabel = document.getElementById('auctionCategoryLabel');
  const materialsToggle = document.getElementById('auctionMaterialsToggle');
  const materialsCategories = document.getElementById('auctionMaterialsCategories');
  if (!results || !state || !search || !resultCount || !mappedCount || !pagination || !refreshButton || !categoryLabel || !materialsToggle || !materialsCategories || regionButtons.length !== 3 || categoryButtons.length !== 2) return;

  const PAGE_SIZE = 10;
  const CONCURRENCY_LIMIT = 3;
  const supportedRegions = new Set(['ru', 'eu', 'na']);
  const marketNumber = new Intl.NumberFormat('ru-RU');
  const marketCache = new Map();
  const marketRequests = new Map();
  const queue = [];
  const oreItemTypes = new Set(['Руда', 'Минерал', 'Грубый минерал']);
  const categoryDefinitions = {
    all: { label: 'Все подтверждённые', includes: () => true },
    'materials-ore': { label: 'Материалы · Руда/драг. камни', includes: ({ item }) => oreItemTypes.has(item.itemType) }
  };
  let activeRequests = 0;
  let mappedItems = [];
  let selectedRegion = 'ru';
  let selectedCategory = 'all';
  let currentPage = 1;
  let renderVersion = 0;

  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru-RU');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const pluralize = (value) => value % 10 === 1 && value % 100 !== 11 ? 'предмет' : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? 'предмета' : 'предметов';

  const runQueue = () => {
    while (activeRequests < CONCURRENCY_LIMIT && queue.length) {
      activeRequests += 1;
      const job = queue.shift();
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        activeRequests -= 1;
        runQueue();
      });
    }
  };

  const enqueue = (task) => new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    runQueue();
  });

  const getMarketData = (externalItemId, region, refresh = false) => {
    const cacheKey = `${externalItemId}:${region}`;
    if (!refresh && marketCache.has(cacheKey)) return Promise.resolve(marketCache.get(cacheKey));
    if (marketRequests.has(cacheKey)) return marketRequests.get(cacheKey);

    const request = enqueue(() => window.StartWaveBdoData.loadBdoCurrentMarket(externalItemId, region))
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

  const visibleItems = () => {
    const query = normalize(search.value);
    const category = categoryDefinitions[selectedCategory] || categoryDefinitions.all;
    const inCategory = mappedItems.filter(category.includes);
    const filtered = inCategory.filter(({ item }) => normalize(`${item.name} ${item.nameEn ?? ''} ${item.id}`).includes(query));
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    const offset = (currentPage - 1) * PAGE_SIZE;
    return { filtered, pageCount, items: filtered.slice(offset, offset + PAGE_SIZE) };
  };

  const marketErrorMessage = (error) => {
    if (error?.code === 'MARKET_EMPTY') return 'Данные для этого предмета не найдены.';
    if (error?.code === 'MARKET_NETWORK_ERROR' || error?.code === 'MARKET_TIMEOUT') return 'Не удалось получить данные рынка.';
    return 'Данные рынка временно недоступны.';
  };

  const createCard = ({ item, identity }) => {
    const article = document.createElement('article');
    article.className = 'bdo-auction-card';
    article.dataset.itemId = item.id;
    article.innerHTML = `
      <div class="bdo-auction-card__identity"><p class="bdo-resource-record__eyebrow">Канонический предмет StartWave</p><h3>${escapeHtml(item.name)}</h3>${item.nameEn ? `<p class="bdo-auction-card__name-en">${escapeHtml(item.nameEn)}</p>` : ''}<code>${escapeHtml(item.id)}</code></div>
      <div class="bdo-auction-card__market is-loading" aria-live="polite">Загрузка данных рынка…</div>
      <div class="bdo-auction-card__meta"><span class="bdo-auction-card__freshness"></span><a href="/items#${encodeURIComponent(item.id)}">Открыть предмет →</a></div>`;
    return { article, identity, market: article.querySelector('.bdo-auction-card__market'), freshness: article.querySelector('.bdo-auction-card__freshness') };
  };

  const renderPagination = (pageCount) => {
    if (pageCount <= 1) {
      pagination.hidden = true;
      pagination.replaceChildren();
      return;
    }
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = '← Назад';
    previous.disabled = currentPage === 1;
    previous.addEventListener('click', () => { currentPage -= 1; render(); });
    const label = document.createElement('span');
    label.textContent = `${currentPage} из ${pageCount}`;
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Вперёд →';
    next.disabled = currentPage === pageCount;
    next.addEventListener('click', () => { currentPage += 1; render(); });
    pagination.replaceChildren(previous, label, next);
    pagination.hidden = false;
  };

  const render = (refresh = false) => {
    const version = ++renderVersion;
    const { filtered, pageCount, items } = visibleItems();
    resultCount.textContent = `Показано ${items.length} из ${filtered.length}`;
    renderPagination(pageCount);

    if (!mappedItems.length) {
      results.replaceChildren();
      results.setAttribute('aria-busy', 'false');
      state.hidden = false;
      state.textContent = 'Подтверждённые предметы для аукциона пока не добавлены.';
      refreshButton.disabled = true;
      return;
    }
    if (!filtered.length) {
      results.replaceChildren();
      results.setAttribute('aria-busy', 'false');
      state.hidden = false;
      state.textContent = 'По запросу ничего не найдено.';
      refreshButton.disabled = true;
      return;
    }

    state.hidden = true;
    refreshButton.disabled = true;
    results.setAttribute('aria-busy', 'true');
    const cards = items.map(createCard);
    results.replaceChildren(...cards.map(({ article }) => article));
    let pending = cards.length;

    cards.forEach(({ identity, market, freshness }) => {
      getMarketData(identity.externalItemId, selectedRegion, refresh).then((observation) => {
        if (version !== renderVersion) return;
        market.className = 'bdo-auction-card__market';
        market.innerHTML = `<dl class="bdo-auction-metrics"><div><dt>Цена</dt><dd>${marketNumber.format(observation.basePrice)}</dd></div><div><dt>На рынке</dt><dd>${marketNumber.format(observation.currentStock)}</dd></div><div><dt>Всего сделок</dt><dd>${marketNumber.format(observation.totalTrades)}</dd></div></dl>`;
        const observedAt = new Date(observation.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        freshness.textContent = `Обновлено ${observedAt} · данные могут запаздывать до 30 минут`;
      }).catch((error) => {
        if (version !== renderVersion) return;
        market.className = 'bdo-auction-card__market is-unavailable';
        market.textContent = marketErrorMessage(error);
        freshness.textContent = '';
      }).finally(() => {
        if (version !== renderVersion) return;
        pending -= 1;
        if (pending === 0) {
          results.setAttribute('aria-busy', 'false');
          refreshButton.disabled = false;
        }
      });
    });
  };

  search.addEventListener('input', () => {
    currentPage = 1;
    render();
  });
  categoryButtons.forEach((button) => button.addEventListener('click', () => {
    const category = button.dataset.auctionCategory;
    if (!categoryDefinitions[category] || category === selectedCategory) return;
    selectedCategory = category;
    currentPage = 1;
    categoryButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', String(selected));
    });
    categoryLabel.textContent = categoryDefinitions[category].label;
    render();
  }));
  materialsToggle.addEventListener('click', () => {
    const expanded = materialsToggle.getAttribute('aria-expanded') === 'true';
    materialsToggle.setAttribute('aria-expanded', String(!expanded));
    materialsCategories.hidden = expanded;
  });
  regionButtons.forEach((button) => button.addEventListener('click', () => {
    const region = button.dataset.auctionRegion;
    if (!supportedRegions.has(region) || region === selectedRegion) return;
    selectedRegion = region;
    regionButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
    render();
  }));
  refreshButton.addEventListener('click', () => render(true));

  Promise.all([
    window.StartWaveBdoData.loadItems(),
    window.StartWaveBdoData.loadBdoExternalIdentities()
  ]).then(([items, identities]) => {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    mappedItems = identities
      .filter((identity) => identity.provider === 'bdo' && identity.itemId && identity.externalItemId && itemsById.has(identity.itemId))
      .map((identity) => ({ item: itemsById.get(identity.itemId), identity }))
      .sort((left, right) => left.item.name.localeCompare(right.item.name, 'ru-RU'));
    mappedCount.textContent = `${mappedItems.length} ${pluralize(mappedItems.length)}`;
    document.querySelector('[data-auction-category-count="all"]').textContent = mappedItems.length;
    document.querySelector('[data-auction-category-count="materials-ore"]').textContent = mappedItems.filter(categoryDefinitions['materials-ore'].includes).length;
    render();
  }).catch(() => {
    results.setAttribute('aria-busy', 'false');
    results.replaceChildren();
    resultCount.textContent = 'Данные недоступны';
    state.hidden = false;
    state.textContent = 'Не удалось загрузить подтверждённые BDO-связи.';
    refreshButton.disabled = true;
  });
})();
