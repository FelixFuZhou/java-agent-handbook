import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8080);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const server = http.createServer(async (req,res) => {
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end('Method not allowed');return;}
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if (!path.startsWith(resolve(root)+sep)) {res.writeHead(403);res.end('Forbidden');return;}
    if (!(await stat(path)).isFile()) throw new Error('not-file');
    const data = await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':data.byteLength,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面不存在，请返回 /');}
});
server.on('error',error=>{console.error(`无法启动：${error.message}\n可设置 PORT=8081 npm start 使用另一个端口。`);process.exitCode=1;});
server.listen(port,host,()=>console.log(`Agent 工程手册已启动\nLocal: http://${host}:${port}\n按 Ctrl+C 停止。无需安装 npm 依赖。`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
