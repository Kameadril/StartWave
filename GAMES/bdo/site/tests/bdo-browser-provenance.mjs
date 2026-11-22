import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

export const requiredPublicFiles = [
  'assets/js/bdo-live-data.js', 'assets/js/bdo-recipes.js', 'assets/js/bdo-items.js',
  'assets/js/bdo-productions.js', 'assets/data/bdo-productions.json',
  'assets/data/bdo-items.json', 'assets/data/bdo-recipes.json',
  'production.html', 'recipes.html', 'items.html'
];
export const publicSourceMap = Object.freeze({
  'assets/js/bdo-live-data.js': 'GAMES/bdo/site/assets/js/bdo-live-data.js',
  'assets/js/bdo-recipes.js': 'GAMES/bdo/site/assets/js/bdo-recipes.js',
  'assets/js/bdo-items.js': 'GAMES/bdo/site/assets/js/bdo-items.js',
  'assets/js/bdo-productions.js': 'publication/baseline/assets/js/bdo-productions.js'
});
export const snapshotLimits = Object.freeze({
  maxFileBytes: 1024 * 1024, maxTotalSnapshotBytes: 4 * 1024 * 1024, maxManifestBytes: 256 * 1024
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const absolute = (value, name) => {
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an explicit absolute path`);
  return path.normalize(value);
};
const inside = (base, target) => target.startsWith(`${base}${path.sep}`);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const validDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

const verifyCanonicalDirectory = async (configuredRoot) => {
  const canonicalRoot = await realpath(configuredRoot);
  if (canonicalRoot !== configuredRoot) throw new Error('BDO_BROWSER_PUBLIC_ROOT contains a symlink component');
  const info = await lstat(configuredRoot);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('BDO_BROWSER_PUBLIC_ROOT must be a real directory');
  return canonicalRoot;
};

const rejectSymlinkComponents = async (base, relative, label) => {
  let current = base;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    if ((await lstat(current)).isSymbolicLink()) throw new Error(`${label} contains a symlink component`);
  }
};

const readBounded = async (handle, expectedSize, limit, label, onReadChunk) => {
  if (expectedSize > BigInt(limit)) throw new Error(`${label} exceeds byte limit ${limit}`);
  const output = Buffer.alloc(Number(expectedSize));
  let offset = 0;
  while (offset < output.length) {
    const length = Math.min(64 * 1024, output.length - offset);
    const { bytesRead } = await handle.read(output, offset, length, offset);
    if (bytesRead === 0) throw new Error(`${label} shrank while reading`);
    offset += bytesRead;
    if (onReadChunk) await onReadChunk({ bytesRead, offset, expectedSize: Number(expectedSize) });
  }
  const overflow = Buffer.allocUnsafe(1);
  if ((await handle.read(overflow, 0, 1, offset)).bytesRead !== 0) throw new Error(`${label} grew while reading`);
  const after = await handle.stat({ bigint: true });
  if (after.size !== expectedSize) throw new Error(`${label} changed size while reading`);
  return output;
};

const snapshotFile = async (base, relative, label, counters, byteLimit, testHooks) => {
  const target = path.resolve(base, relative);
  if (!inside(base, target)) throw new Error(`${label} resolves outside its trusted root`);
  await rejectSymlinkComponents(base, relative, label);
  const expected = await lstat(target, { bigint: true });
  if (!expected.isFile() || expected.isSymbolicLink()) throw new Error(`${label} is not a regular file`);
  if (expected.size > BigInt(byteLimit)) throw new Error(`${label} exceeds byte limit ${byteLimit}`);
  let handle;
  let primaryError;
  try {
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    counters.opened += 1;
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameFile(expected, opened)) throw new Error(`${label} changed while opening`);
    if (testHooks?.afterFileOpen) await testHooks.afterFileOpen({ label, relative, handle, size: Number(opened.size) });
    return await readBounded(handle, opened.size, byteLimit, label,
      testHooks?.afterReadChunk ? (details) => testHooks.afterReadChunk({ label, relative, handle, ...details }) : null);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (handle) {
      try { await handle.close(); counters.closed += 1; }
      catch (closeError) { if (!primaryError) throw closeError; }
    }
  }
};

export async function verifyPublicRoot({ publicRoot, manifestPath, manifestSha256, sourceRoot, testHooks }) {
  const configuredRoot = path.resolve(absolute(publicRoot, 'BDO_BROWSER_PUBLIC_ROOT'));
  const resolvedRoot = await verifyCanonicalDirectory(configuredRoot);
  const manifestTarget = path.resolve(absolute(manifestPath, 'BDO_BROWSER_PUBLIC_MANIFEST'));
  if (!inside(resolvedRoot, manifestTarget)) throw new Error('BDO_BROWSER_PUBLIC_MANIFEST resolves outside BDO_BROWSER_PUBLIC_ROOT');
  if (!validDigest(manifestSha256)) throw new Error('BDO_BROWSER_PUBLIC_MANIFEST_SHA256 must be an explicit lowercase SHA-256 digest');
  const manifestRelative = path.relative(resolvedRoot, manifestTarget);
  const counters = { opened: 0, closed: 0 };

  // The external digest is the trust anchor. Replaceable pathnames may select bytes,
  // but only bytes authenticated by this digest and its exact hash set enter the snapshot.
  const manifestBytes = await snapshotFile(resolvedRoot, manifestRelative, 'BDO_BROWSER_PUBLIC_MANIFEST', counters,
    snapshotLimits.maxManifestBytes, testHooks);
  if (sha256(manifestBytes) !== manifestSha256) throw new Error('external manifest SHA-256 mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.algorithm !== 'sha256' || !manifest.files || Array.isArray(manifest.files)) {
    throw new Error('public manifest must contain algorithm="sha256" and a files object');
  }
  const manifestFiles = Object.keys(manifest.files).sort();
  const expectedFiles = [...requiredPublicFiles].sort();
  if (JSON.stringify(manifestFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error('public manifest files must exactly match the required publication files');
  }
  for (const [relative, digest] of Object.entries(manifest.files)) {
    if (!validDigest(digest)) throw new Error(`invalid manifest SHA-256: ${relative}`);
  }

  const hashes = {};
  const snapshot = new Map();
  let capturedTotal = 0;
  for (const relative of requiredPublicFiles) {
    const remainingBudget = snapshotLimits.maxTotalSnapshotBytes - capturedTotal;
    if (remainingBudget <= 0) throw new Error(`required public files exceed total snapshot byte limit ${snapshotLimits.maxTotalSnapshotBytes}`);
    let bytes;
    try {
      bytes = await snapshotFile(resolvedRoot, relative, `required public file ${relative}`, counters,
        Math.min(snapshotLimits.maxFileBytes, remainingBudget), testHooks);
    } catch (error) { throw new Error(`invalid required public file: ${relative}: ${error.message}`); }
    capturedTotal += bytes.length;
    if (capturedTotal > snapshotLimits.maxTotalSnapshotBytes) {
      throw new Error(`required public files exceed total snapshot byte limit ${snapshotLimits.maxTotalSnapshotBytes}`);
    }
    hashes[relative] = sha256(bytes);
    if (manifest.files[relative] !== hashes[relative]) throw new Error(`manifest SHA-256 mismatch: ${relative}`);
    snapshot.set(relative, bytes);
  }
  if (sourceRoot) {
    for (const relative of requiredPublicFiles.filter((file) => file.startsWith('assets/js/'))) {
      const sourceRelative = publicSourceMap[relative];
      if (!sourceRelative) throw new Error(`missing explicit source mapping: ${relative}`);
      const sourceBytes = await snapshotFile(sourceRoot, sourceRelative, `source file ${relative}`,
        counters, snapshotLimits.maxFileBytes, testHooks);
      if (sha256(sourceBytes) !== hashes[relative]) throw new Error(`public/source SHA-256 mismatch: ${relative}`);
    }
  }
  if (counters.opened !== counters.closed) throw new Error('snapshot file descriptor cleanup mismatch');
  const productions = JSON.parse(snapshot.get('assets/data/bdo-productions.json').toString('utf8'));
  const publicationCount = Array.isArray(productions.productions) ? productions.productions.length : -1;
  if (publicationCount !== 13) throw new Error(`publication count mismatch: expected 13, got ${publicationCount}`);
  return {
    publicRoot: resolvedRoot, manifestPath: manifestTarget, manifestSha256, hashes,
    publicationCount, snapshot, snapshotFileCount: snapshot.size, snapshotTotalBytes: capturedTotal,
    snapshotOpenHandles: counters.opened - counters.closed, provenanceModel: 'external-content-addressed-manifest'
  };
}
