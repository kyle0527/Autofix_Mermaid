import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = process.env.PORT || 8000;

const mime = new Map([
  ['.html', 'text/html'],
  ['.js', 'application/javascript'],
  ['.mjs', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.ico', 'image/x-icon']
]);

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return mime.get(ext) || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    let filePath = path.join(root, url.pathname);
    // if path ends with /, serve index.html
    if (url.pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
    // restrict to project dir
    if (!filePath.startsWith(root)) return res.writeHead(403).end('Forbidden');
    const stat = await fs.stat(filePath).catch(()=>null);
    if (!stat || !stat.isFile()) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not found');
      return;
    }
    const body = await fs.readFile(filePath);
    res.writeHead(200, {'Content-Type': contentType(filePath)});
    res.end(body);
  } catch (e) {
    res.writeHead(500, {'Content-Type':'text/plain'});
    res.end('Server error: '+String(e));
  }
});

server.listen(port, ()=>{
  console.log(`Dev server running at http://localhost:${port}`);
});
