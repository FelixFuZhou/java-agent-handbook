// Maintainer check: compile declared demo files in isolated build directories.
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { root, sourceHash, writeFiles } from './lib/demo-project.mjs';
import { maven, environment, saveValidation, saveReport } from './lib/verification.mjs';

const reportOnly = process.argv.includes('--report-only');
const selected = process.argv.find(v => v.startsWith('--only='))?.slice(7).split(',');
if (selected?.some(id => !demos.some(d => d.id === id))) throw new Error('Unknown demo ID in --only.');
const pending = demos.filter(d => !selected || selected.includes(d.id));
const metadata = await environment(), records = { ...demoValidation }, report = {};
await mkdir(resolve(root, 'artifacts/demo-checks'), { recursive: true });
let cursor = 0, failed = 0;
async function worker() {
  while (cursor < pending.length) {
    const d = pending[cursor++], cwd = resolve(root, '.cache/demo-builds', d.id);
    await writeFiles(cwd, new Map(d.files.map(f => [f.path, f.code])));
    let output = '', passed = false;
    try {
      const result = await maven(['compile'], cwd); output = result.stdout + result.stderr; passed = true;
    } catch (error) { output = (error.stdout || '') + (error.stderr || '') + '\n' + error.message; failed++; }
    const result = { passed, sourceHash: sourceHash(d), checkedAt: new Date().toISOString(), ...metadata };
    report[d.id] = result;
    // Do not reset runtimeCheck or its independent provenance on compilation.
    records[d.id] = { ...records[d.id], compiled: passed, sourceHash: result.sourceHash, checkedAt: result.checkedAt, compilation: result };
    await writeFile(resolve(root, 'artifacts/demo-checks', d.id + '.log'), output);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${d.id}`);
  }
}
await Promise.all([worker(), worker(), worker()]);
await saveReport('compilation-report.json', report);
if (!reportOnly) await saveValidation(records);
console.log(`Compilation: ${pending.length - failed}/${pending.length}; report-only=${reportOnly}`);
if (failed) process.exitCode = 1;
