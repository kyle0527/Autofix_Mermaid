#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startStaticServer, formatAttempts } from './lib/server-launcher.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_PORT = Number(process.env.PORT || 8000);

function openBrowser(url) {
  const platform = process.platform;
  let command = null;
  let args = [];

  if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  return new Promise((resolvePromise, rejectPromise) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' });
      child.on('error', rejectPromise);
      child.unref();
      resolvePromise();
    } catch (error) {
      rejectPromise(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

async function main() {
  try {
    const controller = await startStaticServer({
      port: DEFAULT_PORT,
      rootDir: PROJECT_ROOT,
      pythonCandidates: [],
      preferPython: false,
      maxAttempts: 10,
      logger: console,
    });

    const attemptsSummary = formatAttempts(controller.attempts);
    if (attemptsSummary) {
      console.warn(`Server startup fallback history: ${attemptsSummary}`);
    }

    console.log('Mermaid AutoFix desktop launcher ready.');
    console.log(`Serving ${controller.url}`);

    try {
      await openBrowser(controller.url);
      console.log('Opened default browser. If it did not open, please visit the URL above manually.');
    } catch (error) {
      console.warn(`Unable to open browser automatically: ${error?.message || error}`);
      console.warn('Please open the URL above manually in your browser.');
    }

    let shuttingDown = false;
    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log('Stopping desktop launcher...');
      try {
        await controller.close?.();
      } catch (error) {
        console.warn('Error while shutting down static server:', error);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => {
      if (!shuttingDown) {
        try {
          controller.close?.();
        } catch {}
      }
    });
  } catch (error) {
    console.error('Desktop launcher failed:', error?.message || error);
    if (error?.attempts?.length) {
      console.error('Attempts:', formatAttempts(error.attempts));
    }
    process.exit(1);
  }
}

await main();
