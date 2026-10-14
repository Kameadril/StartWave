(() => {
  const detail = document.getElementById('databaseDetail');
  const state = document.getElementById('databaseState');
  const record = document.getElementById('databaseRecord');
  const itemName = document.getElementById('databaseItemName');
  const itemNameEn = document.getElementById('databaseItemNameEn');
  const itemId = document.getElementById('databaseItemId');
  const bdoId = document.getElementById('databaseBdoId');
  const semanticType = document.getElementById('databaseSemanticType');
  const definition = document.getElementById('databaseDefinition');
  const relationships = document.getElementById('databaseRelationships');
  const market = document.getElementById('databaseMarket');
  const marketRefresh = document.getElementById('databaseMarketRefresh');
  const auctionLink = document.getElementById('databaseAuctionLink');
  const canonicalLink = document.getElementById('databaseItemLink');
  const oreToggle = document.getElementById('databaseOreToggle');
  const oreBranch = document.getElementById('databaseOreBranch');
  const itemButtons = [...document.querySelectorAll('[data-database-item]')];
  if (!detail || !state || !record || !itemName || !itemNameEn || !itemId || !bdoId || !semanticType || !definition || !relationships || !market || !marketRefresh || !auctionLink || !canonicalLink || !oreToggle || !oreBranch || itemButtons.length !== 3) return;

  const number = new Intl.NumberFormat('ru-RU');
  const supportedItemIds = new Set(itemButtons.map((button) => button.dataset.databaseItem));
  const definitions = new Map(itemButtons.map((button) => [button.dataset.databaseItem, button.dataset.semanticType]));
  const verifiedYieldRanges = new Map([
    ['SW-RECIPE-019', '1–4'],
    ['SW-RECIPE-020', '1–4']
  ]);
  let itemsById = new Map();
  let identitiesByItemId = new Map();
  let recipes = [];
  let selectedItemId = null;
  let renderVersion = 0;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const setSelectedButton = () => itemButtons.forEach((button) => {
    const selected = button.dataset.databaseItem === selectedItemId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const recipeFormula = (recipe) => {
    const inputs = recipe.inputs.map((input) => {
      const inputItem = itemsById.get(input.itemId);
      return `${escapeHtml(inputItem?.name || input.itemId)} ×${escapeHtml(input.quantity ?? '—')}`;
    }).join(' + ');
    const resultItem = itemsById.get(recipe.resultItemId);
    const resultQuantity = verifiedYieldRanges.get(recipe.id) || recipe.resultQuantity || 'не указано';
    return `<article><p>${inputs} <span aria-hidden="true">→</span> ${escapeHtml(resultItem?.name || recipe.resultItemId)} ×${escapeHtml(resultQuantity)}</p><small>${escapeHtml(recipe.method || 'Метод не указан')}${recipe.workplace ? ` · ${escapeHtml(recipe.workplace)}` : ''}${verifiedYieldRanges.has(recipe.id) ? ' · выход зависит от мастерства' : ''}</small></article>`;
  };

  const renderRelationships = () => {
    const relatedRecipes = recipes.filter((recipe) => recipe.resultItemId === selectedItemId || recipe.inputs.some((input) => input.itemId === selectedItemId));
    relationships.innerHTML = relatedRecipes.length
      ? relatedRecipes.map(recipeFormula).join('')
      : '<p class="bdo-database-empty">Для этого этапа нет дополнительных подтверждённых связей.</p>';
  };

  const loadMarket = (refresh = false) => {
    const version = ++renderVersion;
    const identity = identitiesByItemId.get(selectedItemId);
    if (!identity) {
      market.className = 'is-unavailable';
      market.textContent = 'BDO-идентичность не найдена.';
      return;
    }
    marketRefresh.disabled = true;
    market.className = 'is-loading';
    market.textContent = refresh ? 'Обновление данных рынка…' : 'Загрузка данных рынка…';
    window.StartWaveBdoData.loadBdoCurrentMarket(identity.externalItemId, 'ru').then((observation) => {
      if (version !== renderVersion) return;
      market.className = '';
      market.innerHTML = `<dl><div><dt>Цена</dt><dd>${number.format(observation.basePrice)}</dd></div><div><dt>На рынке</dt><dd>${number.format(observation.currentStock)}</dd></div><div><dt>Всего сделок</dt><dd>${number.format(observation.totalTrades)}</dd></div></dl><small>Получено ${new Date(observation.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · источник может запаздывать</small>`;
    }).catch(() => {
      if (version !== renderVersion) return;
      market.className = 'is-unavailable';
      market.textContent = 'Данные рынка временно недоступны.';
    }).finally(() => {
      if (version === renderVersion) marketRefresh.disabled = false;
    });
  };

  const render = () => {
    const item = itemsById.get(selectedItemId);
    const identity = identitiesByItemId.get(selectedItemId);
    if (!item || !identity) {
      record.hidden = true;
      state.hidden = false;
      state.textContent = 'Канонические данные выбранного предмета недоступны.';
      detail.setAttribute('aria-busy', 'false');
      return;
    }
    itemName.textContent = item.name;
    itemNameEn.textContent = item.nameEn || '';
    itemNameEn.hidden = !item.nameEn;
    itemId.textContent = item.id;
    bdoId.textContent = identity.externalItemId;
    semanticType.textContent = `Определение · ${definitions.get(item.id)}`;
    definition.textContent = definitions.get(item.id);
    auctionLink.href = `/auction#${encodeURIComponent(item.id)}`;
    canonicalLink.href = `/items#${encodeURIComponent(item.id)}`;
    itemButtons.find((button) => button.dataset.databaseItem === item.id).textContent = item.name;
    setSelectedButton();
    renderRelationships();
    state.hidden = true;
    record.hidden = false;
    detail.setAttribute('aria-busy', 'false');
    loadMarket();
  };

  const selectItem = (nextItemId, updateHash = true) => {
    if (!supportedItemIds.has(nextItemId) || !itemsById.has(nextItemId)) return;
    selectedItemId = nextItemId;
    if (updateHash && window.location.hash.slice(1) !== nextItemId) window.history.replaceState(null, '', `#${encodeURIComponent(nextItemId)}`);
    render();
  };

  itemButtons.forEach((button) => button.addEventListener('click', () => selectItem(button.dataset.databaseItem)));
  oreToggle.addEventListener('click', () => {
    const expanded = oreToggle.getAttribute('aria-expanded') === 'true';
    oreToggle.setAttribute('aria-expanded', String(!expanded));
    oreBranch.hidden = expanded;
  });
  marketRefresh.addEventListener('click', () => loadMarket(true));
  window.addEventListener('hashchange', () => selectItem(decodeURIComponent(window.location.hash.slice(1)), false));

  Promise.all([
    window.StartWaveBdoData.loadItems(),
    window.StartWaveBdoData.loadBdoExternalIdentities(),
    window.StartWaveBdoData.loadRecipes()
  ]).then(([items, identities, loadedRecipes]) => {
    itemsById = new Map(items.filter((item) => supportedItemIds.has(item.id)).map((item) => [item.id, item]));
    identitiesByItemId = new Map(identities.filter((identity) => identity.provider === 'bdo' && supportedItemIds.has(identity.itemId)).map((identity) => [identity.itemId, identity]));
    recipes = loadedRecipes.filter((recipe) => recipe.id === 'SW-RECIPE-019' || recipe.id === 'SW-RECIPE-020');
    if (itemsById.size !== 3 || identitiesByItemId.size !== 3 || recipes.length !== 2) throw new Error('Incomplete zinc reference data');
    const requestedItemId = decodeURIComponent(window.location.hash.slice(1));
    selectItem(supportedItemIds.has(requestedItemId) ? requestedItemId : itemButtons[0].dataset.databaseItem);
  }).catch(() => {
    detail.setAttribute('aria-busy', 'false');
    state.textContent = 'Не удалось загрузить подтверждённую цинковую ветку.';
  });
})();
