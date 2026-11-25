import { lstat, mkdir, mkdtemp, realpath } from 'node:fs/promises';
import path from 'node:path';

const inspectDirectory = async (directory, label) => {
  let info;
  try {
    info = await lstat(directory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (mkdirError) { if (mkdirError.code !== 'EEXIST') throw mkdirError; }
    info = await lstat(directory);
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!info.isDirectory()) throw new Error(`${label} must be a directory`);
  return { dev: info.dev, ino: info.ino };
};

const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;

export async function repositoryTestTemp(repositoryRoot, prefix) {
  const root = await realpath(repositoryRoot);
  if (typeof prefix !== 'string' || !prefix || prefix === '.' || prefix === '..' || /[\\/]/.test(prefix) || path.basename(prefix) !== prefix) {
    throw new Error('test fixture prefix must be a simple basename');
  }
  const agentRoot = path.join(root, '.startwave-agent');
  await inspectDirectory(agentRoot, '.startwave-agent');
  const parent = path.join(agentRoot, 'tmp');
  const parentIdentity = await inspectDirectory(parent, '.startwave-agent/tmp');
  if (await realpath(parent) !== parent) throw new Error('test fixture parent escaped repository root');
  const beforeCreate = await inspectDirectory(parent, '.startwave-agent/tmp');
  if (!sameIdentity(parentIdentity, beforeCreate)) throw new Error('test fixture parent changed before creation');
  const directory = await mkdtemp(path.join(parent, prefix), { encoding: 'utf8' });
  const afterCreate = await inspectDirectory(parent, '.startwave-agent/tmp');
  if (!sameIdentity(parentIdentity, afterCreate)) throw new Error('test fixture parent changed during creation');
  const resolved = await realpath(directory);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('test fixture escaped repository root');
  return resolved;
}
