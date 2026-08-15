import test from 'node:test';
import assert from 'node:assert/strict';
import { internals, searchBdoWeb } from './bdo-web-search.mjs';

test('allowlist rejects lookalike and non-HTTPS URLs', () => {
  const hosts = ['playblackdesert.com'];
  assert.equal(internals.isAllowedUrl('https://naeu.playblackdesert.com/x', hosts), true);
  assert.equal(internals.isAllowedUrl('https://playblackdesert.com.evil.test/x', hosts), false);
  assert.equal(internals.isAllowedUrl('http://playblackdesert.com/x', hosts), false);
});

test('coupon search keeps PC/Both entries and exposes source', async () => {
  const config = { bdoWebSearch: { enabled: true, allowedHosts: ['api.bdoalerts.net'], couponsUrl: 'https://api.bdoalerts.net/api/coupons' } };
  const fakeFetch = async () => new Response(JSON.stringify({ coupons: [
    { code: 'PC-CODE', description: 'Both', rewards: 'Cron Stone X100', expiry_date: null },
    { code: 'CONSOLE-CODE', description: 'Console', rewards: 'Console reward' }
  ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  const result = await searchBdoWeb('найди актуальные купоны Black Desert PC', config, fakeFetch);
  assert.match(result.context, /PC-CODE/);
  assert.doesNotMatch(result.context, /CONSOLE-CODE/);
  assert.equal(result.sources[0].url, config.bdoWebSearch.couponsUrl);
});
