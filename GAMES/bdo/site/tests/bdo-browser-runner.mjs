import { constants, fstatSync } from 'node:fs';
import { access, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { verifyPublicRoot } from './bdo-browser-provenance.mjs';
import { parseArgs, parseInheritedFd, verifyTrustAnchor } from './bdo-publication-workflow-lib.mjs';
import { repositoryTestTemp } from '../../../../scripts/repository-test-temp.mjs';

const root = path.resolve(import.meta.dirname, '../../../..');
const runnerArgs = parseArgs(process.argv.slice(2));
const timeoutMs = Number(process.env.BDO_BROWSER_TEST_TIMEOUT_MS || 30_000);
const versionTimeoutMs = Number(process.env.BDO_BROWSER_VERSION_TIMEOUT_MS || 2_000);
const stderrLimit = 4_000;
const automaticBrowserCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
];

class BlockedError extends Error {
  constructor(message) { super(message); this.name = 'BlockedError'; }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = Date.now() + timeoutMs;
const remaining = () => Math.max(0, deadline - Date.now());
const failAfter = async (promise, label, ms = remaining()) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout: ${label} (${ms} ms)`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const fetchBeforeDeadline = async (url, label) => {
  const controller = new AbortController();
  const ms = remaining();
  const timer = setTimeout(() => controller.abort(new Error(`timeout: ${label} (${ms} ms)`)), ms);
  try { return await fetch(url, { signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally { clearTimeout(timer); }
};

const waitForLine = (stream, prefix) => new Promise((resolve, reject) => {
  let buffered = '';
  const onData = (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/); buffered = lines.pop();
    for (const line of lines) {
      if (line.startsWith(prefix)) { cleanup(); resolve(line.slice(prefix.length)); return; }
      if (line) console.error(`[server] ${line}`);
    }
  };
  const onEnd = () => { cleanup(); reject(new Error('server exited before reporting its URL')); };
  const cleanup = () => { stream.off('data', onData); stream.off('end', onEnd); };
  stream.on('data', onData); stream.once('end', onEnd);
});

const stopChild = async (child) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await failAfter(new Promise((resolve) => child.once('exit', resolve)), `PID ${child.pid} SIGTERM cleanup`, 2_000);
    return;
  } catch {}
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await failAfter(new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  }), `PID ${child.pid} SIGKILL cleanup`, 2_000);
};

const testPhase = async (phase) => {
  if (process.env.BDO_BROWSER_TEST_PAUSE_PHASE !== phase) return;
  console.error(`BDO runner phase: ${phase} server=${server?.pid || '-'} browser=${browser?.pid || '-'} profile=${profile || '-'}`);
  await delay(Number(process.env.BDO_BROWSER_TEST_PAUSE_MS || 10_000));
};

const findBrowser = async () => {
  if (process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT) return { path: process.execPath, source: 'test fixture' };
  if (process.env.BDO_BROWSER_BIN) {
    try { await access(process.env.BDO_BROWSER_BIN, constants.X_OK); }
    catch { throw new BlockedError(`BDO_BROWSER_BIN is not an executable file: ${process.env.BDO_BROWSER_BIN}`); }
    return { path: process.env.BDO_BROWSER_BIN, source: 'BDO_BROWSER_BIN' };
  }
  const candidates = process.env.BDO_BROWSER_TEST_DISABLE_AUTO === '1' ? [] : automaticBrowserCandidates;
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return { path: candidate, source: 'automatic Chrome/Chromium/Edge detection' }; } catch {}
  }
  throw new BlockedError('No supported Chrome/Chromium/Edge executable found. Set BDO_BROWSER_BIN to an executable Chromium-compatible browser with Chrome DevTools Protocol support. Safari and Yandex Browser are not used.');
};

const waitForDevTools = async (file) => {
  while (remaining()) {
    try {
      const [port, browserPath] = (await readFile(file, 'utf8')).trim().split(/\r?\n/);
      if (port && browserPath) return { port: Number(port), browserPath };
    } catch {}
    if (browser && (browser.exitCode !== null || browser.signalCode !== null)) {
      throw new Error(`browser exited before DevTools startup (exit ${browser.exitCode}, signal ${browser.signalCode})`);
    }
    await delay(25);
  }
  throw new Error(`timeout: browser startup (${timeoutMs} ms)`);
};

const connect = async (url) => {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('browser DevTools WebSocket failed')), { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id; pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  return { socket, send };
};

let server;
let browser;
let versionProbe;
let profile;
let cdp;
let browserError = '';
let cleanupPromise;
let shuttingDown = false;
const timestamp = () => new Date().toISOString();
const appendTail = (current, chunk, limit = stderrLimit) => `${current}${String(chunk)}`.slice(-limit);
const stderrTail = () => browserError.trim();
const stderrSuffix = () => stderrTail() ? `\nBDO browser stderr tail (max ${stderrLimit} chars):\n${stderrTail()}` : '';
const childExit = (name, child) => child?.once('exit', (code, signal) => {
  console.error(`BDO ${name} exit: time=${timestamp()} pid=${child.pid} code=${code ?? '-'} signal=${signal ?? '-'}`);
});
const cleanup = () => {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    try { cdp?.socket.close(); } catch {}
    const failures = [];
    for (const [name, child] of [['version-probe', versionProbe], ['browser', browser], ['server', server]]) {
      try { await stopChild(child); } catch (error) { failures.push(`${name}: ${error.message}`); }
    }
    if (profile) {
      try { await rm(profile, { recursive: true, force: true }); }
      catch (error) { failures.push(`profile: ${error.message}`); }
    }
    if (failures.length) throw new Error(`cleanup failed: ${failures.join('; ')}`);
  })();
  return cleanupPromise;
};

const shutdown = async ({ signal, error } = {}) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (error) console.error(`FAIL — browser runner: ${error.stack || error}${stderrSuffix()}`);
  try { await cleanup(); }
  catch (cleanupError) { console.error(`FAIL — browser runner: ${cleanupError.stack || cleanupError}`); }
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    return;
  }
  process.exit(1);
};

for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void shutdown({ signal }); });
process.once('uncaughtException', (error) => { void shutdown({ error }); });
process.once('unhandledRejection', (error) => { void shutdown({ error }); });

try {
  let provenance;
  try {
    if (process.env.BDO_BROWSER_PUBLIC_MANIFEST_SHA256) throw new Error('environment manifest digest override is forbidden');
    const anchorFd = parseInheritedFd(runnerArgs['trust-anchor-fd']);
    const anchorIdentity = fstatSync(anchorFd, { bigint: true });
    if (!anchorIdentity.isFile()) throw new Error('trust anchor must be a regular file');
    if (String(anchorIdentity.dev) !== runnerArgs['trust-anchor-dev'] || String(anchorIdentity.ino) !== runnerArgs['trust-anchor-ino']) {
      throw new Error('trust anchor inherited descriptor identity mismatch');
    }
    const anchored = await verifyTrustAnchor({
      publicationRoot: process.env.BDO_BROWSER_PUBLIC_ROOT,
      manifestPath: process.env.BDO_BROWSER_PUBLIC_MANIFEST,
      anchorFd
    });
    provenance = await verifyPublicRoot({
      publicRoot: process.env.BDO_BROWSER_PUBLIC_ROOT,
      manifestPath: process.env.BDO_BROWSER_PUBLIC_MANIFEST,
      manifestSha256: anchored.manifestSha256,
      sourceRoot: root
    });
  } catch (error) {
    throw new BlockedError(`public-root provenance failed before browser spawn: ${error.message}`);
  }
  console.error(`BDO public provenance: root=${provenance.publicRoot} manifest=${provenance.manifestPath} publications=${provenance.publicationCount}`);
  for (const [file, hash] of Object.entries(provenance.hashes)) console.error(`BDO public SHA256: ${hash}  ${file}`);
  if (runnerArgs['provenance-only'] === 'true') {
    console.log('PASS — trust anchor inherited descriptor and publication provenance verified; browser not started');
    process.exitCode = 0;
  } else if (runnerArgs['provenance-only'] !== undefined) {
    throw new BlockedError('provenance-only must be true when supplied');
  } else {
  server = spawn(process.execPath, ['GAMES/bdo/site/tests/bdo-browser-server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      BDO_BROWSER_TEST_PORT: '0',
      BDO_BROWSER_PUBLIC_ROOT: provenance.publicRoot,
      BDO_BROWSER_PUBLIC_MANIFEST: provenance.manifestPath,
      BDO_BROWSER_PUBLIC_MANIFEST_SHA256: provenance.manifestSha256
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  console.error(`BDO server spawn: time=${timestamp()} pid=${server.pid}`);
  childExit('server', server);
  server.stderr.pipe(process.stderr);
  await testPhase('server-spawned');
  const harnessUrl = await failAfter(waitForLine(server.stdout, 'BDO browser harness: '), 'local server startup');
  const browserSelection = await findBrowser();
  const browserBin = browserSelection.path;
  console.error(`BDO browser selected: ${browserBin} (${browserSelection.source})`);
  if (!process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT || process.env.BDO_BROWSER_TEST_VERSION_SCRIPT) {
    const versionCommand = process.env.BDO_BROWSER_TEST_VERSION_SCRIPT ? process.execPath : browserBin;
    const versionArgs = process.env.BDO_BROWSER_TEST_VERSION_SCRIPT ? [process.env.BDO_BROWSER_TEST_VERSION_SCRIPT, '--version'] : ['--version'];
    let versionOutput = '';
    versionProbe = spawn(versionCommand, versionArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.error(`BDO browser version probe spawn: time=${timestamp()} pid=${versionProbe.pid}`);
    childExit('browser version probe', versionProbe);
    versionProbe.stdout.on('data', (chunk) => { versionOutput = appendTail(versionOutput, chunk); });
    versionProbe.stderr.on('data', (chunk) => { versionOutput = appendTail(versionOutput, chunk); });
    let version;
    try {
      const result = await failAfter(new Promise((resolve, reject) => {
        versionProbe.once('error', reject);
        versionProbe.once('close', (code, signal) => resolve({ code, signal }));
      }), 'browser version probe', Math.min(versionTimeoutMs, remaining()));
      version = result.code === 0 ? versionOutput.trim() : `unavailable (code=${result.code}, signal=${result.signal})`;
    } catch (error) {
      await stopChild(versionProbe);
      throw new BlockedError(`browser version probe failed: ${error.message}`);
    }
    console.error(`BDO browser version: ${version}`);
    versionProbe = undefined;
  }
  profile = await repositoryTestTemp(root, 'bdo-browser-profile-');
  console.error(`BDO browser profile: ${profile}`);
  await testPhase('profile-created');
  const browserCommand = process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT ? process.execPath : browserBin;
  const browserPrefix = process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT ? [process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT] : [];
  browser = spawn(browserCommand, [...browserPrefix,
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, harnessUrl
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  console.error(`BDO browser spawn: time=${timestamp()} pid=${browser.pid}`);
  childExit('browser', browser);
  browser.stderr.on('data', (chunk) => { browserError = appendTail(browserError, chunk); });
  await testPhase('browser-spawned');
  let devTools;
  try { devTools = await failAfter(waitForDevTools(path.join(profile, 'DevToolsActivePort')), 'browser startup'); }
  catch (error) {
    if (!process.env.BDO_BROWSER_TEST_FAKE_BROWSER_SCRIPT) {
      throw new BlockedError(`Selected browser did not provide a compatible Chrome DevTools Protocol endpoint: ${error.message}`);
    }
    throw error;
  }
  const { port } = devTools;
  console.error(`BDO browser CDP ready: time=${timestamp()} pid=${browser.pid} port=${port}`);
  let page;
  while (remaining()) {
    const response = await fetchBeforeDeadline(`http://127.0.0.1:${port}/json/list`, 'DevTools target discovery');
    const targets = await failAfter(response.json(), 'DevTools target response');
    page = targets.find((target) => target.type === 'page' && target.url === harnessUrl);
    if (page) break;
    await delay(25);
  }
  if (!page) throw new Error('browser page target not found');
  cdp = await failAfter(connect(page.webSocketDebuggerUrl), 'DevTools connection');
  await failAfter(cdp.send('Runtime.enable'), 'Runtime.enable');
  let state;
  while (remaining()) {
    const evaluated = await failAfter(cdp.send('Runtime.evaluate', {
      expression: `(() => ({ status: document.documentElement.dataset.testStatus || '', summary: document.getElementById('summary')?.textContent || '', rows: [...document.querySelectorAll('#results li')].map((node) => node.textContent) }))()`,
      returnByValue: true
    }), 'Runtime.evaluate');
    state = evaluated.result.value;
    if (state && (state.status === 'pass' || state.status === 'fail')) break;
    await delay(25);
  }
  if (!state || !['pass', 'fail'].includes(state.status)) throw new Error('timeout: DOM suite did not publish a final status');
  for (const row of state.rows) console.log(row);
  console.log(state.summary);
  if (state.status !== 'pass') {
    if (stderrTail()) console.error(stderrSuffix().trimStart());
    process.exitCode = 1;
  }
  }
} catch (error) {
  if (error instanceof BlockedError) {
    console.error(`BLOCKED — browser runner: ${error.message}${stderrSuffix()}`);
    process.exitCode = 2;
  } else {
    console.error(`FAIL — browser runner: ${error.stack || error}${stderrSuffix()}`);
    process.exitCode = 1;
  }
} finally {
  try { await cleanup(); }
  catch (error) {
    console.error(`FAIL — browser runner: ${error.stack || error}`);
    process.exitCode = 1;
  }
}
