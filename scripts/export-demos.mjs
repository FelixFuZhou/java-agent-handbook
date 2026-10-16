import { mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist/demos');
const exec=promisify(execFile);
await mkdir(output,{recursive:true});
const quote=s=>"'"+s.replaceAll("'","'\"'\"'")+"'";
export function readme(d) {
  const v=demoValidation[d.id];
  return `# ${d.title}\n\n${d.summary}\n\n## 场景\n\n${d.scenario}\n\n## 运行前提\n\n${d.prerequisites.map(v=>'- '+v).join('\n')}\n\n所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。\n\n\`\`\`bash\n${d.environment.map(e=>`# ${e.description}\nexport ${e.name}=${quote(e.example)}`).join('\n')}\n\`\`\`\n\n${d.stages.map((s,i)=>`## 0${i+1} ${s.title}\n\n${s.description}\n\n${s.focus.map(v=>'- '+v).join('\n')}\n\n阅读源码：\n\n${s.files.map(p=>`- [${p}](${p})`).join('\n')}\n\n运行：\n\n\`\`\`bash\n${s.commands.join('\n\n')}\n\`\`\`\n\n预期：\n\n${s.expected.map(v=>'- '+v).join('\n')}\n\n排障：\n\n${s.troubleshooting.map(v=>'- '+v).join('\n')}`).join('\n\n')}\n\n## 验证边界\n\n${v?.compiled?'已通过 Maven 编译（JDK 21，--release 17）。':'未记录 Java 编译结果。'}${v?.runtime||'外部中间件和模型服务未在制作环境联调，请按前提配置后运行。'}\n\n编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。\n\n## 官方资料\n\n${d.sources.map(s=>`- [${s.label}](${s.url})`).join('\n')}\n`;
}
for(const d of demos) {
  const dir=resolve(output,d.id);
  await mkdir(dir,{recursive:true});
  for(const f of [...d.files,{path:'README.md',code:readme(d)}]) {
    if(!/^[a-zA-Z0-9_.\/-]+$/.test(f.path)||f.path.includes('..')||f.path.startsWith('/'))throw new Error('非法源码路径 '+f.path);
    const dest=resolve(dir,f.path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,f.code);
  }
  await writeFile(resolve(dir,'.gitignore'),'target/\n.env\n*.log\n');
  const zip=resolve(output,d.id+'.zip');await rm(zip,{force:true});
  await exec('zip',['-q','-r',zip,d.id,'-x','*/target/*','*.log'],{cwd:output});
}
const all=resolve(output,'agent-middleware-demos.zip');await rm(all,{force:true});
await exec('zip',['-q','-r',all,...demos.map(d=>d.id),'-x','*/target/*','*.log'],{cwd:output});
console.log(`已导出 ${demos.length} 个完整项目、单项目 ZIP 与全部项目 ZIP。`);
