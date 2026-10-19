// Optional real-browser QA. Requires an already running local server and installed Edge.
// Uses Node's native WebSocket and a fresh profile; no browser packages are needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SPEECH_PREFERENCE_KEY } from '../dist/speech.js';
import { act, createGame, serializeGame, SPECIES } from '../dist/engine.js';

const url = process.env.CHRONICLES_TEST_URL || 'http://127.0.0.1:4173';
const artifactDir = resolve(import.meta.dirname, '../artifacts');
const runId = Date.now();
const downloadDir = resolve(artifactDir, `browser-downloads-${runId}`);
const profile = resolve(artifactDir, `browser-profile-${runId}`);
const musicTrackIds = ['village', 'forest', 'night', 'battle', 'mystery', 'celebration', 'rest'];
const musicTrackSizes = Object.fromEntries(await Promise.all(musicTrackIds.map(async id => [id, (await stat(resolve(import.meta.dirname, `../dist/music/${id}.mp3`))).size])));
const port = Number(process.env.CHRONICLES_DEBUG_PORT || 9223);
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
const musicPreferenceKey = 'chronicles-of-data.music.v1';
const audioMockSource = `(() => {
  // No hardware AudioContext is opened by browser QA. Native OfflineAudioContext
  // remains available for a separate, non-audible waveform render.
  const test = window.__audioTest = { contexts: [], events: [], decodes: [], fetches: [], encodedFiles: new WeakMap(), hidden: false };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const request = String(args[0]?.url || args[0]);
    const path = new URL(request, window.location?.href || 'http://127.0.0.1/').pathname;
    const file = path.split('/').at(-1);
    const track = path.includes('/music/') && file.endsWith('.mp3') ? file.slice(0, -4) : null;
    if (track) test.fetches.push({ url: request, track, file });
    const response = await originalFetch(...args);
    if (track) {
      const read = response.arrayBuffer.bind(response);
      response.arrayBuffer = async (...readArgs) => { const bytes = await read(...readArgs); test.encodedFiles.set(bytes, track); return bytes; };
    }
    return response;
  };
  let nextNode = 1;
  class Param {
    constructor(node, name, value = 1) { this.node = node; this.name = name; this.value = value; }
    record(method, value, time) { test.events.push({ context: this.node.context.id, node: this.node.id, name: this.name, method, value, time }); if (value !== undefined) this.value = value; return this; }
    cancelScheduledValues(time) { return this.record('cancel', undefined, time); }
    cancelAndHoldAtTime(time) { return this.record('hold', undefined, time); }
    setValueAtTime(value, time) { return this.record('set', value, time); }
    linearRampToValueAtTime(value, time) { return this.record('linear', value, time); }
    exponentialRampToValueAtTime(value, time) { return this.record('exponential', value, time); }
    setTargetAtTime(value, time) { return this.record('target', value, time); }
  }
  class AudioNode extends EventTarget {
    constructor(context, kind) { super(); this.context = context; this.kind = kind; this.id = nextNode++; this.connections = []; context.nodes.push(this); }
    connect(node) { this.connections.push(node.id); return node; }
    disconnect() { this.disconnected = true; this.connections = []; }
  }
  class Source extends AudioNode {
    constructor(context, kind = 'source') { super(context, kind); this.loop = false; this.playbackRate = new Param(this, 'playbackRate'); this.frequency = new Param(this, 'frequency', 440); }
    start(time = this.context.currentTime) { this.startAt = time; test.events.push({ context: this.context.id, node: this.id, method: 'start', time, loop: this.loop }); }
    finish() { if (this.ended) return; this.ended = true; clearTimeout(this.endTimer); this.onended?.(); this.dispatchEvent(new Event('ended')); }
    stop(time = this.context.currentTime) { this.stopAt = time; test.events.push({ context: this.context.id, node: this.id, method: 'stop', time }); clearTimeout(this.endTimer); this.endTimer = setTimeout(() => this.finish(), Math.max(0, (time - this.context.currentTime) * 1000)); }
  }
  class MockAudioContext extends EventTarget {
    constructor() { super(); this.id = test.contexts.length; this.nodes = []; this.state = 'suspended'; this.sampleRate = 22050; this.started = performance.now(); this.offset = 0; this.destination = new AudioNode(this, 'destination'); test.contexts.push(this); }
    get currentTime() { return (performance.now() - this.started) / 1000 + this.offset; }
    createGain() { const node = new AudioNode(this, 'gain'); node.gain = new Param(node, 'gain'); return node; }
    createBufferSource() { return new Source(this); }
    createOscillator() { return new Source(this, 'oscillator'); }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: index => data[index], copyToChannel: (source, channel, offset = 0) => data[channel].set(source, offset) };
    }
    async decodeAudioData(encoded) {
      const bytes = new Uint8Array(encoded);
      const isMp3 = bytes.length > 4 && ((bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) || (bytes[0] === 255 && (bytes[1] & 224) === 224));
      if (!isMp3) throw new DOMException('Expected MP3 bytes in the output-context mock.', 'EncodingError');
      const buffer = this.createBuffer(2, this.sampleRate * 4, this.sampleRate);
      buffer.decodedFromFile = true;
      buffer.decodedTrack = test.encodedFiles.get(encoded) || null;
      buffer.encodedByteLength = bytes.length;
      for (let channel = 0; channel < 2; channel++) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 25) * .01;
      }
      test.decodes.push({ context: this.id, track: buffer.decodedTrack, byteLength: bytes.length, mp3: true });
      return buffer;
    }
    async resume() { this.state = 'running'; test.events.push({ context: this.id, method: 'resume' }); this.dispatchEvent(new Event('statechange')); }
    async suspend() { this.state = 'suspended'; test.events.push({ context: this.id, method: 'suspend' }); this.dispatchEvent(new Event('statechange')); }
    async close() { this.state = 'closed'; this.nodes.filter(node => node.kind === 'source' || node.kind === 'oscillator').forEach(node => node.finish()); this.dispatchEvent(new Event('statechange')); }
  }
  test.advance = seconds => { for (const context of test.contexts) { context.offset += seconds; context.nodes.filter(node => node.stopAt !== undefined && node.stopAt <= context.currentTime).forEach(node => node.finish()); } };
  test.setHidden = value => { test.hidden = value; document.dispatchEvent(new Event('visibilitychange')); };
  test.snapshot = () => ({ contexts: test.contexts.map(context => ({ id: context.id, state: context.state, currentTime: context.currentTime,
    sources: context.nodes.filter(node => node.kind === 'source').map(node => ({ id: node.id, loop: node.loop, startAt: node.startAt, stopAt: node.stopAt, ended: !!node.ended, decodedFromFile: !!node.buffer?.decodedFromFile, decodedTrack: node.buffer?.decodedTrack, encodedByteLength: node.buffer?.encodedByteLength, live: node.startAt !== undefined && !node.ended && (node.stopAt === undefined || node.stopAt > context.currentTime) })),
    master: context.nodes.filter(node => node.kind === 'gain' && node.connections.includes(context.destination.id)).map(node => ({ id: node.id, value: node.gain.value })),
  })), events: test.events, decodes: test.decodes, fetches: test.fetches });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => test.hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => test.hidden ? 'hidden' : 'visible' });
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext });
  Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: MockAudioContext });
})()`;
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
const battleCardActions = new Set(['battle-move', 'guard', 'scan', 'potion', 'bond', 'flee', 'switch']);
async function showBattleCardCategory(selector) {
  const category = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.closest('[data-battle-group]')?.dataset.battleGroup`);
  if (category) await click(`[data-action="battle-category"][data-id="${category}"]`);
  return category;
}
async function action(name, extra = '') {
  const selector = `[data-action="${name}"]${extra}`;
  const category = battleCardActions.has(name) ? await showBattleCardCategory(selector) : null;
  await click(selector);
  if (category) await click('[data-action="battle-confirm"]');
}
const saved = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)}))`);
const waitHeading = text => eventually(() => evaluate(`document.querySelector('#modal-heading')?.textContent.includes(${JSON.stringify(text)})`), `Dialog did not open: ${text}`);

async function reloadGame() {
  const previousLoader = (await cdp('Page.getFrameTree')).frameTree.frame.loaderId;
  await cdp('Page.reload');
  await eventually(async () => {
    const currentLoader = (await cdp('Page.getFrameTree')).frameTree.frame.loaderId;
    return currentLoader !== previousLoader && await evaluate(`!!document.querySelector('#objective h3')`);
  }, 'Reloaded game did not finish initializing');
}

async function pressKey(key, code, windowsVirtualKeyCode, autoRepeat = false) {
  const text = key === 'Enter' ? '\r' : key.length === 1 ? key : undefined;
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, autoRepeat, ...(text === undefined ? {} : { text, unmodifiedText: text }) });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
}

const dialogue = () => evaluate(`(() => {
  const box = document.querySelector('.dialogue-box');
  if (!box) return null;
  const portrait = box.querySelector('svg[role="img"]');
  const bounds = portrait?.getBoundingClientRect();
  return {
    line: box.querySelector('#dialogue-line')?.textContent.trim(),
    speaker: box.querySelector('#dialogue-speaker')?.textContent.trim(),
    speakerId: box.dataset.speakerId,
    expression: box.dataset.expression,
    portrait: portrait?.outerHTML,
    portraitLabel: portrait?.getAttribute('aria-label'),
    portraitVisible: !!bounds && bounds.width > 0 && bounds.height > 0,
    nextEnabled: !!box.querySelector('[data-action="dialogue-next"]:not(:disabled)'),
    backEnabled: !!box.querySelector('[data-action="dialogue-back"]:not(:disabled)')
  };
})()`);

async function inferraDialogue(phase) {
  const segment = await dialogue();
  assert.equal(segment?.speakerId, 'inferra', `${phase} must begin with Professor Inferra`);
  assert.equal(segment.speaker, 'Professor Inferra', `${phase} must display Inferra's name`);
  assert.ok(segment.portrait && segment.portraitVisible && segment.portraitLabel?.includes('Professor Inferra'), `${phase} must show Inferra's accessible portrait`);
  assert.equal(await evaluate(`document.querySelectorAll('#dialogue-line').length`), 1, `${phase} must display one dialogue segment`);
  return segment;
}

async function noDialogueActions(names, message) {
  for (const name of names) {
    assert.equal(await evaluate(`!!document.querySelector('[data-action="${name}"]')`), false, message);
  }
}

async function heldDialogueKeys(segment, message) {
  for (const [key, code, virtualKey] of [['Enter', 'Enter', 13], [' ', 'Space', 32], ['e', 'KeyE', 69]]) {
    await pressKey(key, code, virtualKey, true);
    assert.deepEqual(await dialogue(), segment, message);
  }
}

async function finishDialogue() {
  const segments = [];
  for (let i = 0; i < 30; i++) {
    const segment = await dialogue();
    if (segment) {
      assert.ok(segment.line, 'The current dialogue segment must contain text');
      assert.ok(segment.speaker, 'Every segment must identify its active speaker');
      assert.ok(segment.portrait && segment.portraitVisible, 'Every segment must show a visible speaker portrait');
      segments.push(segment);
    }
    if (!await evaluate(`!!document.querySelector('[data-action="dialogue-next"]:not(:disabled)')`)) return segments;
    await action('dialogue-next');
  }
  throw new Error('Conversation did not finish after 30 segments');
}

async function close() {
  await finishDialogue();
  await click('#modal-root [data-action="close"]');
  await eventually(() => evaluate(`!document.querySelector('#modal-root .modal')`), 'Dialog did not close');
}

async function visit(id, expectedHeading) {
  await click('#help-button');
  await action('places');
  await action('walk-to', `[data-id="${id}"]`);
  if (expectedHeading) await waitHeading(expectedHeading);
  else if (id==='gate'||id==='exit') await eventually(async () => (await saved())?.map === (id === 'gate' ? 'forest' : 'village'), `Travel failed at ${id}`);
  else await eventually(()=>evaluate(`!!document.querySelector('#modal-root .modal')`),`Destination did not open: ${id}`);
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
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: audioMockSource });
  await cdp('Page.navigate', {url});
  await waitHeading('Every adventure');
  await evaluate(`document.querySelector('#observer-name').value='Rain Observer'`);
  await action('begin');
  assert.equal((await saved()).starter,null);
  assert.equal(await evaluate(`document.querySelector('#dex-button').disabled`),true);
  const first=await dialogue();
  await heldDialogueKeys(first,'Held keys must not skip the opening');
  await screenshot('act1-opening.png');
  await finishDialogue();
  await action('act1-intro-finish');
  await eventually(()=>evaluate(`!!document.querySelector('[data-action="dialogue-next"]')`),'Lyra did not open after the introduction');
  await finishDialogue();
  await action('act1-start');
  assert.equal((await saved()).act1.started,true);
  checks.push('Opening cinematic, subtitles, portraits, held keys, DataDex locked, Lyra assignment');

  await visit('shop','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="nell"]')`),'Nell not reached');
  await finishDialogue();
  for (const id of ['shop_tower','shop_receipt','shop_box']) await action('act1-field',`[data-id="${id}"]`);
  await action('act1-collect','[data-id="shop"]');
  await close();
  await visit('farm','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="mara"]')`),'Mara not reached');
  await finishDialogue();
  await action('act1-field','[data-id="farm_crate"]');
  await action('act1-collect','[data-id="farm"]');
  await close();
  const partial=await saved();
  await reloadGame();
  assert.deepEqual((await saved()).act1.records,partial.act1.records);
  await visit('river','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="bram"]')`),'Bram not reached');
  await finishDialogue();
  await action('act1-field','[data-id="river_reeds"]');
  await action('act1-collect','[data-id="river"]');
  await close();
  assert.deepEqual((await saved()).act1.records,['shop','farm','river']);
  checks.push('Walked to three evidence locations in alternate order, interacted with field objects, reloaded after two records');

  await visit('tower','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="orin"]')`),'Orin not reached');
  await finishDialogue();
  for (const id of ['farm','river','shop']) await action('act1-compare',`[data-id="${id}"]`);
  await screenshot('act1-comparison-desktop.png');
  await screenshot('act1-comparison-mobile.png',true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  await action('act1-compare-finish');
  await finishDialogue();
  await action('act1-receive-dex');
  assert.equal((await saved()).act1.dexReceived,true);
  assert.equal(await evaluate(`document.querySelector('#dex-button').disabled`),false);
  await close();
  checks.push('Compared all three historical mismatches, mobile layout, discovery conclusion and DataDex reward');

  await visit('lab','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="lyra"]')`),'Starter lab not reached');
  await finishDialogue();
  for (const id of ['creature_terradeer','creature_statifox','creature_algobear']) {
    await action('act1-demo-open',`[data-id="${id}"]`);
    await finishDialogue();
    await action('act1-demo-finish',`[data-id="${id}"]`);
  }
  await action('act1-starters');
  await finishDialogue();
  await action('choose','[data-id="creature_terradeer"]');
  assert.equal((await saved()).starter,null,'Preview must not choose a starter');
  await action('act1-confirm-starter');
  assert.equal((await saved()).party.length,1);
  checks.push('All starter demonstrations, free preview and confirmed permanent companion');

  await visit('kai','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="kai"]')`),'Kai not reached');
  await finishDialogue();
  await action('start-battle');
  assert.equal((await saved()).party[1].speciesId,'creature_cloudfin');
  await action('battle-move','[data-id="observe_strike"]');
  await action('guard');
  await action('scan');
  await action('switch','[data-index="1"]');
  await screenshot('act1-training-mobile.png',true);
  await reloadGame();
  assert.equal((await saved()).party[1].speciesId,'creature_cloudfin');
  for(let turn=0;(await saved()).battle&&turn<20;turn++) await action('battle-move','[data-id="observe_strike"]');
  assert.equal((await saved()).flags.rivalDefeated,true);
  assert.equal((await saved()).party.length,1,'Loan must be returned');
  assert.equal((await saved()).party[0].xp,30);
  await close();
  checks.push('Attack, Guard, free Scan, borrowed switch, midbattle reload, victory, loan return and permanent starter EXP');

  await visit('rowan','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="rowan"]')`),'Council not reached');
  await finishDialogue();
  await action('act1-council-finish');
  assert.equal((await saved()).act1.councilComplete,true);
  await screenshot('act1-complete.png');
  await close();
  await visit('gate');
  assert.equal((await saved()).map,'forest');
  await visit('exit');
  assert.equal((await saved()).map,'village');
  assert.equal((await saved()).act1.councilComplete,true);
  await visit('wild','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="narrator"]')`),'Wild creature not reached');
  await finishDialogue();
  await action('start-battle');
  await action('scan');
  await action('battle-move','[data-id="observe_strike"]');
  for(let attempt=0;(await saved()).battle&&attempt<5;attempt++) await action('bond');
  assert.equal((await saved()).flags.recruitedVoltkit,true);
  await close();
  checks.push('Council conclusion, Act I completion, permanent northern gate, forest return, village wild bonding');

  for(const [target,sideId,flag] of [['scarf','scarf_find','scarfFound'],['child','scarf_return','scarfReturned'],['observer','old_journal','oldJournal'],['supply','supply_chest','supplyChest'],['garden','garden_clear','gardenCleared']]) {
    await visit(target,'');
    await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box')`),`${target} activity not reached`);
    await finishDialogue();
    await action('act1-side-action',`[data-id="${sideId}"]`);
    assert.equal((await saved()).act1.side[flag],true);
    await close();
  }
  await visit('shop','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="nell"]')`),'Shop not reached');
  await finishDialogue();
  const coins=(await saved()).coins;
  await action('act1-buy','[data-id="potion"]');
  assert.equal((await saved()).coins,coins-12);
  await close();
  checks.push('All five optional activities, journal mastery and coin-based shop purchase');
  await click('#help-button');
  await evaluate(`(() => {for(const [key,value] of Object.entries({textSize:'large',movement:'ijkl',learning:'explorer',dialogueSpeed:'slow',combatDifficulty:'relaxed'})){const select=document.querySelector('[data-preference="'+key+'"]');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  assert.equal((await saved()).act1.combatDifficulty,'relaxed');
  assert.equal(await evaluate(`document.body.classList.contains('large-text')`),true);
  await close();
  await visit('home','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box')`),'Home not reached');
  const partialLine=await evaluate(`document.querySelector('#dialogue-line').textContent`);
  await action('dialogue-reveal');
  assert.ok((await evaluate(`document.querySelector('#dialogue-line').textContent`)).length>partialLine.length);
  await action('dialogue-next');
  await pressKey('Escape','Escape',27);
  await sleep(150);
  assert.equal(await evaluate(`!!document.querySelector('.dialogue-box')`),false);
  await reloadGame();
  assert.equal(await evaluate(`document.body.classList.contains('large-text')`),true);
  assert.equal((await saved()).act1.combatDifficulty,'relaxed');
  await click('#help-button');
  await evaluate(`(() => {for(const [key,value] of Object.entries({textSize:'standard',movement:'wasd',learning:'adventure',dialogueSpeed:'instant',combatDifficulty:'standard'})){const select=document.querySelector('[data-preference="'+key+'"]');select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await action('act1-replay-intro');
  assert.equal(await evaluate(`!!document.querySelector('[data-action="close"]')`),true,'Opening can be skipped after a completed viewing');
  await pressKey('Escape','Escape',27);
  checks.push('Large text, separate learning/combat choices, remapped movement preference, gradual dialogue reveal and interruption, persistent preferences, replay and skip');

  // Continue through the retained forest activity with a fresh Act I save.
  await visit('gate');
  await visit('inferra','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="inferra"]')`),'Inferra not reached');
  await finishDialogue();
  await action('start-investigation');
  await close();
  for(const time of ['day','night']) {
    if((await saved()).time!==time) {
      await visit('camp','');
      await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box')`),'Camp not reached');
      await finishDialogue();await action('change-time');
    }
    for(const id of ['meadow','riverbank','canopy']) {
      await visit(id,'');
      await eventually(()=>evaluate(`!!document.querySelector('[data-action="observe"]')`),'Habitat not reached');
      await action('observe');await close();
    }
  }
  await visit('inferra','');
  await eventually(()=>evaluate(`!!document.querySelector('.dialogue-box[data-speaker-id="inferra"]')`),'Inferra review not reached');
  await finishDialogue();await action('investigation');
  await action('finding','[data-answer="biased"]');
  await close();
  await visit('exit');
  await visit('lab','');
  await eventually(()=>evaluate(`!!document.querySelector('[data-action="dialogue-next"]')`),'Lyra report not reached');
  await finishDialogue();await action('report-findings');await close();
  assert.equal((await saved()).flags.reportedToLyra,true);
  checks.push('Retained forest continuation: six observations, camp day/night, accepted finding and report to Lyra');
  await reloadGame();
  assert.equal((await saved()).act1.councilComplete,true);
  assert.equal((await saved()).flags.recruitedVoltkit,true);
  await screenshot('act1-village-mobile.png',true);
  await screenshot('act1-village-desktop.png');
  assert.deepEqual(errors,[],'Browser must have no runtime errors');
  await writeFile(resolve(artifactDir,'act1-browser-smoke.json'),JSON.stringify({status:'passed',url,checks,errors},null,2));
  console.log(JSON.stringify({status:'passed',checks,errors},null,2));
} catch(error) {
  errors.push(error.stack||error.message);
  try {if(sessionId) await screenshot('act1-failure.png');} catch {}
  await writeFile(resolve(artifactDir,'act1-browser-smoke.json'),JSON.stringify({status:'failed',url,checks,errors},null,2));
  console.error(error.stack||error.message);
  process.exitCode=1;
} finally {
  try {if(ws?.readyState===WebSocket.OPEN) await cdp('Browser.close',{},null);} catch {}
  ws?.close();
  if(browser&&browser.exitCode===null) browser.kill();
}
