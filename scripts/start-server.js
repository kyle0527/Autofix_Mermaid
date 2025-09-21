#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve } from 'node:path';

const PORT = Number(process.env.PORT || 8000);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const PYTHON_CANDIDATES = [process.env.PYTHON, 'python3', 'python', 'py'].filter(Boolean);
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function resolveFilePath(decodedPath) {
  const absolutePath = resolve(PROJECT_ROOT, `.${decodedPath}`);
  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    return null;
  }

  let filePath = absolutePath;
  let stats;
  try {
    stats = statSync(filePath);
  } catch (_) {
    if (decodedPath === '/' || decodedPath === '') {
      filePath = join(PROJECT_ROOT, 'index.html');
      try {
        stats = statSync(filePath);
      } catch (err) {
        console.warn('index.html missing:', err);
        return null;
      }
    } else {
      return null;
    }
  }

  if (stats.isDirectory()) {
    const indexPath = join(filePath, 'index.html');
    try {
      statSync(indexPath);
      filePath = indexPath;
    } catch (_) {
      return null;
    }
  }

  return filePath;
}

function startNodeServer() {
  const server = createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://localhost');
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const filePath = resolveFilePath(decodedPath);
      if (!filePath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      const stream = createReadStream(filePath);
      stream.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Failed to read file: ${err?.message || err}`);
      });
      stream.pipe(res);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Unexpected error: ${error?.message || error}`);
    }
  });

  server.listen(PORT, () => {
    console.log(`Serving http://localhost:${PORT} using built-in Node server`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function tryPython(index) {
  if (index >= PYTHON_CANDIDATES.length) {
    console.warn('找不到可用的 Python 直譯器，改用 Node 內建靜態伺服器。');
    startNodeServer();
    return;
  }

  const command = PYTHON_CANDIDATES[index];
  const args = ['-m', 'http.server', String(PORT)];
  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
  });

  child.once('error', (error) => {
    console.warn(`啟動 ${command} 失敗：${error?.message || error}`);
    tryPython(index + 1);
  });

  child.once('spawn', () => {
    console.log(`Serving http://localhost:${PORT} using ${command}`);
    const cleanup = () => {
      try {
        child.kill('SIGINT');
      } catch (err) {
        if (err && err.code !== 'ESRCH') {
          console.warn('Failed to terminate server process:', err);
        }
      }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

if (PYTHON_CANDIDATES.length) {
  tryPython(0);
} else {
  startNodeServer();
}
