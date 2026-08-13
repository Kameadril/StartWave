import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const positional = args.filter(x => x !== '--dry-run');
if (positional.length !== 3) throw new Error('Usage: node patch-json-field.mjs <relative-json> <entity-id> <field-json> [--dry-run]');
const [relativeFile, entityId, fieldSpec] = positional;
const file = path.resolve(root, relativeFile);
if (path.relative(root, file).startsWith('..')) throw new Error('Path must stay inside project root');
const field = JSON.parse((fieldSpec.startsWith('@') ? fs.readFileSync(path.resolve(root, fieldSpec.slice(1)), 'utf8') : fieldSpec).replace(/^\uFEFF/, ''));
if (!field || typeof field.name !== 'string' || !Object.prototype.hasOwnProperty.call(field, 'value')) throw new Error('Field JSON must be {"name":string,"value":...}');
const text = fs.readFileSync(file, 'utf8');
const parsed = JSON.parse(text);
const collection = Object.values(parsed).find(value => Array.isArray(value) && value.some(x => x && typeof x === 'object' && typeof x.id === 'string'));
if (!collection) throw new Error('No entity collection found');
const matches = collection.filter(x => x && x.id === entityId);
if (matches.length !== 1) throw new Error(`Expected exactly one entity ${entityId}, found ${matches.length}`);
const markerRe = new RegExp(`"id"\\s*:\\s*"${entityId.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`);
const marker = text.match(markerRe);
const start = marker?.index ?? -1;
if (start < 0) throw new Error('Exact textual ID not found');
let objectStart = text.lastIndexOf('{', start);
let depth = 0, inString = false, escaped = false, objectEnd = -1;
for (let i = objectStart; i < text.length; i++) {
  const c = text[i];
  if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
  if (c === '"') { inString = true; continue; }
  if (c === '{') depth++;
  if (c === '}' && --depth === 0) { objectEnd = i; break; }
}
if (objectEnd < 0) throw new Error('Unable to determine object boundary');
const originalObject = text.slice(objectStart, objectEnd + 1);
const keyRe = new RegExp(`([,{]\\s*)"${field.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"\\s*:`);
let replacement;
if (keyRe.test(originalObject)) {
  replacement = originalObject.replace(keyRe, (m, prefix) => `${prefix}"${field.name}":${JSON.stringify(field.value)}`);
} else {
  const body = originalObject.slice(0, -1).trimEnd();
  const comma = body.endsWith('{') ? '' : ',';
  replacement = body + comma + `"${field.name}":${JSON.stringify(field.value)}}`;
}
const nextText = text.slice(0, objectStart) + replacement + text.slice(objectEnd + 1);
const nextParsed = JSON.parse(nextText);
const nextCollection = Object.values(nextParsed).find(value => Array.isArray(value) && value.some(x => x && typeof x === 'object' && typeof x.id === 'string'));
const nextEntity = nextCollection.find(x => x && x.id === entityId);
if (JSON.stringify(nextEntity[field.name]) !== JSON.stringify(field.value)) throw new Error('Post-patch field verification failed');
const beforeOthers = collection.filter(x => x.id !== entityId);
const afterOthers = nextCollection.filter(x => x.id !== entityId);
if (JSON.stringify(beforeOthers) !== JSON.stringify(afterOthers)) throw new Error('Non-target entities changed');
const diff = execFileSync('git', ['diff', '--no-ext-diff', '--', relativeFile], { cwd: root, encoding: 'utf8' });
if (dry) { console.log(diff || `${relativeFile}: ${entityId} -> ${field.name}`); process.exit(0); }
const backupDir = path.join(root, '.startwave-agent', 'tmp');
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `${path.basename(file)}.${Date.now()}.bak`);
fs.copyFileSync(file, backup);
const temp = path.join(os.tmpdir(), `${path.basename(file)}.${process.pid}.tmp`);
fs.writeFileSync(temp, nextText, 'utf8');
JSON.parse(fs.readFileSync(temp, 'utf8'));
fs.copyFileSync(temp, file);
fs.unlinkSync(temp);
console.log(`patched ${relativeFile} ${entityId} ${field.name}; backup=${path.relative(root, backup)}`);
