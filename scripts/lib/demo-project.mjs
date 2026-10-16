import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { safePath } from './archive.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const sourceHash = d => createHash('sha256').update(JSON.stringify(d.files)).digest('hex');
const shellQuote = s => "'" + s.replaceAll("'", "'\"'\"'") + "'";
export function compilation(d, validation) {
  const v = validation[d.id];
  return v?.compilation || (v ? { passed: v.compiled, sourceHash: v.sourceHash, checkedAt: v.checkedAt, javaVersion: '21.0.5', release: 17, environment: '历史本地校验' } : null);
}
export function runtimeSummary(d, validation) {
  const v = validation[d.id];
  if (v?.runtimeCheck) return v.runtimeCheck.sourceHash === sourceHash(d) ? v.runtimeCheck.summary : '旧版本运行记录；当前源码待验证';
  return v?.runtime || '外部服务未联调';
}
export function projectReadme(d, validation) {
  const c = compilation(d, validation), valid = c?.passed && c.sourceHash === sourceHash(d);
  return `# ${d.title}\n\n${d.summary}\n\n## 场景\n\n${d.scenario}\n\n## 运行前提\n\n${d.prerequisites.map(v => '- ' + v).join('\n')}\n\n在项目根目录执行命令。需要 JDK 17+ 和 Maven 3.6.3+。下列环境变量命令适用于 bash/zsh；PowerShell 使用 $env:NAME='值'。占位值需替换，可选参数按说明省略。模型与云服务可能产生费用，请核对供应商地域、权限与计费规则。\n\n\`\`\`bash\n${d.environment.map(e => `# ${e.description}\nexport ${e.name}=${shellQuote(e.example)}`).join('\n')}\n\`\`\`\n\n${d.stages.map((s, i) => `## 0${i + 1} ${s.title}\n\n${s.description}\n\n${s.focus.map(v => '- ' + v).join('\n')}\n\n源码：\n\n${s.files.map(p => `- [${p}](${p})`).join('\n')}\n\n\`\`\`bash\n${s.commands.join('\n\n')}\n\`\`\`\n\n预期：\n\n${s.expected.map(v => '- ' + v).join('\n')}\n\n排障：\n\n${s.troubleshooting.map(v => '- ' + v).join('\n')}`).join('\n\n')}\n\n## 验证记录\n\n${valid ? `Maven 编译通过；JDK ${c.javaVersion || '未记录'}，release ${c.release || 17}；日期 ${c.checkedAt || '未记录'}。` : '当前源码尚无编译通过记录。'}\n\n运行：${runtimeSummary(d, validation)}。编译和运行分别记录，编译成功不代表已连接外部服务。\n\n## 许可证与来源\n\n本项目自有代码与文档采用 [MIT](LICENSE)。第三方依赖保留各自许可证，参见 [第三方说明](THIRD_PARTY_NOTICES.md)。\n\n${d.sources.map(s => `- [${s.label}](${s.url})`).join('\n')}\n`;
}
export async function projectFiles(d, validation) {
  const files = new Map(d.files.map(f => [safePath(f.path), f.code]));
  files.set('README.md', projectReadme(d, validation));
  files.set('.gitignore', 'target/\n.env\n.env.*\n!.env.example\n*.log\n');
  files.set('SECURITY.md', await readFile(resolve(root, 'SECURITY.md'), 'utf8'));
  files.set('licenses/lucide-LICENSE', await readFile(resolve(root, 'licenses/lucide-LICENSE'), 'utf8'));
  files.set('LICENSE', await readFile(resolve(root, 'LICENSE'), 'utf8'));
  files.set('THIRD_PARTY_NOTICES.md', await readFile(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'));
  return files;
}
export async function writeFiles(dir, files) {
  for (const [path, code] of files) {
    const destination = resolve(dir, safePath(path));
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, code);
  }
}
