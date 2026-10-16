import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './lib/demo-project.mjs';

// 高置信度规则；只报告位置与类型，永不输出匹配值。不是完整的凭据审计工具。
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ['provider-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['aliyun-access-key', /\bLTAI[A-Za-z0-9]{16,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/],
  ['credential-url', /https?:\/\/[^\s/:"'<>]+:[^\s/@"'<>]{10,}@/]
];
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
let tracked = [], hasGit = true;
try { tracked = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean); } catch { hasGit = false; }
if (!hasGit) { console.log('Git metadata unavailable; run this check from a cloned repository for history coverage.'); process.exit(0); }
const issues = [];
function inspect(path, content, location) {
  if (content.includes('\0')) return;
  content.split('\n').forEach((line, index) => {
    for (const [type, pattern] of rules) if (pattern.test(line)) issues.push(`${location}:${path}:${index + 1} [${type}]`);
  });
}
for (const path of tracked) {
  if (/^(?:\.idea|\.vscode|\.cache|artifacts|dist\/demos)\//.test(path)) issues.push(`index:${path} [local/generated-file]`);
  if (/(?:^|\/)\.env(?:\..+)?$/.test(path) && !path.endsWith('.env.example')) issues.push(`index:${path} [environment-file]`);
  if (/\.(?:pem|key|p12|pfx|jks)$/i.test(path)) issues.push(`index:${path} [credential-file]`);
  try { inspect(path, await readFile(resolve(root, path), 'utf8'), 'working-tree'); } catch { /* 已暂存移除的文件无需工作区扫描。 */ }
}
// 遍历所有 refs 的唯一 Git blob；避免漏掉已删除文件或仅存在于旧提交中的凭据。
const objects = git(['rev-list', '--objects', '--all']).trim().split('\n').filter(Boolean);
const lines = objects.map(line => line.slice(0, line.indexOf(' ') < 0 ? line.length : line.indexOf(' ')));
if (lines.length) {
  const metadata = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { cwd: root, input: lines.join('\n') + '\n', encoding: 'utf8' }).trim().split('\n');
  for (let i = 0; i < metadata.length; i++) {
    const [hash, type, size] = metadata[i].split(' ');
    if (type !== 'blob') continue;
    if (Number(size) > 8 * 1024 * 1024) { issues.push(`history:${hash.slice(0, 12)} [blob-too-large-to-scan]`); continue; }
    const path = objects[i].slice(hash.length + 1) || '(historical blob)';
    inspect(path, git(['cat-file', 'blob', hash]), 'history/' + hash.slice(0, 12));
  }
}
if (issues.length) { console.error([...new Set(issues)].join('\n')); process.exitCode = 1; }
else console.log(`High-confidence secret check passed: ${tracked.length} tracked files, ${objects.length} historical objects. This is heuristic coverage, not a guarantee that no secrets exist.`);
