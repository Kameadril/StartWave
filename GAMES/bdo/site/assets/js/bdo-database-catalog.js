(() => {
  const detail = document.getElementById('databaseDetail');
  const state = document.getElementById('databaseState');
  const record = document.getElementById('databaseRecord');
  const search = document.getElementById('databaseSearch');
  const tree = document.getElementById('databaseTree');
  const visibleCount = document.getElementById('databaseVisibleCount');
  const typeCount = document.getElementById('databaseTypeCount');
  const itemName = document.getElementById('databaseItemName');
  const itemNameEn = document.getElementById('databaseItemNameEn');
  const itemId = document.getElementById('databaseItemId');
  const bdoId = document.getElementById('databaseBdoId');
  const auctionCategory = document.getElementById('databaseAuctionCategory');
  const semanticType = document.getElementById('databaseSemanticType');
  const definition = document.getElementById('databaseDefinition');
  const relationships = document.getElementById('databaseRelationships');
  const market = document.getElementById('databaseMarket');
  const marketRefresh = document.getElementById('databaseMarketRefresh');
  const auctionLink = document.getElementById('databaseAuctionLink');
  const canonicalLink = document.getElementById('databaseItemLink');
  if (!detail || !state || !record || !search || !tree || !visibleCount || !typeCount || !itemName || !itemNameEn || !itemId || !bdoId || !auctionCategory || !semanticType || !definition || !relationships || !market || !marketRefresh || !auctionLink || !canonicalLink) return;

  const number = new Intl.NumberFormat('ru-RU');
  const databaseCategories = new Set(['Материалы', 'Природный ресурс']);
  const verifiedYieldRanges = new Map([['SW-RECIPE-019', '1–4'], ['SW-RECIPE-020', '1–4']]);
  const mushroomItemIds = new Set(['SW-ITEM-078', 'SW-ITEM-079', 'SW-ITEM-080', 'SW-ITEM-081', 'SW-ITEM-082', 'SW-ITEM-083', 'SW-ITEM-084', 'SW-ITEM-085', 'SW-ITEM-086']);
  const auctionOreItemIds = new Set(['SW-ITEM-004', 'SW-ITEM-015', 'SW-ITEM-018', 'SW-ITEM-053', 'SW-ITEM-054', 'SW-ITEM-055', 'SW-ITEM-056', 'SW-ITEM-057', 'SW-ITEM-147', 'SW-ITEM-148']);
  const auctionPlantItemIds = new Set('SW-ITEM-001,SW-ITEM-002,SW-ITEM-013,SW-ITEM-014,SW-ITEM-016,SW-ITEM-019,SW-ITEM-020,SW-ITEM-021,SW-ITEM-022,SW-ITEM-025,SW-ITEM-027,SW-ITEM-029,SW-ITEM-031,SW-ITEM-033,SW-ITEM-035,SW-ITEM-037,SW-ITEM-039,SW-ITEM-041,SW-ITEM-042,SW-ITEM-044,SW-ITEM-058,SW-ITEM-059,SW-ITEM-060,SW-ITEM-061,SW-ITEM-062,SW-ITEM-063,SW-ITEM-064,SW-ITEM-065,SW-ITEM-066,SW-ITEM-067,SW-ITEM-068,SW-ITEM-069,SW-ITEM-070,SW-ITEM-071,SW-ITEM-072,SW-ITEM-073,SW-ITEM-074,SW-ITEM-075,SW-ITEM-076,SW-ITEM-077,SW-ITEM-078,SW-ITEM-079,SW-ITEM-080,SW-ITEM-081,SW-ITEM-082,SW-ITEM-083,SW-ITEM-084,SW-ITEM-085,SW-ITEM-086,SW-ITEM-087,SW-ITEM-088,SW-ITEM-100,SW-ITEM-101,SW-ITEM-102,SW-ITEM-103,SW-ITEM-104,SW-ITEM-105,SW-ITEM-106,SW-ITEM-107,SW-ITEM-108,SW-ITEM-125,SW-ITEM-133,SW-ITEM-135,SW-ITEM-136,SW-ITEM-137,SW-ITEM-138,SW-ITEM-139,SW-ITEM-140'.split(','));
  const auctionFruitItemIds = new Set('SW-ITEM-109,SW-ITEM-111,SW-ITEM-112,SW-ITEM-113,SW-ITEM-114,SW-ITEM-115,SW-ITEM-116,SW-ITEM-117,SW-ITEM-118,SW-ITEM-131,SW-ITEM-132'.split(','));
  const auctionVegetableItemIds = new Set(['SW-ITEM-110', 'SW-ITEM-124', 'SW-ITEM-127', 'SW-ITEM-128']);
  const auctionGrainItemIds = new Set(['SW-ITEM-119', 'SW-ITEM-120', 'SW-ITEM-121', 'SW-ITEM-122', 'SW-ITEM-123', 'SW-ITEM-126', 'SW-ITEM-129', 'SW-ITEM-130']);
  const auctionOtherItemIds = new Set(['SW-ITEM-006', 'SW-ITEM-007', 'SW-ITEM-134']);
  const auctionOreTypes = new Set(['Руда', 'Минерал', 'Грубый минерал']);
  const typeGroups = new Map([
    ['Руда', 'Металлы и минералы'], ['Кусок', 'Металлы и минералы'], ['Слиток', 'Металлы и минералы'], ['Порошок', 'Металлы и минералы'], ['Пыль', 'Металлы и минералы'], ['Минерал', 'Металлы и минералы'], ['Грубый минерал', 'Металлы и минералы'], ['Обработанный камень', 'Металлы и минералы'],
    ['Бревно', 'Древесина'], ['Древесина', 'Древесина'], ['Пиломатериал', 'Древесина'], ['Фанера', 'Древесина'], ['Кора', 'Древесина'],
    ['Лист', 'Растительные ресурсы'], ['Трава', 'Растительные ресурсы'], ['Цветок', 'Растительные ресурсы'], ['Гриб', 'Растительные ресурсы'], ['Сок', 'Растительные ресурсы'], ['Растение', 'Растительные ресурсы'], ['Техническая культура', 'Растительные ресурсы'],
    ['Фрукт', 'Пищевые ресурсы'], ['Овощ', 'Пищевые ресурсы'], ['Зерно', 'Пищевые ресурсы'], ['Пряность', 'Пищевые ресурсы'],
    ['Волокно', 'Текстиль'], ['Ткань', 'Текстиль']
  ]);
  const directTypes = new Map([
    ['Руда', 'Руда'], ['Кусок', 'Кусок'], ['Слиток', 'Слиток'], ['Пыль', 'Пыль'], ['Минерал', 'Минерал'], ['Грубый минерал', 'Грубый минерал'], ['Обработанный камень', 'Обработанный камень'],
    ['Древесина', 'Древесина'], ['Древесный ресурс', 'Древесина'], ['Пиломатериал', 'Пиломатериал'], ['Кора', 'Кора'],
    ['Сок', 'Сок'], ['Гриб', 'Гриб'], ['Цветок', 'Цветок'], ['Плод', 'Фрукт'], ['Овощная культура', 'Овощ'], ['Зерновая культура', 'Зерно'], ['Пряность', 'Пряность'], ['Техническая культура', 'Техническая культура'], ['Растение', 'Растение'], ['Растительное волокно', 'Волокно'], ['Ткань', 'Ткань']
  ]);
  const groupOrder = ['Металлы и минералы', 'Древесина', 'Растительные ресурсы', 'Пищевые ресурсы', 'Текстиль'];
  let catalog = [];
  let itemsById = new Map();
  let identitiesByItemId = new Map();
  let recipes = [];
  let selectedItemId = null;
  let renderVersion = 0;

  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru-RU');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const classifySemanticType = (item) => {
    if (mushroomItemIds.has(item.id)) return 'Гриб';
    if (item.id === 'SW-ITEM-077') return 'Лист';
    if (item.itemType === 'Трава') return 'Трава';
    if (item.itemType === 'Необработанная древесина') return 'Бревно';
    if (item.itemType === 'Обработанная древесина') return item.name.startsWith('Фанера') ? 'Фанера' : 'Древесина';
    if (item.itemType === 'Металл' && item.name.startsWith('Слиток')) return 'Слиток';
    if (item.itemType === 'Материал') {
      if (item.name.startsWith('Фанера')) return 'Фанера';
      if (item.name.includes('Древесина')) return 'Древесина';
      if (item.name.startsWith('Порошок')) return 'Порошок';
    }
    return directTypes.get(item.itemType) || null;
  };
  const officialAuctionCategory = (item) => {
    if (auctionOreTypes.has(item.itemType) || auctionOreItemIds.has(item.id)) return 'Материалы → Руда/драг. камни';
    if (auctionPlantItemIds.has(item.id)) return 'Материалы → Растения';
    if (auctionFruitItemIds.has(item.id)) return 'Материалы → Плоды/фрукты';
    if (auctionVegetableItemIds.has(item.id)) return 'Материалы → Овощи';
    if (auctionGrainItemIds.has(item.id)) return 'Материалы → Зерновые';
    if (auctionOtherItemIds.has(item.id)) return 'Материалы → Другие';
    return null;
  };
  const recipeFormula = (recipe) => {
    const inputs = recipe.inputs.map((input) => `${escapeHtml(itemsById.get(input.itemId)?.name || input.itemId)} ×${escapeHtml(input.quantity ?? '—')}`).join(' + ');
    const resultQuantity = verifiedYieldRanges.get(recipe.id) || recipe.resultQuantity || 'не указано';
    return `<article><p>${inputs} <span aria-hidden="true">→</span> ${escapeHtml(itemsById.get(recipe.resultItemId)?.name || recipe.resultItemId)} ×${escapeHtml(resultQuantity)}</p><small>${escapeHtml(recipe.method || 'Метод не указан')}${recipe.workplace ? ` · ${escapeHtml(recipe.workplace)}` : ''}${verifiedYieldRanges.has(recipe.id) ? ' · выход зависит от мастерства' : ''}</small></article>`;
  };
  const renderRelationships = () => {
    const related = recipes.filter((recipe) => recipe.resultItemId === selectedItemId || recipe.inputs.some((input) => input.itemId === selectedItemId));
    relationships.innerHTML = related.length ? related.map(recipeFormula).join('') : '<p class="bdo-database-empty">Подтверждённые связи обработки пока не добавлены.</p>';
  };
  const loadMarket = (refresh = false) => {
    const version = ++renderVersion;
    const identity = identitiesByItemId.get(selectedItemId);
    if (!identity) {
      marketRefresh.disabled = true;
      market.className = 'is-unavailable';
      market.textContent = 'Предмет не сопоставлен с BDO Auction; рыночные данные не показываются.';
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
    }).finally(() => { if (version === renderVersion) marketRefresh.disabled = false; });
  };
  const setSelectedButton = () => tree.querySelectorAll('[data-database-item]').forEach((button) => {
    const selected = button.dataset.databaseItem === selectedItemId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const renderDetail = () => {
    const entry = catalog.find(({ item }) => item.id === selectedItemId);
    if (!entry) return;
    const { item, semanticType: itemSemanticType } = entry;
    const identity = identitiesByItemId.get(item.id);
    itemName.textContent = item.name;
    itemNameEn.textContent = item.nameEn || '';
    itemNameEn.hidden = !item.nameEn;
    itemId.textContent = item.id;
    bdoId.textContent = identity?.externalItemId || 'Не сопоставлен';
    auctionCategory.textContent = identity ? (officialAuctionCategory(item) || 'Подтверждённая категория не определена') : 'Не представлен в BDO Auction';
    semanticType.textContent = `Определение · ${itemSemanticType}`;
    definition.textContent = itemSemanticType;
    canonicalLink.href = `/items#${encodeURIComponent(item.id)}`;
    auctionLink.hidden = !identity;
    auctionLink.href = identity ? `/auction#${encodeURIComponent(item.id)}` : '/auction';
    setSelectedButton();
    renderRelationships();
    state.hidden = true;
    record.hidden = false;
    detail.setAttribute('aria-busy', 'false');
    loadMarket();
  };
  const selectItem = (nextItemId, updateHash = true) => {
    if (!catalog.some(({ item }) => item.id === nextItemId)) return;
    selectedItemId = nextItemId;
    if (updateHash && window.location.hash.slice(1) !== nextItemId) window.history.replaceState(null, '', `#${encodeURIComponent(nextItemId)}`);
    renderDetail();
  };
  const renderTree = () => {
    const query = normalize(search.value);
    const matches = catalog.filter(({ item, semanticType: itemSemanticType, group }) => normalize(`${item.id} ${item.name} ${item.nameEn || ''} ${itemSemanticType} ${group}`).includes(query));
    const groups = groupOrder.map((group) => ({ group, entries: matches.filter((entry) => entry.group === group) })).filter(({ entries }) => entries.length);
    tree.innerHTML = groups.map(({ group, entries }) => {
      const types = [...new Set(entries.map((entry) => entry.semanticType))].sort((left, right) => left.localeCompare(right, 'ru-RU'));
      return `<section class="bdo-database-group"><button class="bdo-database-accordion" type="button" aria-expanded="true"><span>${escapeHtml(group)}</span><strong>${entries.length}</strong></button><div class="bdo-database-branch">${types.map((type) => `<section><h3>${escapeHtml(type)}</h3>${entries.filter((entry) => entry.semanticType === type).map(({ item }) => `<button type="button" data-database-item="${escapeHtml(item.id)}" aria-pressed="false"><span>${escapeHtml(item.name)}</span><code>${escapeHtml(item.id)}</code></button>`).join('')}</section>`).join('')}</div></section>`;
    }).join('') || '<p class="bdo-database-empty">По запросу ничего не найдено.</p>';
    tree.querySelectorAll('.bdo-database-accordion').forEach((button) => button.addEventListener('click', () => {
      const branch = button.nextElementSibling;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      branch.hidden = expanded;
    }));
    tree.querySelectorAll('[data-database-item]').forEach((button) => button.addEventListener('click', () => selectItem(button.dataset.databaseItem)));
    setSelectedButton();
    visibleCount.textContent = `${matches.length} из ${catalog.length}`;
  };

  search.addEventListener('input', renderTree);
  marketRefresh.addEventListener('click', () => loadMarket(true));
  window.addEventListener('hashchange', () => selectItem(decodeURIComponent(window.location.hash.slice(1)), false));
  Promise.all([window.StartWaveBdoData.loadItems(), window.StartWaveBdoData.loadBdoExternalIdentities(), window.StartWaveBdoData.loadRecipes()]).then(([items, identities, loadedRecipes]) => {
    itemsById = new Map(items.map((item) => [item.id, item]));
    identitiesByItemId = new Map(identities.filter((identity) => identity.provider === 'bdo').map((identity) => [identity.itemId, identity]));
    recipes = loadedRecipes;
    catalog = items.filter((item) => databaseCategories.has(item.category)).map((item) => {
      const itemSemanticType = classifySemanticType(item);
      return { item, semanticType: itemSemanticType, group: typeGroups.get(itemSemanticType) };
    }).filter((entry) => entry.semanticType && entry.group).sort((left, right) => left.item.name.localeCompare(right.item.name, 'ru-RU'));
    if (!catalog.length) throw new Error('Database catalog is empty');
    typeCount.textContent = new Set(catalog.map((entry) => entry.semanticType)).size;
    renderTree();
    const requestedItemId = decodeURIComponent(window.location.hash.slice(1));
    selectItem(catalog.some(({ item }) => item.id === requestedItemId) ? requestedItemId : catalog[0].item.id);
  }).catch(() => {
    detail.setAttribute('aria-busy', 'false');
    state.textContent = 'Не удалось загрузить канонический каталог ресурсов.';
  });
})();
