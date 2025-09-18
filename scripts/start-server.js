#!/usr/bin/env node
// Minimal dev server wrapper used by npm start
const { spawn } = require('child_process');
const server = spawn(process.execPath, ['-m', 'http.server', '8000'], { stdio: 'inherit' });
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('exit', () => server.kill());
