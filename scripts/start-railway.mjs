import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(repositoryRoot, 'dist', 'elevate-mk-crm', 'browser');
const port = process.env.PORT || '8080';
const serveEntryPoint = path.join(repositoryRoot, 'node_modules', 'serve', 'build', 'main.js');
const server = spawn(process.execPath, [serveEntryPoint, '-s', staticRoot, '-l', `tcp://0.0.0.0:${port}`], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

server.on('error', (error) => {
  console.error(`Unable to start the CRM static server: ${error.message}`);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
