import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demos, demoById, scenarioRecipes } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { demoRevisions } from '../dist/data/demo-revisions.js';
import { middlewares } from '../dist/data/middleware.js';
import { aiInfra } from '../dist/data/ai-infra.js';
import { patterns } from '../dist/data/curriculum.js';
import { readZip } from './lib/archive.mjs';
import { root, projectFiles, sourceHash, compilation } from './lib/demo-project.mjs';

assert.equal(new Set(demos.map(d => d.id)).size, demos.length, 'Duplicate Demo ID');
assert.deepEqual(new Set(demos.map(d => d.id)), new Set([...middlewares, ...aiInfra].map(d => d.id)), 'Demo/lesson coverage differs');
const combined = new Map(); let count = 0, compiled = 0;
for (const demo of demos) {
  for (const key of ['id', 'title', 'summary', 'scenario']) assert.ok(typeof demo[key] === 'string' && demo[key], `${demo.id}: missing ${key}`);
  assert.deepEqual(demo.stages.map(s => s.id), ['connect', 'core', 'scenario']);
  assert.ok(demo.prerequisites.length && demo.sources.length);
  const paths = new Set(demo.files.map(f => f.path)); assert.equal(paths.size, demo.files.length);
  assert.ok(paths.has('pom.xml'));
  assert.equal(demoRevisions[demo.id], sourceHash(demo), 'Source revision index is stale; run npm run build');
  for (const file of demo.files) assert.ok(file.language && file.code.trim());
  for (const stage of demo.stages) {
    assert.ok(stage.title && stage.description);
    for (const key of ['focus', 'commands', 'expected', 'troubleshooting', 'files']) assert.ok(Array.isArray(stage[key]) && stage[key].length, `${demo.id}/${stage.id}: missing ${key}`);
    for (const path of stage.files) assert.ok(paths.has(path), `${demo.id}: missing referenced file ${path}`);
  }
  for (const env of demo.environment) assert.ok(/^[A-Z][A-Z0-9_]*$/.test(env.name) && typeof env.example === 'string' && env.description);
  for (const source of demo.sources) assert.ok(source.label && source.url.startsWith('https://'));
  const expected = await projectFiles(demo, demoValidation);
  const archive = readZip(await readFile(resolve(root, 'dist/demos', demo.id + '.zip')));
  assert.deepEqual(new Set(archive.keys()), new Set([...expected.keys()].map(path => demo.id + '/' + path)), `${demo.id}: unexpected ZIP files`);
  for (const [path, text] of expected) {
    assert.equal(await readFile(resolve(root, 'dist/demos', demo.id, path), 'utf8'), text, `${demo.id}/${path}: exported source mismatch`);
    assert.equal(archive.get(demo.id + '/' + path)?.toString('utf8'), text, `${demo.id}/${path}: archive mismatch`);
    assert.equal(await readFile(resolve(root, '.cache/site/demos', demo.id, path), 'utf8'), text, `${demo.id}/${path}: publication mismatch`);
    combined.set(demo.id + '/' + path, Buffer.from(text)); count++;
  }
  const result = compilation(demo, demoValidation);
  if (result?.passed && result.sourceHash === sourceHash(demo)) compiled++;
}
const all = readZip(await readFile(resolve(root, 'dist/demos/agent-middleware-demos.zip')));
assert.deepEqual(new Set(all.keys()), new Set(combined.keys()), 'Combined ZIP has unexpected or missing files');
for (const [path, bytes] of combined) assert.deepEqual(all.get(path), bytes);
for (const pattern of patterns) {
  const recipe = scenarioRecipes[pattern.id]; assert.ok(recipe?.steps.length >= 3, `${pattern.id}: missing recipe`);
  for (const step of recipe.steps) assert.ok(demoById[step.id] && step.join);
}
console.log(`Demo checks passed: ${demos.length} projects, ${demos.reduce((n,d)=>n+d.stages.length,0)} stages, ${count} published files, ${patterns.length} scenarios.`);
console.log(`All source files and complete archive contents agree; ${compiled}/${demos.length} current compilation records.`);
