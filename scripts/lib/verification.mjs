import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { platform, arch } from 'node:os';
import { writeFile, mkdir } from 'node:fs/promises';
import { root } from './demo-project.mjs';

const execute = promisify(execFile);
export async function maven(args, cwd) {
  const settings = process.env.MAVEN_SETTINGS ? ['-s', resolve(process.env.MAVEN_SETTINGS)] : [];
  // .cmd 启动需要 Windows shell；目录参数显式加引号，命令仅接受维护者配置。
  const command = process.env.MAVEN_CMD || (process.platform === 'win32' ? 'mvn.cmd' : 'mvn');
  const options = { cwd, timeout: 480000, maxBuffer: 12 * 1024 * 1024, env: { ...process.env, DEMO_OTLP_ENDPOINT: '', DEMO_OTLP_AUTHORIZATION: '' } };
  if (process.platform === 'win32') {
    const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
    return execute(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [command, '-B', ...settings, '-Dstyle.color=never', ...args].map(quote).join(' ')], options);
  }
  return execute(command, ['-B', ...settings, '-Dstyle.color=never', ...args], options);
}
export async function environment() {
  const version = await maven(['--version'], root);
  const output = version.stdout + version.stderr;
  const javaVersion = /Java version:\s*([^,\s]+)/.exec(output)?.[1];
  if (!javaVersion || Number(javaVersion.split('.')[0]) < 17) throw new Error('维护检查需要 JDK 17+；请设置 JAVA_HOME 后重试。');
  let commit = '', sourceState = 'unknown';
  try {
    commit = (await execute('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
    sourceState = (await execute('git', ['status', '--porcelain'], { cwd: root })).stdout.trim() ? 'working-tree' : 'commit';
  } catch { /* 也支持从源码压缩包运行，不依赖 Git。 */ }
  return { javaVersion, release: 17, mavenVersion: /Apache Maven\s+(\S+)/.exec(output)?.[1] || 'unknown', os: `${platform()} ${arch()}`, commit, sourceState,
    ...(process.env.GITHUB_ACTIONS ? { runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` } : {}) };
}
export async function saveValidation(records) {
  await writeFile(resolve(root, 'dist/data/demo-validation.js'), '// 编译与运行独立记录；源码哈希用于识别过时结果。\nexport const demoValidation = ' + JSON.stringify(records, null, 2) + ';\n');
}
export async function saveReport(name, report) {
  const dir = resolve(root, 'artifacts/demo-checks'); await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, name), JSON.stringify(report, null, 2) + '\n');
}
