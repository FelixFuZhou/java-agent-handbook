// 可选的维护检查：真实编译下载项目，不要求启动中间件，也不是学习者测验。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const exec=promisify(execFile);
const selected=process.argv.find(v=>v.startsWith('--only='))?.slice(7).split(',');
const pending=demos.filter(d=>!selected||selected.includes(d.id));
const results={...demoValidation};
await mkdir(resolve(root,'artifacts/demo-checks'),{recursive:true});
await mkdir(resolve(root,'.cache'),{recursive:true});
const settings=resolve(root,'.cache/demo-maven-settings.xml');
await writeFile(settings,'<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><mirrors><mirror><id>demo-central</id><mirrorOf>*</mirrorOf><url>https://repo.maven.apache.org/maven2</url></mirror></mirrors></settings>');
let cursor=0, failed=0;
async function worker() {
  while(cursor<pending.length) {
    const d=pending[cursor++];const cwd=resolve(root,'dist/demos',d.id);
    const hash=createHash('sha256').update(JSON.stringify(d.files)).digest('hex');
    // 每次直接从数据源写入，避免对过时导出物进行编译。
    for(const f of d.files){const p=resolve(cwd,f.path);await mkdir(dirname(p),{recursive:true});await writeFile(p,f.code);}
    let output='';
    try {
      const r=await exec(process.env.MAVEN_CMD||'mvn',['-B','-s',settings,'-Dstyle.color=never','compile'],{cwd,timeout:240000,maxBuffer:12*1024*1024});
      output=r.stdout+r.stderr;
      results[d.id]={compiled:true,sourceHash:hash,checkedAt:new Date().toISOString(),runtime:'外部服务待按前提联调'};
      console.log(`PASS ${d.id}`);
    } catch(e) {
      output=(e.stdout||'')+(e.stderr||'')+'\n'+e.message;
      results[d.id]={compiled:false,sourceHash:hash,checkedAt:new Date().toISOString(),runtime:'编译未通过，查看维护日志'};
      console.log(`FAIL ${d.id}: ${output.match(/\[ERROR\].*/)?.[0]||e.message}`);failed++;
    }
    await writeFile(resolve(root,'artifacts/demo-checks',d.id+'.log'),output);
  }
}
await Promise.all([worker(),worker(),worker()]);
await writeFile(resolve(root,'dist/data/demo-validation.js'),'// 实际 Maven 编译结果；runtime 仅记录执行过的检查。\nexport const demoValidation = '+JSON.stringify(results,null,2)+';\n');
console.log(`编译检查：${pending.length-failed}/${pending.length} 通过。日志：artifacts/demo-checks/`);
if(failed)process.exitCode=1;
