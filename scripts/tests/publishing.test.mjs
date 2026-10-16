import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createZip, readZip } from '../lib/archive.mjs';
import { root } from '../lib/demo-project.mjs';

const exec = promisify(execFile);
test('ZIP archives are deterministic and readable by an independent unzip implementation', async t => {
  const content = '中文源码与许可证\n', entries = new Map([['demo/README.md', content], ['demo/empty.txt', '']]);
  const archive = createZip(entries);
  assert.deepEqual(archive, createZip(new Map([...entries].reverse())));
  assert.equal(readZip(archive).get('demo/README.md').toString('utf8'), content);
  if (spawnSync('unzip', ['-v']).status !== 0) { t.diagnostic('System unzip unavailable; native ZIP integrity checks still executed.'); return; }
  const dir = await mkdtemp(resolve(tmpdir(), 'handbook-zip-'));
  try {
    const path = resolve(dir, 'project.zip'); await writeFile(path, archive);
    const output = await exec('unzip', ['-p', path, 'demo/README.md']); assert.equal(output.stdout, content);
    await exec('unzip', ['-t', path]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('ZIP writer rejects traversal and duplicate names; reader rejects corrupt content', () => {
  for (const path of ['../secret', '/absolute', 'a/../secret', 'a//b']) assert.throws(() => createZip([[path, 'x']]));
  assert.throws(() => createZip([['a.txt', 'x'], ['a.txt', 'y']]));
  const zip = Buffer.from(createZip([['file.txt', 'original content']])); zip[40] ^= 0xff;
  assert.throws(() => readZip(zip));
});
test('local files stay local when generating Demo archives and the Pages directory', async () => {
  const name = 'packaging-probe-' + randomUUID() + '.env';
  const local = resolve(root, 'dist/demos/evaluation', name), siteFile = resolve(root, 'dist', name);
  try {
    await writeFile(local, 'non-secret packaging fixture', { flag: 'wx' });
    await writeFile(siteFile, 'non-secret packaging fixture', { flag: 'wx' });
    await exec(process.execPath, ['scripts/export-demos.mjs'], { cwd: root });
    await exec(process.execPath, ['scripts/build-site.mjs'], { cwd: root });
    const archive = readZip(await readFile(resolve(root, 'dist/demos/evaluation.zip')));
    const combined = readZip(await readFile(resolve(root, 'dist/demos/agent-middleware-demos.zip')));
    assert.ok([...archive.keys(), ...combined.keys()].every(path => !path.includes(name)));
    assert.ok(archive.has('evaluation/LICENSE') && archive.has('evaluation/THIRD_PARTY_NOTICES.md'));
    await assert.rejects(readFile(resolve(root, '.cache/site/demos/evaluation', name)));
    await assert.rejects(readFile(resolve(root, '.cache/site', name)));
    assert.equal(await readFile(local, 'utf8'), 'non-secret packaging fixture');
  } finally {
    for (const path of [local, siteFile]) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
});
