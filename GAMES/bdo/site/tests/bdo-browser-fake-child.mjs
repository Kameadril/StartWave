import process from 'node:process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

if (process.argv.includes('--version')) {
  if (process.env.BDO_BROWSER_TEST_VERSION_STDERR) process.stderr.write(process.env.BDO_BROWSER_TEST_VERSION_STDERR);
  if (process.env.BDO_BROWSER_TEST_VERSION_HANG !== '1') process.exit(0);
}

const stderrLength = Number(process.env.BDO_BROWSER_TEST_STDERR_LENGTH || 0);
if (stderrLength) {
  process.stderr.write(`SHOULD-NOT-APPEAR-${'x'.repeat(stderrLength)}TAIL-MARKER`);
  process.exit(7);
}

if (process.env.BDO_BROWSER_TEST_HANG_FETCH === '1' || process.env.BDO_BROWSER_TEST_HANG_WEBSOCKET === '1') {
  const profileArg = process.argv.find((argument) => argument.startsWith('--user-data-dir='));
  const profile = profileArg?.slice('--user-data-dir='.length);
  if (!profile) throw new Error('missing fake browser profile');
  const sockets = new Set();
  let shuttingDown = false;
  let upgradeClosed = false;
  const server = http.createServer((request, response) => {
    if (process.env.BDO_BROWSER_TEST_HANG_WEBSOCKET === '1' && request.url === '/json/list') {
      const port = server.address().port;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([{ type: 'page', url: process.argv.at(-1), webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/hang` }]));
    }
  });
  server.on('upgrade', (_request, socket) => {
    sockets.add(socket);
    process.stderr.write('FAKE_WS_OPEN\n');
    socket.resume();
    socket.once('end', () => {
      if (!shuttingDown) upgradeClosed = true;
    });
    socket.once('close', () => {
      sockets.delete(socket);
      if (!shuttingDown) {
        upgradeClosed = true;
        process.stderr.write('FAKE_WS_PEER_CLOSED\n');
      }
    });
  });
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    writeFileSync(path.join(profile, 'DevToolsActivePort'), `${port}\n/devtools/browser/fake\n`);
  });
  const shutdown = () => {
    shuttingDown = true;
    const exitCode = process.env.BDO_BROWSER_TEST_HANG_WEBSOCKET === '1' && !upgradeClosed ? 9 : 0;
    for (const socket of sockets) socket.destroy();
    server.close(() => process.exit(exitCode));
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} else {

if (process.env.BDO_BROWSER_TEST_FAKE_CHILD_IGNORE_SIGTERM === '1') process.on('SIGTERM', () => {});
else process.once('SIGTERM', () => process.exit(0));
process.once('SIGINT', () => process.exit(0));
}
setInterval(() => {}, 1_000);
