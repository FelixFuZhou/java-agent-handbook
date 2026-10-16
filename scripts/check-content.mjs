import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { middlewares } from '../dist/data/middleware.js';
import { foundations, patterns } from '../dist/data/curriculum.js';
import { aiInfra } from '../dist/data/ai-infra.js';

const lessons=[...foundations,...middlewares,...aiInfra,...patterns];
const ids=new Set(lessons.map(l=>l.id));
assert.equal(ids.size,lessons.length,'内容 ID 重复');
assert.ok(foundations.length && middlewares.length && aiInfra.length && patterns.length, '课程分组不能为空');
for(const l of lessons){
 for(const field of ['id','title','category','tagline','level','priority','kind','summary']) assert.ok(typeof l[field]==='string'&&l[field].trim(),`${l.id}: 缺少 ${field}`);
 assert.ok(['基础','存储','检索','执行','治理','工程','场景'].includes(l.category),`${l.id}: 分类错误`);
 assert.ok(Number.isFinite(l.minutes)&&l.minutes>0,`${l.id}: 阅读时间错误`);
 for(const [key,min] of [['when',1],['notFor',1],['concepts',3],['flow',2],['sections',3],['decisions',2],['pitfalls',2],['qa',2],['sources',1],['related',1]]) assert.ok(Array.isArray(l[key])&&l[key].length>=min,`${l.id}: ${key} 不完整`);
 for(const c of l.concepts)assert.ok(c.title&&c.text,`${l.id}: 概念缺正文`);
 for(const s of l.sections){assert.ok(s.title&&Array.isArray(s.paragraphs)&&s.paragraphs.length,`${l.id}: 章节缺正文`);if(s.code)for(const k of ['language','label','value'])assert.ok(typeof s.code[k]==='string'&&s.code[k],`${l.id}: 代码缺 ${k}`);}
 for(const q of l.qa)assert.ok(q.q&&q.a&&q.a.length>35,`${l.id}: 问答缺少充分解释`);
 for(const r of l.related)assert.ok(ids.has(r),`${l.id}: 无效关联 ${r}`);
 for(const s of l.sources)assert.ok(s.label&&/^https:\/\//.test(s.url),`${l.id}: 资料链接错误`);
}
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
assert.ok(!/https:\/\/.*(?:fonts|cdn)/i.test(app),'运行时不应依赖远程 CDN');
console.log(`内容验证通过：${lessons.length} 篇文章，${lessons.reduce((n,l)=>n+l.qa.length,0)} 组问答，${lessons.reduce((n,l)=>n+l.sections.filter(s=>s.code).length,0)} 个代码示例。`);
console.log('分类、必需字段、关联文章、来源链接与代码结构均完整。外部中间件示例需按正文前提另行部署验证。');
