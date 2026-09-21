(() => {
  const SUPABASE_URL = 'https://ebnbzgxwfrtttynbmizz.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_jTjNpqT0tGskaTUu35JpTg_gyugKhOC';

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

  window.StartWaveBdoData = Object.freeze({ loadItems });
})();
