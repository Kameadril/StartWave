import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import path from 'node:path';

export async function repositoryTestTemp(repositoryRoot, prefix) {
  const root = await realpath(repositoryRoot);
  const parent = path.join(root, '.startwave-agent', 'tmp');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, prefix));
  const resolved = await realpath(directory);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('test fixture escaped repository root');
  return resolved;
}
