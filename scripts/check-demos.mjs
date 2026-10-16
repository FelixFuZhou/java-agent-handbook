import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { demos, demoById, scenarioRecipes } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { middlewares } from '../dist/data/middleware.js';
import { aiInfra } from '../dist/data/ai-infra.js';
import { patterns } from '../dist/data/curriculum.js';

const exec=promisify(execFile);
assert.equal(demos.length,23,'必须覆盖全部 23 个中间件与工程能力');
assert.equal(new Set(demos.map(d=>d.id)).size,demos.length,'Demo ID 重复');
assert.deepEqual(new Set(demos.map(d=>d.id)),new Set([...middlewares,...aiInfra].map(d=>d.id)),'Demo 与章节不对应');
let files=0;
for(const d of demos) {
  for(const key of ['id','title','summary','scenario'])assert.ok(typeof d[key]==='string'&&d[key],`${d.id}: 缺 ${key}`);
  assert.deepEqual(d.stages.map(s=>s.id),['connect','core','scenario'],`${d.id}: 三层示例不完整`);
  assert.ok(d.prerequisites.length&&d.sources.length,`${d.id}: 缺前提或来源`);
  const paths=new Set(d.files.map(f=>f.path));assert.equal(paths.size,d.files.length,`${d.id}: 文件路径重复`);
  assert.ok(paths.has('pom.xml'),`${d.id}: 缺少 Maven 项目`);
  for(const f of d.files) {
    assert.ok(/^[\w.\/-]+$/.test(f.path)&&!f.path.includes('..')&&!f.path.startsWith('/'),`${d.id}: 文件路径非法`);
    assert.ok(f.language&&f.code.trim(),`${d.id}/${f.path}: 文件为空`);
    const exported=await readFile(new URL(`../dist/demos/${d.id}/${f.path}`,import.meta.url),'utf8');
    assert.equal(exported,f.code,`${d.id}/${f.path}: 下载内容与页面源码不一致，请 npm run export:demos`);files++;
  }
  for(const s of d.stages) {
    assert.ok(s.title&&s.description,`${d.id}/${s.id}: 缺说明`);
    for(const k of ['focus','commands','expected','troubleshooting','files'])assert.ok(Array.isArray(s[k])&&s[k].length,`${d.id}/${s.id}: 缺 ${k}`);
    for(const path of s.files)assert.ok(paths.has(path),`${d.id}/${s.id}: 引用了不存在的文件 ${path}`);
  }
  for(const e of d.environment)assert.ok(/^[A-Z][A-Z0-9_]*$/.test(e.name)&&typeof e.example==='string'&&e.description,`${d.id}: 环境变量缺字段`);
  for(const s of d.sources)assert.ok(s.label&&s.url.startsWith('https://'),`${d.id}: 来源错误`);
  const validation=demoValidation[d.id];
  if(validation?.compiled) assert.equal(validation.sourceHash,createHash('sha256').update(JSON.stringify(d.files)).digest('hex'),`${d.id}: 源码已更新，请重新编译确认或移除过时的成功标记`);
  const archive=new URL(`../dist/demos/${d.id}.zip`,import.meta.url);
  assert.ok((await stat(archive)).size>100,`${d.id}: 缺下载包`);
  const {stdout}=await exec('unzip',['-Z1',fileURLToPath(archive)]);
  assert.ok(stdout.includes(`${d.id}/pom.xml`)&&stdout.includes(`${d.id}/README.md`),`${d.id}: 压缩包不完整`);
  assert.ok(!stdout.includes('/target/'),`${d.id}: 下载包不应包含编译产物`);
}
for(const p of patterns) {
  const recipe=scenarioRecipes[p.id];assert.ok(recipe?.steps.length>=3,`${p.id}: 缺场景核心代码`);
  for(const step of recipe.steps)assert.ok(demoById[step.id]&&step.join,`${p.id}: 场景映射错误`);
}
assert.ok((await stat(new URL('../dist/demos/agent-middleware-demos.zip',import.meta.url))).size>1000);
console.log(`Demo 验证通过：${demos.length} 个项目、${demos.length*3} 个阶段、${files} 个源码/配置文件、4 个场景代码映射。`);
console.log(`页面与下载文件一致；${Object.values(demoValidation).filter(v=>v.compiled).length} 个项目有当前源码的编译通过记录。`);
