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

  const request = async (table, searchParams) => {
    const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    for (const [name, value] of Object.entries(searchParams)) url.searchParams.set(name, value);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY }
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
    return rows;
  };

  const loadItems = async () => {
    const rows = await request('items', {
      select: 'id,name,name_en,category,item_type,status',
      status: 'in.(curated,active)',
      order: 'id.asc',
      limit: '1000'
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      category: row.category,
      itemType: row.item_type,
      status: row.status
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

  const loadCities = async () => {
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

  const loadNodes = async () => {
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
    loadBdoCurrentMarket,
    loadCities,
    loadNodes,
    loadResources,
    loadRegions
  });
})();
