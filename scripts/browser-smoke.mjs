// Optional real-browser QA. Requires an already running local server and installed Edge.
// Uses Node's native WebSocket and a fresh profile; no browser packages are needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.CHRONICLES_TEST_URL || 'http://127.0.0.1:4173';
const artifactDir = resolve(import.meta.dirname, '../artifacts');
const runId = Date.now();
const downloadDir = resolve(artifactDir, `browser-downloads-${runId}`);
const profile = resolve(artifactDir, `browser-profile-${runId}`);
const port = Number(process.env.CHRONICLES_DEBUG_PORT || 9222);
const saveKey = 'chronicles-of-data:save:v1';
const candidates = [process.env.CHRONICLES_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
let executable;
for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch {} }
assert.ok(executable, 'Set CHRONICLES_BROWSER to an installed Edge/Chromium executable.');
await mkdir(downloadDir, { recursive: true });
await mkdir(profile, { recursive: true });
const sleep = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const errors = [];
const checks = [];
let browser, ws, sessionId;
const pending = new Map();
let nextId = 1;

async function eventually(callback, message, timeout = 15000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await callback(); if (value) return value; } catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`${message}${lastError ? ': ' + lastError.message : ''}`);
}

function cdp(method, params = {}, targetSession = sessionId) {
  return new Promise((resolveCall, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolveCall, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
  });
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function click(selector) {
  await eventually(() => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || e.disabled) return false; e.click(); return true; })()`), `Missing enabled UI control ${selector}`);
  await sleep(75);
}
const action = (name, extra = '') => click(`[data-action="${name}"]${extra}`);
const saved = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)}))`);
const waitHeading = text => eventually(() => evaluate(`document.querySelector('#modal-heading')?.textContent.includes(${JSON.stringify(text)})`), `Dialog did not open: ${text}`);

async function close() {
  await click('#modal-root [data-action="close"]');
  await eventually(() => evaluate(`!document.querySelector('#modal-root .modal')`), 'Dialog did not close');
}

async function visit(id, expectedHeading) {
  await click('#help-button');
  await action('places');
  await action('walk-to', `[data-id="${id}"]`);
  if (expectedHeading) await waitHeading(expectedHeading);
  else await eventually(async () => (await saved())?.map === (id === 'gate' ? 'forest' : 'village'), `Travel failed at ${id}`);
}

async function screenshot(name, mobile = false) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: mobile ? 390 : 1440, height: mobile ? 844 : 1050, deviceScaleFactor: 1, mobile });
  await sleep(250);
  const metrics = await cdp('Page.getLayoutMetrics');
  const bounds = metrics.cssContentSize || metrics.contentSize;
  const picture = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: mobile ? 390 : 1440, height: Math.ceil(bounds.height), scale: 1 } });
  await writeFile(resolve(artifactDir, name), Buffer.from(picture.data, 'base64'));
  console.log(`Screenshot: artifacts/${name}`);
}

try {
  browser = spawn(executable, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  browser.on('error', error => errors.push(`Browser launch: ${error.message}`));
  const info = await eventually(async () => { const response = await fetch(`http://127.0.0.1:${port}/json/version`); return response.ok && response.json(); }, 'Browser debugging port unavailable');
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { ws.addEventListener('open', resolveOpen, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id); if (!call) return;
      clearTimeout(call.timer); pending.delete(message.id);
      if (message.error) call.reject(new Error(message.error.message)); else call.resolveCall(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.description || arg.value || '').join(' '));
  });
  const target = await cdp('Target.createTarget', { url: 'about:blank' }, null);
  const attached = await cdp('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null);
  sessionId = attached.sessionId;
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }, null);
  await cdp('Page.setInterceptFileChooserDialog', { enabled: true });
  await cdp('Page.navigate', { url });
  await waitHeading('Every adventure');
  await evaluate(`document.querySelector('#observer-name').value = 'Smoke Observer'`);
  await action('begin');
  await action('choose', '[data-id="creature_statifox"]');
  assert.equal((await saved()).starter, 'creature_statifox');
  checks.push('App startup, naming, starter choice, autosave');
  await screenshot('prototype.png');
  await screenshot('mobile.png', true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'Mobile page must fit horizontally');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  const beforeKeyboard = await saved();
  await sleep(100);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'd', code: 'KeyD', windowsVirtualKeyCode: 68 });
  assert.equal((await saved()).player.x, beforeKeyboard.player.x + 1, 'D must move right rather than opening DataDex');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 });
  await waitHeading('The DataDex');
  assert.equal(await evaluate(`!!document.activeElement?.closest('#modal-root')`), true, 'Dialog must receive keyboard focus');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await eventually(() => evaluate(`!document.querySelector('#modal-root .modal')`), 'Escape must close DataDex');
  checks.push('Responsive layout, WASD D movement, DataDex X shortcut, modal keyboard focus and Escape');
  console.log('Initial desktop and mobile screenshots ready. Starting full Stage 1 walkthrough.');

  await visit('lab', 'Listen to the world');
  await close();
  await visit('gate', 'Village gate');
  assert.equal((await saved()).map, 'village');
  await close();
  await visit('kai', 'A friendly rivalry');
  await action('start-battle', '[data-kind="rival"]');
  await action('guard');
  const beforeScan = await saved();
  await action('scan');
  const scanned = await saved();
  assert.equal(scanned.battle.turn, beforeScan.battle.turn);
  assert.equal(scanned.party[0].hp, beforeScan.party[0].hp);
  await action('potion');
  for (let i = 0; i < 12 && (await saved()).battle; i++) {
    const choice = await evaluate(`document.querySelector('[data-action="battle-move"][data-id="pattern_pulse"]:not(:disabled)') ? 'pattern_pulse' : 'observe_strike'`);
    await action('battle-move', `[data-id="${choice}"]`);
  }
  assert.equal((await saved()).flags.rivalDefeated, true);
  await close();
  checks.push('Path walking, lab dialogue, locked gate, Kai victory, free scan, guard, potion');

  await visit('tower', 'The rain');
  await close();
  await visit('gate');
  await visit('inferra', 'nocturnal');
  await action('start-investigation');
  await action('hint');
  await close();
  for (const time of ['day', 'night']) {
    if ((await saved()).time !== time) { await visit('camp', 'Wait for'); await action('change-time'); }
    for (const [id, title] of [['meadow', 'Sunlit Meadow'], ['riverbank', 'Riverbank'], ['canopy', 'High Canopy']]) {
      await visit(id, title);
      await action('observe');
      await close();
    }
  }
  assert.equal((await saved()).quests.nocturnal.observations.length, 6);
  await visit('inferra', 'The Nocturnal Mystery');
  await action('finding', '[data-answer="nocturnal"]');
  assert.equal((await saved()).quests.nocturnal.status, 'ready');
  await action('finding', '[data-answer="biased"]');
  assert.equal((await saved()).flags.compass, true);
  await action('mastery');
  await action('master', '[data-answer="representative"]');
  assert.equal((await saved()).dex.concepts.concept_sampling_bias, 'mastered');
  await close();
  checks.push('All six habitat/time observations, hint, revised conclusion, Sampling Compass, optional mastery');

  await visit('voltkit', 'A spark in');
  await action('start-battle', '[data-kind="wild"]');
  await action('scan');
  await action('battle-move', '[data-id="observe_strike"]');
  await action('battle-move', '[data-id="observe_strike"]');
  const midbattle = await saved();
  await cdp('Page.reload');
  await waitHeading('Wild Voltkit encounter');
  assert.deepEqual(await saved(), midbattle, 'Reload must preserve the unfinished encounter');
  await action('save-menu');
  await action('save');
  await action('load');
  await waitHeading('Wild Voltkit encounter');
  for (let i = 0; i < 5 && (await saved()).battle; i++) await action('bond');
  assert.equal((await saved()).flags.recruitedVoltkit, true);
  assert.equal((await saved()).party.length, 2);
  await close();
  checks.push('Voltkit scan and weakening, midbattle reload and manual load, successful recruitment');

  await visit('exit');
  await visit('sanctuary', 'catch your breath');
  await action('heal');
  await action('restock');
  const healed = await saved();
  assert.ok(healed.party.every(member => member.hp === member.maxHp && member.focus === 8));
  assert.equal(healed.inventory.bondCrystals, 5);
  assert.equal(healed.inventory.potions, 3);
  await close();
  await click('#dex-button');
  await action('dex-tab', '[data-tab="research"]');
  assert.equal(await evaluate(`document.querySelectorAll('#modal-root .settings-row').length`), 6);
  await close();
  await click('#save-button');
  await action('save');
  const completed = await saved();
  await action('export');
  const exportPath = resolve(downloadDir, 'chronicles-of-data-save.json');
  await eventually(async () => { try { return JSON.parse(await readFile(exportPath, 'utf8')); } catch { return false; } }, 'Save export was not downloaded');
  assert.deepEqual(JSON.parse(await readFile(exportPath, 'utf8')), completed);
  await action('reset');
  await action('reset-confirm');
  assert.equal((await saved()).starter, null);
  await close();
  await click('#save-button');
  await action('import');
  const dom = await cdp('DOM.getDocument');
  const input = await cdp('DOM.querySelector', { nodeId: dom.root.nodeId, selector: '#import-file' });
  await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [exportPath] });
  await eventually(async () => (await saved())?.flags.recruitedVoltkit, 'Import did not restore progress');
  assert.deepEqual(await saved(), completed);
  await action('load');
  await close();
  await cdp('Page.reload');
  await eventually(() => evaluate(`document.querySelector('#objective')?.textContent.includes('Stage 1 adventure complete')`), 'Completed progress did not resume');
  assert.deepEqual(await saved(), completed);
  checks.push('Sanctuary healing/restocking, DataDex field notes, export/new journey/import, final reload');
  await screenshot('completed.png');
  assert.deepEqual(errors, [], 'Browser runtime must have no errors');
  await writeFile(resolve(artifactDir, 'browser-smoke.json'), JSON.stringify({ status: 'passed', url, checks, errors, screenshots: ['prototype.png', 'mobile.png', 'completed.png'] }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, errors }, null, 2));
} catch (error) {
  errors.push(error.stack || error.message);
  try { if (sessionId) await screenshot('failure.png'); } catch {}
  await writeFile(resolve(artifactDir, 'browser-smoke.json'), JSON.stringify({ status: 'failed', url, checks, errors }, null, 2));
  console.error(error.stack || error.message);
  process.exitCode = 1;
} finally {
  try { if (ws?.readyState === WebSocket.OPEN) await cdp('Browser.close', {}, null); } catch {}
  ws?.close();
  if (browser && browser.exitCode === null) browser.kill();
}
