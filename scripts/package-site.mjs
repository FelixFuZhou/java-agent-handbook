import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createZip } from './lib/archive.mjs';
import { root } from './lib/demo-project.mjs';

const source = resolve(root, '.cache/site'), entries = new Map();
async function visit(dir, prefix = '') {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + item.name;
    if (item.isDirectory()) await visit(resolve(dir, item.name), path + '/');
    else if (item.isFile()) entries.set(path, await readFile(resolve(dir, item.name)));
    else throw new Error('Website artifact cannot contain links or special files.');
  }
}
await visit(source);
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await writeFile(resolve(root, 'artifacts/java-agent-handbook-site.zip'), createZip(entries));
console.log('Website release archive: artifacts/java-agent-handbook-site.zip');
