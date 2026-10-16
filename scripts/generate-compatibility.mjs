import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { demos } from '../dist/data/demos.js';
import { demoValidation } from '../dist/data/demo-validation.js';
import { root, sourceHash, compilation, runtimeSummary } from './lib/demo-project.mjs';

const revisions = Object.fromEntries(demos.map(d => [d.id, sourceHash(d)]));
await writeFile(resolve(root, 'dist/data/demo-revisions.js'), '// 由 npm run build 生成；只包含源码哈希，不包含本机配置。\nexport const demoRevisions = ' + JSON.stringify(revisions, null, 2) + ';\n');
const cell = s => String(s || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const rows = demos.map(d => {
  const pom = d.files.find(f => f.path === 'pom.xml').code;
  const dependencies = [...pom.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map(m => {
    const artifact = /<artifactId>(.*?)<\/artifactId>/.exec(m[1])?.[1];
    const version = /<version>(.*?)<\/version>/.exec(m[1])?.[1];
    return `${artifact}@${version}`;
  }).join('；') || 'JDK 标准库';
  const c = compilation(d, demoValidation), fresh = c?.passed && c.sourceHash === revisions[d.id];
  const status = fresh ? `通过：JDK ${c.javaVersion || '未记录'} / release ${c.release || 17}` : '当前源码待编译';
  return `| [${cell(d.title)}](#${d.id}) | ${cell(dependencies)} | ${cell(status)} | ${cell(runtimeSummary(d, demoValidation))} |`;
});
await mkdir(resolve(root, 'docs'), { recursive: true });
await writeFile(resolve(root, 'docs/compatibility.md'), `# 依赖与验证状态\n\n此表由 \`npm run build\` 从项目源码和验证记录生成，请勿直接修改。依赖版本是当前示例锁定值，不代表最新版本。Java 编译目标为 17；编译环境与真实服务运行分开记录。\n\n每个项目的服务端版本、模型/地域、权限与运行前提见下方项目说明。完整项目由内容源生成，克隆后运行 \`npm run build\`，或在在线站点“实战代码库”中下载。\n\n| 项目说明 | 锁定的直接依赖 | 当前源码编译 | 运行验证范围 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n${demos.map(d=>`<a id="${d.id}"></a>\n\n## ${d.title}\n\n${d.prerequisites.map(p=>'- '+p).join('\n')}\n`).join('\n')}\n## 如何理解结果\n\n- 编译通过验证 Java 语法与依赖 API，不代表外部数据库、消息系统或模型服务已经联调。\n- 离线运行只使用随项目提供的 TXT、CSV 和本地 OTel 日志，不调用外部服务；运行明细写入 \`artifacts/demo-checks/\`。\n- 源码哈希变化后，旧编译/运行记录会显示为待验证；历史记录保留用于追溯。\n- \`npm run verify:demos\` 写入实际 JDK、Maven、OS、时间、源码哈希与 Git/Actions 上下文，不覆盖运行记录。\n- \`npm run verify:runtime\` 只更新运行记录；第三方服务的真实联调需在项目内按前提执行。\n`);
console.log(`Generated dependency/status table and ${demos.length} source revisions.`);
