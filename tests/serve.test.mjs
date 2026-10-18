import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const script = resolve(import.meta.dirname, '../scripts/serve.mjs');
function launch(port) {
  const child = spawn(process.execPath, [script], {env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exit = once(child, 'exit');
  async function waitFor(pattern) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const match = output.match(pattern);
      if (match) return match;
      if (child.exitCode !== null) throw new Error(`Server exited early: ${output}`);
      await new Promise(resolveWait => setTimeout(resolveWait, 20));
    }
    throw new Error(`Server did not become ready: ${output}`);
  }
  return {child,exit,waitFor,output:()=>output};
}

test('starting twice reuses the game server without an EADDRINUSE crash', {timeout:15000}, async () => {
  const first = launch(0);
  let second;
  try {
    const ready = await first.waitFor(/Local: http:\/\/127\.0\.0\.1:(\d+)/);
    const port = Number(ready[1]);
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /The Chronicles of Data/);
    for (const scene of ['village', 'forest', 'night', 'battle', 'mystery', 'celebration', 'rest']) {
      const music = await fetch(`http://127.0.0.1:${port}/music/${scene}.mp3`);
      assert.equal(music.status, 200, `the uploaded ${scene} music is served with the game`);
      assert.equal(music.headers.get('content-type'), 'audio/mpeg', `${scene} has the correct MP3 content type`);
      assert.deepEqual(Buffer.from(await music.arrayBuffer()), await readFile(resolve(import.meta.dirname, `../dist/music/${scene}.mp3`)), `the original ${scene} MP3 is served without modification or truncation`);
    }
    second = launch(port);
    await second.waitFor(/The game is already running\. Open http:\/\/127\.0\.0\.1:/);
    assert.equal((await second.exit)[0], 0);
    assert.doesNotMatch(second.output(), /Unhandled|EADDRINUSE|throw er/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200, 'original server remains available');
  } finally {
    first.child.kill();
    second?.child.kill();
    await first.exit;
  }
});

test('a port occupied by another application falls back to an available port', {timeout:15000}, async () => {
  const occupied = http.createServer((req,res) => res.end('Another application'));
  occupied.listen(0,'127.0.0.1');
  await once(occupied,'listening');
  const port = occupied.address().port;
  const game = launch(port);
  try {
    const ready = await game.waitFor(/Local: http:\/\/127\.0\.0\.1:(\d+)/);
    const availablePort = Number(ready[1]);
    assert.notEqual(availablePort,port);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(),'Another application');
    assert.match(await (await fetch(`http://127.0.0.1:${availablePort}/`)).text(),/The Chronicles of Data/);
    assert.doesNotMatch(game.output(), /Unhandled|throw er/);
  } finally {
    game.child.kill();
    await game.exit;
    await new Promise(resolveClose => occupied.close(resolveClose));
  }
});
