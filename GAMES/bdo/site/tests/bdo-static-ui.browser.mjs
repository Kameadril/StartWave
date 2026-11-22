const results = document.getElementById('results');
const summary = document.getElementById('summary');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(actual === expected, `${message}: expected ${expected}, got ${actual}`);
const waitFor = async (predicate, message, timeout = 3000) => {
  const started = performance.now();
  while (!predicate()) {
    if (performance.now() - started > timeout) throw new Error(`timeout: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const makeProductionFrame = async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write('<!doctype html><html><body><base href="/production.html"><input id="productionArchiveSearch"><strong id="productionArchiveResultCount"></strong><strong id="productionArchiveRelationCount"></strong><div id="bdoProductionGrid" aria-busy="true"></div><p id="productionArchiveEmptyState" hidden></p></body></html>');
  doc.close();
  frame.contentWindow.fetch = fetch;
  const response = await fetch('/assets/js/bdo-productions.js');
  equal(response.status, 200, 'static renderer HTTP status');
  const script = doc.createElement('script');
  script.textContent = await response.text();
  doc.body.append(script);
  return { document: doc, window: frame.contentWindow, dispose: () => frame.remove() };
};

test('Contract A serves the static renderer and not the future LIVE renderer', async () => {
  equal((await fetch('/assets/js/bdo-productions.js')).status, 200, 'static renderer');
  equal((await fetch('/assets/js/bdo-live-productions.js')).status, 404, 'future LIVE renderer');
});

test('static renderer loads exactly 13 committed production records', async () => {
  const page = await makeProductionFrame();
  try {
    await waitFor(() => page.document.querySelectorAll('[data-production-id]').length === 13, '13 static production cards');
    equal(page.document.getElementById('bdoProductionGrid').getAttribute('aria-busy'), 'false', 'grid completion state');
  } finally { page.dispose(); }
});

test('static search filters cards without a LIVE data dependency', async () => {
  const page = await makeProductionFrame();
  try {
    await waitFor(() => page.document.querySelectorAll('[data-production-id]').length === 13, 'static cards');
    assert(!('StartWaveBdoData' in page.window), 'LIVE adapter is absent');
    const input = page.document.getElementById('productionArchiveSearch');
    input.value = '__no_static_record__';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    equal([...page.document.querySelectorAll('[data-production-id]')].filter((node) => !node.hidden).length, 0, 'visible filtered cards');
    equal(page.document.getElementById('productionArchiveEmptyState').hidden, false, 'empty state');
  } finally { page.dispose(); }
});

let failures = 0;
for (const entry of tests) {
  const row = document.createElement('li'); results.append(row);
  try { await entry.run(); row.className = 'pass'; row.textContent = `PASS — ${entry.name}`; }
  catch (error) { failures += 1; row.className = 'fail'; row.textContent = `FAIL — ${entry.name}: ${error.stack || error}`; }
}
summary.textContent = failures ? `FAIL: ${failures}/${tests.length}` : `PASS: ${tests.length}/${tests.length}`;
summary.className = failures ? 'fail' : 'pass';
document.documentElement.dataset.testStatus = failures ? 'fail' : 'pass';
