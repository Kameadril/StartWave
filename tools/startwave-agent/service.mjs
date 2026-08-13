import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'tools/startwave-agent/config.json'), 'utf8'));
const state = path.join(root, '.startwave-agent');
const dirs = Object.fromEntries(['queue', 'claims', 'runs', 'logs', 'failed'].map((name) => [name, path.join(state, name)]));
for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });

function insideRoot(candidate) {
  const resolved = path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Path escapes project root: ${candidate}`);
  return resolved;
}

function validateJob(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw new Error('Job must be a JSON object.');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{5,63}$/.test(job.id ?? '')) throw new Error('Invalid job id.');
  if (!Number.isFinite(Date.parse(job.createdAt))) throw new Error('Invalid createdAt.');
  if (!['llm-only', 'atlas-analysis'].includes(job.type)) throw new Error('Invalid job type.');
  if (typeof job.prompt !== 'string' || !job.prompt.trim() || job.prompt.length > config.maxPromptChars) throw new Error('Invalid prompt.');
  if (job.files !== undefined && (!Array.isArray(job.files) || job.files.length > config.maxFiles)) throw new Error('Invalid files list.');
  if (job.validation !== undefined && typeof job.validation !== 'boolean') throw new Error('validation must be boolean.');
  const files = (job.files ?? []).map((relative) => {
    if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error(`File path must be relative: ${relative}`);
    const absolute = insideRoot(relative);
    const stat = fs.statSync(absolute);
    if (!stat.isFile() || stat.size > config.maxFileBytes) throw new Error(`File is invalid or too large: ${relative}`);
    return { relative: path.relative(root, absolute), absolute };
  });
  if (job.type === 'llm-only' && files.length) throw new Error('llm-only jobs cannot read files.');
  return files;
}

function writeJsonNew(target, value) { fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); }

async function callOllama(job, files) {
  const context = files.map(({ relative, absolute }) => `\n--- FILE: ${relative} ---\n${fs.readFileSync(absolute, 'utf8')}`).join('');
  const prompt = `Ты локальный агент только для чтения. Не изменяй файлы и не предлагай команды. Отвечай по-русски, кратко и фактологично.\n\nЗАДАЧА:\n${job.prompt}${context}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(`${config.ollamaUrl}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: config.model, prompt, stream: false, options: { num_ctx: config.num_ctx, num_predict: config.num_predict } }), signal: controller.signal });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

function runAtlas() {
  const worker = path.join(root, 'tools/atlas-agent/agent.mjs');
  const run = (mode) => spawnSync(process.execPath, [worker, mode], { cwd: root, encoding: 'utf8', timeout: 120000 });
  const validate = run('validate');
  const report = run('report');
  const lines = `${report.stdout ?? ''}${report.stderr ?? ''}`.split(/\r?\n/);
  return { validateExitCode: validate.status, reportExitCode: report.status, validateSummary: `${validate.stdout ?? ''}${validate.stderr ?? ''}`.split(/\r?\n/).find((x) => x.startsWith('SUMMARY ')) ?? '', reportSummary: lines.find((x) => x.startsWith('SUMMARY ')) ?? '', reportPath: (lines.find((x) => x.startsWith('REPORT ')) ?? '').replace(/^REPORT\s+/, '') };
}

async function processClaim(claimPath) {
  const startedAt = new Date().toISOString();
  let job;
  try {
    job = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
    const files = validateJob(job);
    const ollama = await callOllama(job, files);
    const atlas = job.type === 'atlas-analysis' && job.validation !== false ? runAtlas() : null;
    const failed = atlas && (atlas.validateExitCode !== 0 || atlas.reportExitCode !== 0);
    const result = { id: job.id, status: failed ? 'FAILED' : 'DONE', createdAt: job.createdAt, startedAt, finishedAt: new Date().toISOString(), type: job.type, model: config.model, response: ollama.response?.trim() ?? '', atlas };
    writeJsonNew(path.join(dirs.runs, `${job.id}.json`), result);
    fs.unlinkSync(claimPath);
    console.log(`${result.status} ${job.id}`);
    return result;
  } catch (error) {
    const id = job?.id ?? path.basename(claimPath, '.json');
    const result = { id, status: 'FAILED', startedAt, finishedAt: new Date().toISOString(), error: error.message };
    try { writeJsonNew(path.join(dirs.runs, `${id}.json`), result); } catch {}
    try { fs.renameSync(claimPath, path.join(dirs.failed, path.basename(claimPath))); } catch {}
    console.error(`FAILED ${id}: ${error.message}`);
    return result;
  }
}

async function once() {
  for (const name of fs.readdirSync(dirs.queue).filter((x) => x.endsWith('.json')).sort()) {
    const claim = path.join(dirs.claims, name);
    try { fs.renameSync(path.join(dirs.queue, name), claim); return await processClaim(claim); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  console.log('IDLE');
  return null;
}

const command = process.argv[2] ?? 'start';
if (!['start', 'once'].includes(command)) { console.error('Usage: node service.mjs <start|once>'); process.exit(2); }
if (command === 'once') await once();
else {
  console.log(`StartWave Agent started; queue=${path.relative(root, dirs.queue)} model=${config.model}`);
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  while (!stopping) { await once(); await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs)); }
}
