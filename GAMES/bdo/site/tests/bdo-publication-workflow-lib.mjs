import { createHash } from 'node:crypto';
import { fstatSync, readSync, writeSync } from 'node:fs';
import path from 'node:path';
import { snapshotLimits, verifyPublicRoot } from './bdo-browser-provenance.mjs';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const validDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function equalHashSets(left, right) {
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) || Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith('--') || index + 1 >= argv.length) throw new Error('arguments must be --name value pairs');
    if (Object.hasOwn(result, key.slice(2))) throw new Error(`duplicate argument: ${key}`);
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

const blockedWrite = (operation) => {
  throw new Error(`BLOCKED_UNSAFE_NODE_PATH_WRITE: ${operation} requires an owner-controlled descriptor-relative materializer; Node.js on macOS does not expose openat/mkdirat/renameat primitives`);
};

// v3.1 wrote a pathname after checking its parent. That cannot be made race-free
// with the standard Node.js/macOS API. v3.2 fails closed instead of overstating
// a descriptor-relative guarantee. The independent owner must materialize the
// publication with a separately reviewed openat-style helper.
export async function preparePublication() { blockedWrite('publication creation'); }
export async function recordTrustAnchor() { blockedWrite('trust-anchor creation'); }

export function parseInheritedFd(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) throw new Error('trust anchor fd must be an explicit inherited descriptor number');
  const fd = Number(value);
  if (!Number.isSafeInteger(fd) || fd < 3) throw new Error('trust anchor fd must be an inherited descriptor >= 3');
  return fd;
}

export function readBoundedFd(fd, limit, label, testHooks) {
  // Node does not expose fcntl(F_GETFL). A zero-length write is non-mutating;
  // macOS rejects it with EBADF for O_RDONLY and accepts it for writable FDs.
  // Fail closed on acceptance or on any result other than EBADF.
  try {
    writeSync(fd, Buffer.alloc(0), 0, 0, null);
    throw new Error(`${label} descriptor must be O_RDONLY`);
  } catch (error) {
    if (error?.message?.includes('descriptor must be O_RDONLY')) throw error;
    if (error?.code !== 'EBADF') throw new Error(`${label} descriptor access mode could not be proven O_RDONLY`);
  }
  const opened = fstatSync(fd, { bigint: true });
  if (!opened.isFile()) throw new Error(`${label} must be a regular file`);
  if (opened.size > BigInt(limit)) throw new Error(`${label} exceeds byte limit ${limit}`);
  if (opened.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} size is not safely representable`);
  testHooks?.afterFstat?.({ fd, size: opened.size });
  const bytes = Buffer.alloc(Number(opened.size));
  let offset = 0;
  while (offset < bytes.length) {
    const bytesRead = readSync(fd, bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
    if (!bytesRead) throw new Error(`${label} shrank while reading`);
    offset += bytesRead;
    testHooks?.afterReadChunk?.({ fd, offset, expectedSize: bytes.length });
  }
  const overflow = Buffer.allocUnsafe(1);
  if (readSync(fd, overflow, 0, 1, offset) !== 0) throw new Error(`${label} grew while reading`);
  const after = fstatSync(fd, { bigint: true });
  if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size) throw new Error(`${label} changed while reading`);
  return bytes;
}

export async function verifyTrustAnchor({ publicationRoot, manifestPath, anchorFd, testHooks }) {
  if (![publicationRoot, manifestPath].every((value) => path.isAbsolute(value ?? ''))) throw new Error('publication and manifest paths must be absolute');
  const anchorBytes = readBoundedFd(anchorFd, snapshotLimits.maxManifestBytes, 'trust anchor', testHooks);
  const anchor = JSON.parse(anchorBytes.toString('utf8'));
  if (anchor.schemaVersion !== 1 || !validDigest(anchor.manifestSha256) || !anchor.files || Array.isArray(anchor.files)) throw new Error('invalid trust anchor schema');
  const verified = await verifyPublicRoot({ publicRoot: publicationRoot, manifestPath, manifestSha256: anchor.manifestSha256 });
  if (anchor.publicationRoot !== verified.publicRoot || anchor.manifestPath !== verified.manifestPath) throw new Error('trust anchor is bound to a different publication identity');
  if (!equalHashSets(anchor.files, verified.hashes)) throw new Error('trust anchor full hash-set mismatch');
  return { manifestSha256: anchor.manifestSha256, publicationRoot: verified.publicRoot, hashes: verified.hashes };
}
