const DEFAULT_TIMEOUT_MS = 15000;

function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isAllowedUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedHosts.some((host) => {
      const normalized = normalizeHost(host);
      const candidate = normalizeHost(url.hostname);
      return candidate === normalized || candidate.endsWith(`.${normalized}`);
    });
  } catch {
    return false;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function htmlToText(html) {
  return decodeHtml(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function duckDuckGoUrls(html, allowedHosts, limit) {
  const urls = [];
  const pattern = /uddg=([^&"']+)/g;
  for (const match of html.matchAll(pattern)) {
    const value = decodeURIComponent(match[1]);
    if (isAllowedUrl(value, allowedHosts) && !urls.includes(value)) urls.push(value);
    if (urls.length >= limit) break;
  }
  return urls;
}

async function fetchText(url, { fetchImpl, timeoutMs, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': 'StartWave-BDO-Search/0.1', ...headers },
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { url: response.url || url, contentType: response.headers.get('content-type') ?? '', text: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function couponContext(data, sourceUrl) {
  const coupons = Array.isArray(data.coupons) ? data.coupons : [];
  const pc = coupons.filter((coupon) => String(coupon.description ?? '').toLowerCase() !== 'console');
  const lines = pc.map((coupon) => {
    const expiry = coupon.expiry_date ? `; expires: ${coupon.expiry_date}` : '; expiry: not provided by source';
    return `- ${coupon.code}: ${coupon.rewards || 'rewards not specified'}${expiry}`;
  });
  return {
    sources: [{ title: 'BDO Alerts — Active Coupons', url: sourceUrl }],
    context: `Active Black Desert PC coupons reported by BDO Alerts (${new Date().toISOString()}):\n${lines.length ? lines.join('\n') : '- No active PC coupons reported.'}`
  };
}

export async function searchBdoWeb(query, config, fetchImpl = fetch) {
  const web = config.bdoWebSearch;
  if (!web?.enabled) throw new Error('BDO web search is disabled in config.');
  const timeoutMs = web.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const allowedHosts = web.allowedHosts ?? [];

  if (/купон|coupon|promo.?code|промокод/i.test(query)) {
    const sourceUrl = web.couponsUrl;
    if (!isAllowedUrl(sourceUrl, allowedHosts)) throw new Error('Coupon source is not in the BDO allowlist.');
    const response = await fetchText(sourceUrl, {
      fetchImpl,
      timeoutMs,
      headers: { origin: 'https://bdoalerts.net', referer: 'https://bdoalerts.net/coupons/' }
    });
    return couponContext(JSON.parse(response.text), sourceUrl);
  }

  const scopedQuery = `Black Desert PC ${query} ${allowedHosts.map((host) => `site:${host}`).join(' OR ')}`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(scopedQuery)}`;
  const search = await fetchText(searchUrl, { fetchImpl, timeoutMs });
  const urls = duckDuckGoUrls(search.text, allowedHosts, web.maxSources ?? 3);
  const sources = [];
  for (const url of urls) {
    try {
      const page = await fetchText(url, { fetchImpl, timeoutMs });
      if (!isAllowedUrl(page.url, allowedHosts)) continue;
      const text = htmlToText(page.text).slice(0, web.maxCharsPerSource ?? 6000);
      if (text) sources.push({ title: new URL(page.url).hostname, url: page.url, text });
    } catch {
      // A blocked source must not make the whole search fail.
    }
  }
  if (!sources.length) throw new Error('No readable pages were found in the BDO source allowlist.');
  return {
    sources: sources.map(({ title, url }) => ({ title, url })),
    context: sources.map((source, index) => `SOURCE ${index + 1}: ${source.url}\n${source.text}`).join('\n\n')
  };
}

export const internals = { isAllowedUrl, duckDuckGoUrls, htmlToText };
