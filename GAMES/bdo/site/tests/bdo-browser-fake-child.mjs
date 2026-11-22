import process from 'node:process';

if (process.argv.includes('--version')) {
  if (process.env.BDO_BROWSER_TEST_VERSION_STDERR) process.stderr.write(process.env.BDO_BROWSER_TEST_VERSION_STDERR);
  if (process.env.BDO_BROWSER_TEST_VERSION_HANG !== '1') process.exit(0);
}

const stderrLength = Number(process.env.BDO_BROWSER_TEST_STDERR_LENGTH || 0);
if (stderrLength) {
  process.stderr.write(`SHOULD-NOT-APPEAR-${'x'.repeat(stderrLength)}TAIL-MARKER`);
  process.exit(7);
}

if (process.env.BDO_BROWSER_TEST_FAKE_CHILD_IGNORE_SIGTERM === '1') process.on('SIGTERM', () => {});
else process.once('SIGTERM', () => process.exit(0));
process.once('SIGINT', () => process.exit(0));
setInterval(() => {}, 1_000);
