import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { createZip } from './lib/archive.mjs';
import { root, projectFiles, writeFiles } from './lib/demo-project.mjs';

const output = resolve(root, 'dist/demos');
await mkdir(output, { recursive: true });
const combined = new Map();
for (const demo of demos) {
  // Only declared files enter archives; local .env, logs and build output are never read.
  const files = await projectFiles(demo, demoValidation);
  await writeFiles(resolve(output, demo.id), files);
  const archive = new Map([...files].map(([path, code]) => [demo.id + '/' + path, code]));
  await writeFile(resolve(output, demo.id + '.zip'), createZip(archive));
  for (const item of archive) combined.set(...item);
}
await writeFile(resolve(output, 'agent-middleware-demos.zip'), createZip(combined));
console.log(`Exported ${demos.length} source projects and deterministic, allowlisted ZIP archives.`);
