import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '../dist');
const startingPort = Number(process.env.PORT || 4173);
if (!Number.isInteger(startingPort) || startingPort < 0 || startingPort > 65535) {
  console.error('PORT must be a number between 0 and 65535.');
  process.exit(1);
}
const instanceId = createHash('sha256').update(process.platform === 'win32' ? root.toLowerCase() : root).digest('hex');
let port = startingPort;
let attempts = 0;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Chronicles-Instance', instanceId);
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end('Forbidden'); return; }
    const content = await readFile(file);
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'}).end(content);
  } catch { res.writeHead(404).end('Not found'); }
});

function isThisGameRunning(candidatePort) {
  return new Promise(resolveCheck => {
    const request = http.get({host:'127.0.0.1',port:candidatePort,path:'/',agent:false}, response => {
      const matches = response.headers['x-chronicles-instance'] === instanceId;
      response.resume();
      request.destroy();
      resolveCheck(matches);
    });
    request.setTimeout(1200, () => request.destroy());
    request.on('error', () => resolveCheck(false));
    request.on('close', () => resolveCheck(false));
  });
}

server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    if (await isThisGameRunning(port)) {
      console.log(`The game is already running. Open http://127.0.0.1:${port}`);
      return;
    }
    if (++attempts < 20 && port < 65535) {
      console.log(`Port ${port} is in use. Trying ${port + 1}...`);
      port += 1;
      server.listen(port, '127.0.0.1');
      return;
    }
    console.error('No available local port was found. Set PORT to another starting port and try again.');
  } else {
    console.error(`Could not start the local server: ${error.message}`);
  }
  process.exitCode = 1;
});
server.on('listening', () => console.log(`Local: http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
server.listen(port, '127.0.0.1');
