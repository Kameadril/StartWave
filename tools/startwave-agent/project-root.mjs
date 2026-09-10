import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveProjectRoot(moduleUrl) {
  const root = path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..', '..');
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'GAMES'))) {
    throw new Error('Unable to resolve StartWave project root.');
  }
  return root;
}
