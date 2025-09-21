import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = process.env.PORT || 8000;

const mime = new Map([
  ['.html','text/html'], ['.js','text/javascript'], ['.mjs','text/javascript'], ['.css','text/css'],
  ['.json','application/json'], ['.wasm','application/wasm'], ['.svg','image/svg+xml'], ['.png','image/png'],
  ['.jpg','image/jpeg'], ['.jpeg','image/jpeg'], ['.ico','image/x-icon'], ['.txt','text/plain']
]);

const server = http.createServer((req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    const filePath = path.join(root, url);
    if (!filePath.startsWith(root)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const type = mime.get(ext) || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404); res.end('Not found');
    }
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.listen(port, () => console.log(`Dev server running at http://localhost:${port}/`));
