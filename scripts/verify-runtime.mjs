// Offline fixtures only: no credentials, databases, queues, Docker or models.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demoById } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { root, sourceHash, writeFiles } from './lib/demo-project.mjs';
import { maven, environment, saveValidation, saveReport } from './lib/verification.mjs';

const reportOnly = process.argv.includes('--report-only'), metadata = await environment();
const records = { ...demoValidation }, report = {};
await mkdir(resolve(root, 'artifacts/demo-checks'), { recursive: true });
const checks = [
  { id: 'evaluation', names: ['ConnectDemo', 'CoreDemo', 'ScenarioDemo'], summary: '三阶段已本地运行（固定评测样本）', check: async output => {
    assert.match(output, /loaded=3/); assert.match(output, /baseline Recall@3=1\.000 MRR@3=0\.833 denied=0/);
    assert.match(output, /candidate Recall@3=0\.833 MRR@3=0\.833 denied=1/); assert.match(output, /RELEASE_BLOCKED/);
  } },
  { id: 'document-parsing', names: ['ConnectDemo', 'CoreDemo', 'ScenarioDemo'], summary: 'TXT → JSONL 三阶段通过；PDF/OCR 未验证', check: async (output, cwd) => {
    assert.match(output, /mime=text\/plain/);
    const rows = (await readFile(resolve(cwd, 'target/chunks.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(rows.length, 2); assert.equal(new Set(rows.map(c => c.id)).size, rows.length);
    assert.ok(rows.every(c => c.tenant === 'team-a' && c.documentId && c.version && c.text && c.mime === 'text/plain'));
  } },
  { id: 'observability', names: ['ConnectDemo', 'CoreDemo'], summary: '本地接入/核心 Trace 通过；OTLP 未联调', check: async output => {
    assert.match(output, /core-success/); assert.match(output, /core-failure/); assert.match(output, /core-parent/); assert.match(output, /flush success=true/);
    const spans = [...output.matchAll(/'(core-(?:success|failure|parent))'\s*:\s*([a-f0-9]{32})/g)];
    assert.equal(spans.length, 3); assert.equal(new Set(spans.map(s => s[2])).size, 1);
  } }
];
for (const fixture of checks) {
  const demo = demoById[fixture.id], cwd = resolve(root, '.cache/demo-builds', demo.id);
  await writeFiles(cwd, new Map(demo.files.map(f => [f.path, f.code])));
  // Remove fixture-related user environment to make the run reproducible and offline.
  for (const key of ['DOCUMENT_PATH', 'DOCUMENT_TENANT', 'DOCUMENT_SOURCE', 'OUTPUT_PATH', 'EVAL_FILE', 'DEMO_OTLP_ENDPOINT', 'DEMO_OTLP_AUTHORIZATION']) delete process.env[key];
  let output = '', passed = false;
  try {
    for (const name of fixture.names) {
      const result = await maven(['-q', 'compile', 'exec:java', '-Dexec.mainClass=demo.' + name], cwd);
      output += result.stdout + result.stderr;
    }
    await fixture.check(output, cwd); passed = true;
  } catch (error) { output += (error.stdout || '') + (error.stderr || '') + '\n' + error.message; }
  const result = { passed, summary: passed ? fixture.summary : '离线固定样本检查未通过', sourceHash: sourceHash(demo), checkedAt: new Date().toISOString(), fixtures: fixture.names, ...metadata };
  report[demo.id] = result;
  records[demo.id] = { ...records[demo.id], runtime: result.summary, runtimeCheck: result };
  await writeFile(resolve(root, 'artifacts/demo-checks', demo.id + '-runtime.log'), output);
  console.log(`${passed ? 'PASS' : 'FAIL'} offline ${demo.id}`);
}
await saveReport('runtime-report.json', report);
if (!reportOnly) await saveValidation(records);
if (Object.values(report).some(r => !r.passed)) process.exitCode = 1;
