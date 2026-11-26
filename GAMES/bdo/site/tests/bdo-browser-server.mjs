import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { verifyPublicRoot } from './bdo-browser-provenance.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const provenance = await verifyPublicRoot({
  publicRoot: process.env.BDO_BROWSER_PUBLIC_ROOT,
  manifestPath: process.env.BDO_BROWSER_PUBLIC_MANIFEST,
  manifestSha256: process.env.BDO_BROWSER_PUBLIC_MANIFEST_SHA256,
  sourceRoot: root
});
const publicSnapshot = provenance.snapshot;
const testRoot = path.join(root, 'GAMES/bdo/site/tests');
console.error(`BDO immutable public snapshot: provenance=${provenance.provenanceModel} manifest-sha256=${provenance.manifestSha256} files=${provenance.snapshotFileCount} open-handles=${provenance.snapshotOpenHandles}`);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);
const inside = (base, relative) => {
  const target = path.resolve(base, relative);
  return target === base || target.startsWith(`${base}${path.sep}`) ? target : null;
};
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const readTestFile = async (relative) => {
  const target = inside(testRoot, relative);
  if (!target) return null;
  const linkInfo = await lstat(target);
  if (linkInfo.isSymbolicLink()) return null;
  const canonical = await realpath(target);
  if (!canonical.startsWith(`${testRoot}${path.sep}`)) return null;
  const expected = await stat(canonical, { bigint: true });
  if (!expected.isFile()) return null;
  let handle;
  try {
    handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(expected, opened)) return null;
    return { bytes: await handle.readFile(), canonical };
  } finally { await handle?.close(); }
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const isTest = url.pathname.startsWith('/__tests__/');
    const relative = decodeURIComponent(isTest ? url.pathname.slice('/__tests__/'.length) : url.pathname.slice(1)) || 'index.html';
    let file;
    if (isTest) file = await readTestFile(relative);
    else {
      const bytes = publicSnapshot.get(relative);
      if (!bytes) throw new Error('not found');
      file = { bytes, canonical: relative };
    }
    if (!file) throw new Error('not found');
    response.writeHead(200, { 'content-type': mime.get(path.extname(file.canonical)) || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(file.bytes);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
server.once('error', (error) => {
  console.error(`BDO browser server failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
const port = Number(process.env.BDO_BROWSER_TEST_PORT ?? 41731);
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.log(`BDO browser harness: http://127.0.0.1:${address.port}/__tests__/bdo-static-ui.browser.html`);
});
const stop = () => server.close(() => process.exit(0));
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
