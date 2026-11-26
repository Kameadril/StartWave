import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const tools = path.join(root, 'GAMES/bdo/site/tools');
const committed = path.join(tools, 'bdo-owner-materializer');
const source = path.join(tools, 'bdo-owner-materializer.m');
const tests = path.join(here, 'bdo-owner-materializer.test.mjs');
const args = process.argv.slice(2);

const option = (name) => {
  const index = args.indexOf(name);
  assert.notEqual(index, -1, `missing required ${name}`);
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `missing value for ${name}`);
  return args[index + 1];
};
const buildDir = path.resolve(option('--build-dir'));
const rebuilt = path.join(buildDir, 'bdo-owner-materializer');
assert.notEqual(rebuilt, committed, 'rebuilt output must not replace the committed materializer');
const sha256 = (target) => createHash('sha256').update(readFileSync(target)).digest('hex');
const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', ...options });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${command} exited ${result.status}`);
  return result;
};
const runTests = (target, label) => {
  process.stdout.write(`\n[${label}] ${target}\n`);
  run(process.execPath, ['--test', tests], {
    env: { ...process.env, BDO_OWNER_MATERIALIZER: target },
  });
};

assert.ok(statSync(committed).isFile(), 'committed materializer is missing');
assert.ok((statSync(committed).mode & 0o111) !== 0, 'committed materializer is not executable');

const committedBefore = sha256(committed);
const sourceHash = sha256(source);
runTests(committed, 'committed artifact before build');

mkdirSync(buildDir, { recursive: true });
run('make', ['-B', '-C', path.relative(root, tools), `OUTPUT=${rebuilt}`]);

const committedAfter = sha256(committed);
assert.equal(committedAfter, committedBefore, 'build changed the committed materializer');
assert.ok(statSync(rebuilt).isFile(), 'rebuilt materializer is missing');
assert.ok((statSync(rebuilt).mode & 0o111) !== 0, 'rebuilt materializer is not executable');
runTests(rebuilt, 'source-built artifact');

const compiler = run('xcrun', ['clang', '--version']).stdout.trim().split('\n')[0];
const sdk = run('xcrun', ['--show-sdk-version']).stdout.trim();
const evidence = {
  schemaVersion: 1,
  policy: 'startwave-native-materializer-contract-equivalence-v1',
  result: 'PASS',
  claims: {
    committedArtifactTestedBeforeBuild: true,
    committedArtifactUnchangedByBuild: true,
    sourceBuiltArtifactTested: true,
    sharedContractTests: 5,
    contractEquivalenceScope: 'Both artifacts passed the same five observed-behavior tests.',
  },
  limitations: [
    'This evidence does not prove byte equality; byte equality is not required by this policy.',
    'This evidence does not prove full semantic equivalence outside the five tests.',
    'This evidence does not cryptographically attest that the committed artifact was produced from this source.',
  ],
  artifacts: {
    source: { path: path.relative(root, source), sha256: sourceHash },
    committed: { path: path.relative(root, committed), sha256: committedBefore },
    rebuilt: { path: rebuilt, sha256: sha256(rebuilt) },
  },
  toolchain: { compiler, sdk },
};
process.stdout.write(`\nSTARTWAVE_NATIVE_PROVENANCE_EVIDENCE=${JSON.stringify(evidence)}\n`);
