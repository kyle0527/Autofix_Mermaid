import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const DEFAULT_MIME_TYPES = {
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

function createFileResolver(rootDir) {
  const projectRoot = resolve(rootDir);
  return function resolveFilePath(decodedPath) {
    const absolutePath = resolve(projectRoot, `.${decodedPath}`);
    if (!absolutePath.startsWith(projectRoot)) {
      return null;
    }

    let filePath = absolutePath;
    let stats;
    try {
      stats = statSync(filePath);
    } catch (error) {
      if (decodedPath === '/' || decodedPath === '') {
        filePath = join(projectRoot, 'index.html');
        try {
          stats = statSync(filePath);
        } catch (err) {
          throw Object.assign(new Error(`index.html missing: ${err?.message || err}`), { code: 'ENOENT' });
        }
      } else {
        throw error;
      }
    }

    if (stats.isDirectory()) {
      const indexPath = join(filePath, 'index.html');
      try {
        statSync(indexPath);
        filePath = indexPath;
      } catch (error) {
        throw Object.assign(new Error(`Directory has no index.html: ${decodedPath}`), { code: 'ENOENT' });
      }
    }

    return filePath;
  };
}

function createNodeStaticServer({ port, rootDir, mimeTypes = DEFAULT_MIME_TYPES }) {
  const resolveFilePath = createFileResolver(rootDir);

  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const decodedPath = decodeURIComponent(requestUrl.pathname);
        const filePath = resolveFilePath(decodedPath);
        const ext = extname(filePath).toLowerCase();
        const mime = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        const stream = createReadStream(filePath);
        stream.on('error', (err) => {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Failed to read file: ${err?.message || err}`);
        });
        stream.pipe(res);
      } catch (error) {
        const status = error?.code === 'ENOENT' ? 404 : 500;
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(error?.message || 'Unexpected error');
      }
    });

    const handleError = (error) => {
      server.close(() => rejectPromise(error));
    };

    server.once('error', handleError);
    server.listen(port, () => {
      server.off('error', handleError);
      resolvePromise({
        kind: 'node',
        url: `http://localhost:${port}`,
        port,
        server,
        async close() {
          await new Promise((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          });
        },
      });
    });
  });
}

function trySpawnPython(command, { port, rootDir }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, ['-m', 'http.server', String(port)], {
      stdio: 'inherit',
      cwd: rootDir,
    });

    let settled = false;

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      rejectPromise(Object.assign(error instanceof Error ? error : new Error(String(error)), { command }));
    });

    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      const error = new Error(`Python server exited prematurely (code=${code}, signal=${signal || 'none'})`);
      rejectPromise(Object.assign(error, { command }));
    });

    child.once('spawn', () => {
      if (settled) return;
      settled = true;
      resolvePromise({
        kind: 'python',
        command,
        port,
        url: `http://localhost:${port}`,
        child,
        async close() {
          await new Promise((resolveClose) => {
            const timeout = setTimeout(() => {
              resolveClose();
            }, 1500);
            child.once('exit', () => {
              clearTimeout(timeout);
              resolveClose();
            });
            try {
              child.kill('SIGINT');
            } catch (error) {
              resolveClose();
            }
          });
        },
      });
    });
  });
}

async function tryPythonServers({ port, rootDir, pythonCandidates = [], logger }) {
  let lastError = null;
  for (const command of pythonCandidates) {
    try {
      const result = await trySpawnPython(command, { port, rootDir });
      if (logger) {
        logger.log?.(`Serving http://localhost:${port} using ${command}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      logger?.warn?.(`Failed to launch ${command}: ${error?.message || error}`);
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error('No Python interpreter available for static server');
}

function uniquePorts({ port, ports = [], maxAttempts = 5 }) {
  const base = Number.isFinite(port) ? Number(port) : 8000;
  const result = [];
  const seen = new Set();

  const push = (value) => {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  };

  if (ports && Array.isArray(ports)) {
    for (const candidate of ports) push(candidate);
  }
  push(base);

  for (let i = 1; result.length < maxAttempts; i += 1) {
    push(base + i);
  }

  return result;
}

export async function startStaticServer({
  port = 8000,
  ports = [],
  rootDir,
  pythonCandidates = [],
  preferPython = true,
  maxAttempts = 5,
  logger = console,
} = {}) {
  if (!rootDir) {
    throw new Error('startStaticServer requires a rootDir');
  }

  const candidates = uniquePorts({ port, ports, maxAttempts });
  const failures = [];

  for (const candidatePort of candidates) {
    if (preferPython && pythonCandidates.length) {
      try {
        const pythonServer = await tryPythonServers({
          port: candidatePort,
          rootDir,
          pythonCandidates,
          logger,
        });
        return {
          ...pythonServer,
          attempts: failures.slice(),
        };
      } catch (error) {
        failures.push({ port: candidatePort, kind: 'python', error: error?.message || String(error) });
      }
    }

    try {
      const nodeServer = await createNodeStaticServer({ port: candidatePort, rootDir });
      logger?.log?.(`Serving ${nodeServer.url} using built-in Node server`);
      return {
        ...nodeServer,
        attempts: failures.slice(),
      };
    } catch (error) {
      failures.push({ port: candidatePort, kind: 'node', error: error?.message || String(error) });
      if (error?.code === 'EADDRINUSE') {
        logger?.warn?.(`Port ${candidatePort} in use, trying next port...`);
      } else {
        logger?.warn?.(`Node static server failed on port ${candidatePort}: ${error?.message || error}`);
      }
    }
  }

  const summary = failures.map((item) => `${item.kind}@${item.port}: ${item.error}`).join('; ');
  const error = new Error(`Failed to start static server after ${failures.length} attempts. ${summary}`);
  error.attempts = failures;
  throw error;
}

export function formatAttempts(attempts = []) {
  if (!Array.isArray(attempts) || !attempts.length) return '';
  return attempts.map((item) => `${item.kind}@${item.port}: ${item.error}`).join('; ');
}

