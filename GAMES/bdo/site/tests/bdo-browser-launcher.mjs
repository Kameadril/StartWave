import { constants, closeSync, fstatSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './bdo-publication-workflow-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = parseArgs(process.argv.slice(2));
const anchorPath = args['trust-anchor'];
if (!path.isAbsolute(anchorPath ?? '')) throw new Error('trust anchor must be an explicit absolute path');
if (!path.isAbsolute(args.publication ?? '') || !path.isAbsolute(args.manifest ?? '')) throw new Error('publication and manifest must be explicit absolute paths');

let anchorFd;
try {
  anchorFd = openSync(anchorPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  const identity = fstatSync(anchorFd, { bigint: true });
  if (!identity.isFile()) throw new Error('trust anchor must be a regular file');
  const childArgs = [
    'GAMES/bdo/site/tests/bdo-browser-runner.mjs',
    '--trust-anchor-fd', '3',
    '--trust-anchor-dev', String(identity.dev),
    '--trust-anchor-ino', String(identity.ino)
  ];
  if (args['provenance-only'] === 'true') childArgs.push('--provenance-only', 'true');
  else if (args['provenance-only'] !== undefined) throw new Error('provenance-only must be true when supplied');
  const child = spawn(process.execPath, childArgs, {
    cwd: root,
    env: { ...process.env, BDO_BROWSER_PUBLIC_ROOT: args.publication, BDO_BROWSER_PUBLIC_MANIFEST: args.manifest },
    stdio: ['inherit', 'inherit', 'inherit', anchorFd]
  });
  child.once('error', (error) => { throw error; });
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
} finally {
  if (anchorFd !== undefined) closeSync(anchorFd);
}
