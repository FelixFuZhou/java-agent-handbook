import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { root, projectFiles } from './lib/demo-project.mjs';

// Explicit website assets + JavaScript data modules; no recursive copy of a demo working directory.
const assets = ['index.html', 'app.js', 'icons.js', 'demo-view.js', 'styles.css', 'demo-styles.css', 'favicon.svg'];
for (const item of await readdir(resolve(root, 'dist/data'), { withFileTypes: true }))
  if (item.isFile() && item.name.endsWith('.js')) assets.push('data/' + item.name);
const destination = resolve(root, '.cache/site');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
async function put(path, bytes) {
  const file = resolve(destination, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes);
}
for (const asset of assets) await put(asset, await readFile(resolve(root, 'dist', asset)));
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'licenses/lucide-LICENSE', 'docs/icon-provenance.json']) await put(name, await readFile(resolve(root, name)));
for (const demo of demos) {
  const files = await projectFiles(demo, demoValidation);
  for (const [path, bytes] of files) await put('demos/' + demo.id + '/' + path, bytes);
  await put('demos/' + demo.id + '.zip', await readFile(resolve(root, 'dist/demos', demo.id + '.zip')));
}
await put('demos/agent-middleware-demos.zip', await readFile(resolve(root, 'dist/demos/agent-middleware-demos.zip')));
await put('.nojekyll', '');
console.log('Publish directory ready: .cache/site (allowlisted assets only).');
