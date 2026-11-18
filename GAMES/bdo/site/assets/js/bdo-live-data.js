(() => {
  const SUPABASE_URL = 'https://ebnbzgxwfrtttynbmizz.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jTjNpqT0tGskaTUu35JpTg_gyugKhOC';
  const ARSHA_URL = 'https://api.arsha.io';
  const BDO_MARKET_REGIONS = new Set(['ru', 'eu', 'na']);
  const BDO_MARKET_TIMEOUT_MS = 10000;

  const createMarketError = (code, message, httpStatus) => {
    const error = new Error(message);
    error.code = code;
    if (httpStatus) error.httpStatus = httpStatus;
    return error;
  };

  const PAGE_SIZE = 250;
  const memo = new Map();
  const requestPage = async (table, searchParams, from) => {
    const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    for (const [name, value] of Object.entries(searchParams)) url.searchParams.set(name, value);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Prefer: 'count=exact', Range: `${from}-${from + PAGE_SIZE - 1}` }
    });
    if (!response.ok) {
      const error = new Error(`Live data request failed: HTTP ${response.status}`);
      error.code = 'LIVE_DATA_HTTP_ERROR';
      error.httpStatus = response.status;
      throw error;
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      const error = new Error('Live data response is not an array');
      error.code = 'LIVE_DATA_INVALID_RESPONSE';
      throw error;
    }
    const contentRange = response.headers?.get?.('content-range') || '';
    const match = contentRange.match(/^(?:(\d+)-(\d+)|(\*))\/(\d+|\*)$/);
    if (!match) {
      const error = new Error(`Live data response lacks a valid Content-Range for ${table}`);
      error.code = 'LIVE_DATA_INCOMPLETE_RESPONSE';
      throw error;
    }
    return { rows, end: match[2] == null ? from - 1 : Number(match[2]), total: match[4] === '*' ? null : Number(match[4]) };
  };

  const request = async (table, searchParams) => {
    const rows = [];
    let from = 0;
    let expectedTotal = null;
    do {
      const page = await requestPage(table, searchParams, from);
      rows.push(...page.rows);
      expectedTotal = page.total;
      if (!page.rows.length || (expectedTotal != null && rows.length >= expectedTotal)) break;
      from = page.end + 1;
    } while (true);
    if (expectedTotal == null || rows.length !== expectedTotal) {
      const error = new Error(`Incomplete ${table} response: received ${rows.length}, expected ${expectedTotal ?? 'known total'}`);
      error.code = 'LIVE_DATA_INCOMPLETE_RESPONSE';
      throw error;
    }
    return rows;
  };

  const memoize = (key, loader) => {
    if (!memo.has(key)) memo.set(key, loader().catch((error) => { memo.delete(key); throw error; }));
    return memo.get(key);
  };

  const loadItems = () => memoize('items', async () => {
    const rows = await request('items', {
      select: 'id,name,name_en,category,item_type,status',
      status: 'in.(curated,active)',
      order: 'id.asc'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      category: row.category,
      itemType: row.item_type,
      status: row.status
    }));
  });

  const loadRecipeArchiveRecipes = () => memoize('recipe-archive', async () => {
    let recipeRows;
    try {
      recipeRows = await request('recipes', {
        select: 'id,name,method,workplace,result_item_id,result_quantity,status',
        status: 'in.(curated,active)',
        order: 'id.asc'
      });
    } catch (error) { error.endpoint = 'recipes'; throw error; }
    let inputRows;
    try {
      inputRows = recipeRows.length ? await request('recipe_inputs', {
        select: 'recipe_id,item_id,quantity',
        recipe_id: `in.(${recipeRows.map((row) => row.id).join(',')})`,
        order: 'recipe_id.asc,item_id.asc'
      }) : [];
    } catch (error) { error.endpoint = 'recipe_inputs'; throw error; }
    const inputsByRecipe = new Map();
    inputRows.forEach((row) => {
      if (!inputsByRecipe.has(row.recipe_id)) inputsByRecipe.set(row.recipe_id, []);
      inputsByRecipe.get(row.recipe_id).push(row);
    });
    return recipeRows.map((row) => {
      const inputs = inputsByRecipe.get(row.id) || [];
      return {
        id: row.id,
        name: row.name,
        recipeType: 'Рецепт обработки',
        description: '',
        materialItemIds: inputs.map((input) => input.item_id),
        materialQuantities: Object.fromEntries(inputs.map((input) => [input.item_id, input.quantity])),
        resultItemId: row.result_item_id,
        resultQuantity: row.result_quantity == null ? null : Number(row.result_quantity),
        productionIds: [],
        method: row.method || 'Не указан',
        workplace: row.workplace || 'Не указано',
        status: row.status,
        inputs: inputs.map((input) => ({
          itemId: input.item_id,
          quantity: input.quantity == null ? null : Number(input.quantity)
        }))
      };
    });
  });

  const loadRecipeArchive = async () => {
    const [items, recipes] = await Promise.all([loadItems(), loadRecipeArchiveRecipes()]);
    return { items, recipes };
  };

  const toDate = (value) => value ? String(value).slice(0, 10) : '';

  const loadRegionNames = async () => {
    const rows = await request('regions', {
      select: 'id,name',
      status: 'in.(curated,active)',
      order: 'id.asc'
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  };

  const loadCities = async () => {
    const [rows, regions] = await Promise.all([
      request('cities', {
        select: 'id,name,name_en,city_type,status,region_id,updated_at',
        status: 'in.(curated,active)',
        order: 'id.asc'
      }),
      loadRegionNames()
    ]);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      region: regions.get(row.region_id) || row.region_id || 'Не указан',
      cityType: row.city_type || 'Не указан',
      description: '',
      status: row.status,
      checkedAt: toDate(row.updated_at),
      coordinates: null,
      source: [],
      nodes: [],
      resources: [],
      production: [],
      trade: [],
      images: []
    }));
  };

  const loadNodes = async () => {
    const rows = await request('nodes', {
      select: 'id,name,name_en,node_type,status,updated_at',
      status: 'in.(curated,active)',
      order: 'id.asc'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      region: 'Не указан',
      nodeType: row.node_type || 'Не указан',
      status: row.status,
      checkedAt: toDate(row.updated_at),
      coordinates: null,
      source: [],
      resources: [],
      workers: [],
      production: [],
      images: []
    }));
  };

  const loadBdoExternalIdentities = async () => {
    const rows = await request('item_external_identities', {
      select: 'item_id,provider,external_item_id',
      provider: 'eq.bdo'
    });
    return rows.map((row) => ({
      itemId: row.item_id,
      provider: row.provider,
      externalItemId: row.external_item_id
    }));
  };

  const loadRecipesWithEmbeddedInputs = async () => {
    const rows = await request('recipes', {
      select: 'id,name,method,workplace,result_item_id,result_quantity,status,recipe_inputs(item_id,quantity)',
      status: 'in.(curated,active)',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      method: row.method,
      workplace: row.workplace,
      resultItemId: row.result_item_id,
      resultQuantity: row.result_quantity == null ? null : Number(row.result_quantity),
      status: row.status,
      inputs: (row.recipe_inputs || []).map((input) => ({
        itemId: input.item_id,
        quantity: input.quantity == null ? null : Number(input.quantity)
      }))
    }));
  };

  const loadBdoCurrentMarket = async (externalItemId, region) => {
    const requestedId = String(externalItemId ?? '').trim();
    const requestedRegion = String(region ?? '').trim().toLowerCase();
    if (!requestedId) throw createMarketError('MARKET_INVALID_REQUEST', 'External item ID is required');
    if (!BDO_MARKET_REGIONS.has(requestedRegion)) {
      throw createMarketError('MARKET_UNSUPPORTED_REGION', 'Unsupported market region');
    }

    const url = new URL(`/v2/${requestedRegion}/search`, ARSHA_URL);
    url.searchParams.set('ids', requestedId);
    url.searchParams.set('lang', 'en');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), BDO_MARKET_TIMEOUT_MS);

    try {
      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw createMarketError('MARKET_TIMEOUT', 'Market request timed out');
        }
        throw createMarketError('MARKET_NETWORK_ERROR', 'Market request failed');
      }

      if (!response.ok) {
        throw createMarketError('MARKET_HTTP_ERROR', `Market request failed: HTTP ${response.status}`, response.status);
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw createMarketError('MARKET_INVALID_RESPONSE', 'Market response is not valid JSON');
      }

      if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
        throw createMarketError('MARKET_EMPTY', 'Market item was not found');
      }

      const entries = Array.isArray(payload) ? payload : [payload];
      const marketItem = entries.find((entry) => entry && String(entry.id) === requestedId);
      if (!marketItem) {
        throw createMarketError('MARKET_ID_MISMATCH', 'Market response item ID does not match');
      }

      const numericValues = [marketItem.basePrice, marketItem.currentStock, marketItem.totalTrades];
      if (numericValues.some((value) => value == null || String(value).trim() === '')) {
        throw createMarketError('MARKET_INVALID_RESPONSE', 'Market response is missing numeric values');
      }
      const [basePrice, currentStock, totalTrades] = numericValues.map(Number);
      if (![basePrice, currentStock, totalTrades].every((value) => Number.isFinite(value) && value >= 0)) {
        throw createMarketError('MARKET_INVALID_RESPONSE', 'Market response contains invalid numeric values');
      }

      return {
        id: marketItem.id,
        name: typeof marketItem.name === 'string' ? marketItem.name : null,
        basePrice,
        currentStock,
        totalTrades,
        fetchedAt: new Date().toISOString()
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const loadCitiesWithRegions = async () => {
    const rows = await request('cities', {
      select: 'id,name,name_en,city_type,status,region_id',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      cityType: row.city_type,
      status: row.status,
      regionId: row.region_id
    }));
  };

  const loadNodesWithRegions = async () => {
    const rows = await request('nodes', {
      select: 'id,name,name_en,node_type,status,node_regions!inner(region_id,regions(name))',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      nodeType: row.node_type,
      status: row.status,
      regionId: row.node_regions?.[0]?.region_id ?? null,
      region: row.node_regions?.[0]?.regions?.name ?? null
    }));
  };

  const loadResources = async () => {
    const rows = await request('resources', {
      select: 'id,name,name_en,category,resource_type,status,created_at,updated_at,resource_nodes(node_id,nodes(id,name,name_en,node_type,status)),item_resources(item_id,items(id,name,name_en,category,item_type,status))',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      category: row.category,
      resourceType: row.resource_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      nodes: (row.resource_nodes || [])
        .map((relation) => relation.nodes)
        .filter(Boolean)
        .map((node) => ({
          id: node.id,
          name: node.name,
          nameEn: node.name_en,
          nodeType: node.node_type,
          status: node.status
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      items: (row.item_resources || [])
        .map((relation) => relation.items)
        .filter(Boolean)
        .map((item) => ({
          id: item.id,
          name: item.name,
          nameEn: item.name_en,
          category: item.category,
          itemType: item.item_type,
          status: item.status
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    }));
  };

  const loadRegions = async () => {
    const rows = await request('regions', {
      select: 'id,name,name_en,region_type,status,cities(id,name,name_en,city_type,status),node_regions(node_id,nodes(id,name,name_en,node_type,status))',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      regionType: row.region_type,
      status: row.status,
      cities: (row.cities || [])
        .map((city) => ({
          id: city.id,
          name: city.name,
          nameEn: city.name_en,
          cityType: city.city_type,
          status: city.status
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      nodes: (row.node_regions || [])
        .map((relation) => relation.nodes)
        .filter(Boolean)
        .map((node) => ({
          id: node.id,
          name: node.name,
          nameEn: node.name_en,
          nodeType: node.node_type,
          status: node.status
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    }));
  };

  window.StartWaveBdoData = Object.freeze({
    loadItems,
    loadBdoExternalIdentities,
    loadRecipes: loadRecipeArchiveRecipes,
    loadRecipeArchive,
    loadBdoCurrentMarket,
    loadCities,
    loadNodes,
    loadResources,
    loadRegions
  });
})();
