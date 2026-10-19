// Optional real-browser QA. Requires an already running local server and installed Edge.
// Uses Node's native WebSocket and a fresh profile; no browser packages are needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SPEECH_PREFERENCE_KEY } from '../dist/speech.js';
import { act, serializeGame, SPECIES } from '../dist/engine.js';
import { createLegacyGame as createGame } from '../tests/fixtures.mjs';

const url = process.env.CHRONICLES_TEST_URL || 'http://127.0.0.1:4173';
const artifactDir = resolve(import.meta.dirname, '../artifacts');
const runId = Date.now();
const downloadDir = resolve(artifactDir, `browser-downloads-${runId}`);
const profile = resolve(artifactDir, `browser-profile-${runId}`);
const musicTrackIds = ['village', 'forest', 'night', 'battle', 'mystery', 'celebration', 'rest'];
const musicTrackSizes = Object.fromEntries(await Promise.all(musicTrackIds.map(async id => [id, (await stat(resolve(import.meta.dirname, `../dist/music/${id}.mp3`))).size])));
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

async function checkBattleLayout(mobile = false, viewportWidth = mobile ? 390 : 1440) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: mobile ? 844 : 1050, deviceScaleFactor: 1, mobile });
  await sleep(150);
  const layout = await evaluate(`(() => {
    const log = document.querySelector('.battle-log');
    const timeline = document.querySelector('.battle-timeline');
    const stage = document.querySelector('.battle-stage');
    const controls = document.querySelector('.battle-body');
    if (!log || !timeline || !stage || !controls) return null;
    const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, center: (r.left + r.right) / 2 }; };
    const logBounds = rect(log);
    const events = [...log.querySelectorAll('.battle-event')].map(element => ({
      ...rect(element), side: element.dataset.side, type: element.dataset.type,
      actor: element.querySelector('.battle-event-actor')?.textContent.trim(),
      target: element.querySelector('.battle-event-target')?.textContent.trim(),
      action: element.querySelector('.battle-event-action')?.textContent.trim(),
      effect: element.querySelector('.battle-event-effect')?.textContent.trim(),
      text: element.textContent.trim(), overflow: element.scrollWidth > element.clientWidth + 1,
      escapedText: [...element.querySelectorAll('.battle-event-actor, .battle-event-target, .battle-event-action, .battle-event-effect')].some(text => {
        const bounds = rect(text);
        return bounds.left < logBounds.left - 1 || bounds.right > logBounds.right + 1;
      }),
    }));
    const combatants = ['player', 'enemy'].map(side => {
      const element = stage.querySelector('.battle-combatant[data-side="' + side + '"]');
      const stat = element?.querySelector('.battle-stat');
      const portrait = element?.querySelector('canvas');
      return element && { ...rect(element), side, label: element.querySelector('.battle-side-label')?.textContent.trim(), stat: stat && rect(stat), portrait: portrait && rect(portrait) };
    });
    const turns = [...log.querySelectorAll('.battle-turn')].map(group => ({
      turn: Number(group.dataset.turn), title: group.querySelector('h4')?.textContent.trim(),
      sides: [...group.querySelectorAll('.battle-event:not([data-type="intro"]):not([data-type="legacy"])')].map(event => event.dataset.side),
    }));
    const portraits = [...stage.querySelectorAll('canvas')].map(rect);
    document.querySelector('.battle-log').focus({ preventScroll: true });
    return { stage: rect(stage), timeline: rect(timeline), controls: rect(controls), log: logBounds,
      role: log.getAttribute('role'), tabindex: log.getAttribute('tabindex'), focused: document.activeElement === log,
      atLatest: log.scrollHeight - log.scrollTop - log.clientHeight <= 2,
      pageFits: document.documentElement.scrollWidth <= innerWidth, events, turns, combatants, portraits };
  })()`);
  const mode = `${mobile ? 'Mobile' : 'Desktop'} (${viewportWidth}px)`;
  assert.ok(layout, `${mode} battle must have a stage, timeline and controls`);
  assert.equal(layout.role, 'log', 'Encounter history must expose its log role');
  assert.equal(layout.tabindex, '0', 'Encounter history must support keyboard scrolling');
  assert.equal(layout.focused, true, 'Encounter history must accept keyboard focus');
  assert.equal(layout.atLatest, true, `${mode} history following the newest event must stay at the bottom after reflow`);
  assert.equal(layout.pageFits, true, `${mode} battle must fit horizontally`);
  assert.ok(layout.timeline.top >= layout.stage.bottom - 1, `${mode} timeline must sit below the characters`);
  assert.ok(layout.controls.top >= layout.timeline.bottom - 1, `${mode} controls must sit below the timeline`);
  for (const portrait of layout.portraits) {
    assert.ok(portrait.bottom <= layout.timeline.top + 1, `${mode} messages must not overlap a Databeast portrait`);
  }
  assert.ok(layout.combatants.every(combatant => combatant?.label), 'Both Databeast sides must have visible labels');
  assert.ok(layout.combatants[0].center < layout.combatants[1].center, 'The player must stay on the left and enemy on the right');
  const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  for (const combatant of layout.combatants) {
    assert.ok(combatant.stat && combatant.portrait, 'Every battle side must show its Databeast portrait and stats');
    assert.equal(overlaps(combatant.stat, combatant.portrait), false, `${mode} ${combatant.side} stats must not overlap its Databeast portrait`);
  }
  assert.equal(overlaps(layout.combatants[0].stat, layout.combatants[1].stat), false, `${mode} player and enemy stats must not overlap`);
  for (const event of layout.events) {
    assert.equal(event.overflow || event.escapedText, false, `${mode} message text must fit inside the history: ${event.text}`);
    assert.ok(event.left >= layout.log.left - 1 && event.right <= layout.log.right + 1, `${mode} messages must fit the history width`);
    if (event.side === 'player') assert.ok(event.center < layout.log.center - 4, `${mode} player events must align to the player's left side`);
    else if (event.side === 'enemy') assert.ok(event.center > layout.log.center + 4, `${mode} enemy events must align to the enemy's right side`);
    else assert.ok(Math.abs(event.center - layout.log.center) < 12, `${mode} neutral messages must remain centered`);
    if (['damage', 'heal', 'status', 'switch', 'scan'].includes(event.type) && event.side !== 'system') {
      assert.ok(event.actor && event.target && event.action && event.effect, `Battle actions must identify actor, target, action and outcome: ${event.text}`);
    }
  }
  assert.ok(layout.turns.every(turn => Number.isInteger(turn.turn) && turn.title), 'History must label every turn group');
  assert.deepEqual(layout.turns.map(turn => turn.turn), layout.turns.map(turn => turn.turn).sort((a, b) => a - b), 'Battle turns must appear in chronological order');
  for (const turn of layout.turns) {
    const playerIndex = turn.sides.indexOf('player');
    const enemyIndex = turn.sides.indexOf('enemy');
    if (playerIndex !== -1 && enemyIndex !== -1) assert.ok(playerIndex < enemyIndex, `Turn ${turn.turn} must show the player action before the enemy reply`);
  }
  return layout;
}

async function checkBattleRecap(outcome, terminalTurn) {
  await checkInitialRewardFocus();
  const recap = await evaluate(`(() => {
    const timeline = document.querySelector('.battle-timeline');
    const log = timeline?.querySelector('.battle-log');
    if (!timeline || !log) return null;
    return {
      title: timeline.querySelector('h3')?.textContent.trim(), role: log.getAttribute('role'),
      dialogueVisible: !!document.querySelector('.dialogue-box'),
      events: [...log.querySelectorAll('.battle-event')].map(event => ({
        type: event.dataset.type, side: event.dataset.side,
        action: event.querySelector('.battle-event-action')?.textContent.trim(),
        turn: Number(event.closest('.battle-turn')?.dataset.turn),
      })),
    };
  })()`);
  assert.ok(recap, 'The completed battle must show its recap immediately, before advancing result dialogue');
  assert.equal(recap.dialogueVisible, true, 'The recap must accompany the result conversation');
  assert.equal(recap.title, 'Battle recap', 'Completed encounter history must be labeled as a recap');
  assert.equal(recap.role, 'log', 'Terminal battle history must retain the accessible log role');
  assert.equal(recap.events.at(-1)?.turn, terminalTurn, 'The recap must preserve the completed final turn');
  const terminal = recap.events.filter(event => event.turn === terminalTurn);
  if (outcome === 'victory') {
    const hitIndex = terminal.findLastIndex(event => event.type === 'damage');
    assert.ok(hitIndex >= 0, 'Victory recap must preserve the decisive hit');
    assert.equal(terminal[hitIndex].side, 'player');
    assert.equal(terminal[hitIndex + 1]?.type, 'faint', 'The decisive hit must be followed by the enemy fainting');
    assert.equal(terminal[hitIndex + 1]?.side, 'enemy');
    assert.equal(terminal[hitIndex + 2]?.action, 'Victory', 'Enemy fainting must be followed by victory');
    assert.ok(terminal.slice(hitIndex + 3).every(event => event.action === 'Level up'), 'Only earned level updates may follow victory');
  } else if (outcome === 'bond') {
    const accepted = terminal.findIndex(event => event.action === 'Bond accepted');
    assert.ok(accepted >= 0, 'Bond recap must show the accepted crystal');
    assert.equal(terminal[accepted].type, 'bond');
    assert.equal(terminal[accepted].side, 'player');
    assert.equal(terminal[accepted + 1]?.action, 'Bond complete', 'The accepted crystal must be followed by bond completion');
  } else {
    assert.equal(terminal.at(-1)?.action, 'Escaped', 'Leaving a wild battle must preserve the escape outcome');
    assert.equal(terminal.at(-1)?.side, 'system');
  }
}

async function checkInitialRewardFocus() {
  const opening = await evaluate(`(() => {
    const rewards = document.querySelector('.battle-progression');
    const heading = rewards?.querySelector('#battle-progression-title');
    const modal = rewards?.closest('.modal');
    if (!rewards || !heading || !modal) return null;
    const title = heading.getBoundingClientRect(), container = modal.getBoundingClientRect();
    const save = JSON.parse(localStorage.getItem(${JSON.stringify(saveKey)}));
    const base = save?.time === 'night' ? 'night' : save?.map === 'forest' ? 'forest' : 'village';
    const outcome = rewards.dataset.outcome;
    return { focused: document.activeElement === rewards, tabindex: rewards.getAttribute('tabindex'), scrollTop: modal.scrollTop,
      musicScene: document.querySelector('#music-status')?.dataset.scene, expectedMusic: ['victory', 'bond'].includes(outcome) ? 'celebration' : outcome === 'defeat' ? 'rest' : base,
      headingVisible: title.top >= Math.max(0, container.top) - 1 && title.bottom <= Math.min(innerHeight, container.bottom) + 1 && title.left >= 0 && title.right <= innerWidth };
  })()`);
  assert.ok(opening, 'A new battle result must immediately show its rewards');
  assert.equal(opening.focused, true, 'A new battle result must focus rewards before the result conversation');
  assert.equal(opening.tabindex, '-1', 'Rewards must allow initial programmatic focus without adding an extra tab stop');
  assert.ok(opening.scrollTop <= 2 && opening.headingVisible, 'A new result must open at the top with its rewards heading visible');
  assert.equal(opening.musicScene, opening.expectedMusic, 'The result soundtrack must match victory, bonding, defeat or a return to the map');
}

const expView = selector => evaluate(`(() => {
  const root = document.querySelector(${JSON.stringify(selector)});
  if (!root) return null;
  const bar = root.querySelector('[role="progressbar"]');
  const dialogue = document.querySelector('.dialogue-box');
  const bounds = root.getBoundingClientRect();
  return {
    text: root.textContent.trim(), progress: [...root.querySelectorAll('.exp-progress-text')].map(element => element.textContent.trim()).join(' '),
    bar: bar && { now: Number(bar.getAttribute('aria-valuenow')), max: Number(bar.getAttribute('aria-valuemax')), min: Number(bar.getAttribute('aria-valuemin')) },
    earned: root.querySelector('.battle-exp-earned')?.getAttribute('data-exp'),
    name: root.querySelector('.battle-progression-name')?.textContent.trim(),
    notices: [...root.querySelectorAll('.level-up-notice')].map(notice => ({ level: Number(notice.dataset.level), text: notice.textContent.trim(), stats: [...notice.querySelectorAll('.level-up-stat')].map(stat => { const visible = stat.cloneNode(true); visible.querySelectorAll('.sr-only').forEach(element => element.remove()); return visible.textContent.trim(); }) })),
    skillNotices: root.querySelectorAll('.level-up-skills').length,
    immediate: !!dialogue && !!(root.compareDocumentPosition(dialogue) & Node.DOCUMENT_POSITION_FOLLOWING),
    pageFits: document.documentElement.scrollWidth <= innerWidth,
    overflow: root.scrollWidth > root.clientWidth + 1,
    textEscapes: [...root.querySelectorAll('.battle-progression-name, .battle-exp-earned, .exp-progress-text, .level-up-notice, .level-up-stat')].some(element => {
      const text = element.getBoundingClientRect();
      return text.left < bounds.left - 1 || text.right > bounds.right + 1;
    }),
  };
})()`);

function assertExpProgress(view, { xp, required, remaining, nextLevel, cap = false }) {
  assert.ok(view, 'Databeast progression must be visible');
  if (cap) {
    assert.match(view.progress, /Maximum level.*Lv\. 50/i, 'A level 50 Databeast must show the level cap');
    assert.equal(view.bar, null, 'A capped Databeast must not show a bar toward an unavailable level');
    return;
  }
  assert.ok(view.progress.includes(`${xp} / ${required} EXP`), 'Progress must show the exact saved EXP and next-level requirement');
  assert.ok(view.progress.includes(`${remaining} EXP to Lv. ${nextLevel}`), 'Progress must show the exact EXP remaining to the next level');
  assert.deepEqual(view.bar, { now: xp, max: required, min: 0 }, 'Accessible progress values must agree with the visible EXP');
}

async function checkProgressionResult(expected, mobile = false, viewportWidth = mobile ? 390 : 1440) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: mobile ? 844 : 1050, deviceScaleFactor: 1, mobile });
  await sleep(150);
  const view = await expView('.battle-progression');
  assert.ok(view?.immediate, 'Battle rewards must be visible before advancing the result conversation');
  assert.ok(typeof view.earned === 'string' && view.earned !== '', 'Battle results must include an explicit EXP amount');
  assert.equal(Number(view.earned), expected.earned, 'Battle results must show the actual EXP awarded');
  if (expected.name) assert.ok(view.name?.includes(expected.name), 'Battle results must name the Databeast receiving EXP');
  if (expected.required || expected.cap) assertExpProgress(view, expected);
  assert.deepEqual(view.notices.map(notice => notice.level), expected.levels || [], 'Every earned level must have one notification in order');
  if (expected.reason) assert.match(view.text, expected.reason, 'A zero-EXP result must explain why no reward was earned');
  assert.equal(view.pageFits && !view.overflow && !view.textEscapes, true, `${viewportWidth}px EXP results and stat changes must fit without overflow`);
  assert.equal(view.skillNotices, 0, 'The current roster must not display an unearned skill unlock');
  assert.doesNotMatch(view.text, /(?:Unlocked|New|Learned)\s+(?:skill|move)\s*:/i, 'The current roster must not invent a skill unlock');
  return view;
}

async function checkBattleProgression() {
  const original = await saved();
  const fixture = ({ kind = 'rival', xp = 0, level = 5, bench = false, activeIndex = 0, enemyHp = 1 } = {}) => {
    let state = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
    Object.assign(state.party[0], { xp, level, maxHp: SPECIES.creature_statifox.baseHp + level * 3, hp: SPECIES.creature_statifox.baseHp + level * 3 });
    if (bench) {
      const speciesId = 'creature_algobear', maxHp = SPECIES[speciesId].baseHp + 15;
      state.party.push({ uid: 'exp-qa-algobear', speciesId, hp: maxHp, maxHp, focus: 8, level: 5, xp: 0 });
      state.dex.species[speciesId].seen = true;
      state.dex.species[speciesId].recruited = true;
    }
    if (kind === 'wild') { state.flags.rivalDefeated = true; state.quests.firstBond.status = 'complete'; }
    state = act(state, { type: 'START_BATTLE', kind }).state;
    state.battle.activeIndex = activeIndex;
    state.battle.enemy.hp = enemyHp;
    return state;
  };
  const inject = async state => {
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(serializeGame(state))})`);
    await reloadGame();
    await waitHeading(state.battle.kind === 'wild' ? 'Wild Voltkit encounter' : 'friendly challenge');
  };
  try {
    const normal = fixture({ bench: true, activeIndex: 1 });
    await inject(normal);
    assertExpProgress(await expView('.battle-combatant[data-side="player"] .battle-stat'), { xp: 0, required: 100, remaining: 100, nextLevel: 6 });
    await action('battle-move', '[data-id="observe_strike"]');
    await checkInitialRewardFocus();
    const normalResult = await saved();
    assert.equal(normalResult.party[1].xp, 30, 'The active Databeast must receive the rival reward');
    assert.equal(normalResult.party[0].xp, 0, 'A benched starter must not receive another Databeast\'s EXP');
    const normalExpected = { earned: 30, name: 'Algobear', xp: 30, required: 100, remaining: 70, nextLevel: 6 };
    await checkProgressionResult(normalExpected);
    await evaluate(`document.querySelector('.battle-progression').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-exp-desktop.png');
    await checkProgressionResult(normalExpected, true);
    await evaluate(`document.querySelector('.battle-progression').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-exp-mobile.png', true);
    await checkProgressionResult(normalExpected, true, 320);

    const threshold = fixture({ xp: 90, bench: true });
    await inject(threshold);
    assertExpProgress(await expView('.battle-combatant[data-side="player"] .battle-stat'), { xp: 90, required: 100, remaining: 10, nextLevel: 6 });
    await action('battle-move', '[data-id="observe_strike"]');
    await checkInitialRewardFocus();
    const leveled = await saved();
    assert.deepEqual({ level: leveled.party[0].level, xp: leveled.party[0].xp, maxHp: leveled.party[0].maxHp }, { level: 6, xp: 20, maxHp: 50 }, 'A threshold victory must retain leftover EXP and the actual new stats');
    assert.equal(leveled.party[1].xp, 0, 'Level-up rewards must apply only to their recipient');
    const levelExpected = { earned: 30, name: 'Statifox', xp: 20, required: 120, remaining: 100, nextLevel: 7, levels: [6] };
    const levelView = await checkProgressionResult(levelExpected);
    assert.ok(levelView.notices[0].stats.some(stat => /Max HP\s*47\s*→\s*50\s*\(\+3\)/i.test(stat)), 'A level-up notice must show the actual maximum HP increase');
    assert.ok(levelView.notices[0].stats.some(stat => /Attack(?: strength)?\s*8\s*→\s*9\s*\(\+1\)/i.test(stat)), 'A level-up notice must show a changed attack stat');
    await evaluate(`document.querySelector('.battle-progression').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-level-up.png');
    await checkProgressionResult(levelExpected, true);
    await evaluate(`document.querySelector('.battle-progression').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-level-up-mobile.png', true);
    await checkProgressionResult(levelExpected, true, 320);
    await evaluate(`document.querySelector('[data-action="dialogue-next"]').focus({ preventScroll: true })`);
    await action('dialogue-next');
    assert.equal(await evaluate(`document.activeElement?.dataset.action`), 'dialogue-next', 'Advancing result dialogue must preserve focus on Next instead of refocusing rewards');
    await finishDialogue();
    assert.deepEqual(await saved(), leveled, 'Reading result dialogue must not award EXP again');
    await reloadGame();
    assert.deepEqual(await saved(), leveled, 'A reload after battle must preserve EXP and level gains without repeating rewards');
    const partySelector = `.party-card[data-uid="${leveled.party[0].uid}"]`;
    for (const width of [1440, 390, 320]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1050 : 844, deviceScaleFactor: 1, mobile: width !== 1440 });
      await sleep(100);
      const party = await expView(partySelector);
      assertExpProgress(party, levelExpected);
      assert.equal(party.pageFits && !party.overflow && !party.textEscapes, true, `${width}px party EXP must remain readable after reload`);
    }
    await click('#save-button');
    await action('save');
    await action('load');
    assert.deepEqual(await saved(), leveled, 'Manual save/load must preserve the earned level and EXP without duplication');
    await close();

    for (const outcome of ['wild-ko', 'bond', 'defeat', 'flee', 'cap']) {
      const state = fixture({ kind: ['wild-ko', 'bond', 'flee'].includes(outcome) ? 'wild' : 'rival', level: outcome === 'cap' ? 50 : 5, enemyHp: outcome === 'defeat' ? 59 : 1 });
      if (outcome === 'defeat') state.party[0].hp = 1;
      if (outcome === 'bond') { state.battle.scanned = true; state.battle.bondAttempts = 4; }
      await inject(state);
      await action(outcome === 'bond' ? 'bond' : outcome === 'defeat' ? 'guard' : outcome === 'flee' ? 'flee' : 'battle-move', ['wild-ko', 'cap'].includes(outcome) ? '[data-id="observe_strike"]' : '');
      await checkInitialRewardFocus();
      const result = await saved();
      assert.equal(result.battle, null, `${outcome} fixture must end its encounter`);
      const earned = ['wild-ko', 'bond'].includes(outcome) ? 18 : outcome === 'cap' ? 30 : 0;
      assert.equal(result.party[0].xp, state.party[0].xp + earned, `${outcome} must award the correct EXP exactly once`);
      assert.equal(result.party[0].level, state.party[0].level, `${outcome} must not add an unearned level`);
      const expected = { earned, name: earned ? 'Statifox' : undefined, ...(earned ? { xp: earned, required: 100, remaining: 100 - earned, nextLevel: 6 } : {}), ...(outcome === 'cap' ? { cap: true } : {}), ...(outcome === 'defeat' ? { reason: /defeat|lost|no EXP/i } : outcome === 'flee' ? { reason: /left|leav|escap|no EXP/i } : {}) };
      await checkProgressionResult(expected);
      await checkProgressionResult(expected, true, 320);
      if (outcome === 'bond') assert.equal(result.party[1].xp, 0, 'A newly bonded partner must not also receive the active Databeast\'s reward');
      if (outcome === 'cap') assert.equal(result.party[0].maxHp, 182, 'A level-capped Databeast must not receive an extra maximum HP increase');
    }

    const legacy = fixture({ xp: 260 });
    for (const width of [320, 390]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await inject(legacy);
      await action('battle-move', '[data-id="observe_strike"]');
      await checkInitialRewardFocus();
      const multi = await saved();
      assert.deepEqual({ level: multi.party[0].level, xp: multi.party[0].xp, maxHp: multi.party[0].maxHp }, { level: 7, xp: 70, maxHp: 53 }, 'Legacy EXP above a threshold must apply all earned levels and preserve the remainder');
      const multiView = await checkProgressionResult({ earned: 30, name: 'Statifox', xp: 70, required: 140, remaining: 70, nextLevel: 8, levels: [6, 7] }, true, width);
      assert.ok(multiView.notices[0].stats.some(stat => /Max HP\s*47\s*→\s*50\s*\(\+3\)/i.test(stat)), 'The first level-up must report its own stat change');
      assert.ok(multiView.notices[1].stats.some(stat => /Max HP\s*50\s*→\s*53\s*\(\+3\)/i.test(stat)), 'The second level-up must report its own stat change');
      assert.equal(multiView.notices[1].stats.some(stat => /Attack/i.test(stat)), false, 'An unchanged attack stat must not be reported as a gain');
    }
    checks.push('Battle EXP: active recipient versus bench, rival30/wildKO18/bond18/defeat0/flee0, exact EXP bars and remaining totals, level5→6 HP/attack gains, maximum level, multiple legacy levels, initial rewards focus and visible heading, preserved result-dialogue focus, desktop/390px/320px fit and party/manual-save/reload persistence without duplicate rewards');
  } finally {
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(original))})`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await reloadGame();
  }
}

const battleActionCards = () => evaluate(`([...document.querySelectorAll('.battle-action-card')].map(card => ({
  action: card.dataset.action, id: card.dataset.id, index: card.dataset.index,
  group: card.closest('[data-battle-group]')?.dataset.battleGroup,
  label: card.querySelector('.battle-action-label')?.textContent.trim(),
  cost: card.querySelector('.battle-action-cost')?.textContent.trim(),
  effect: card.querySelector('.battle-action-effect')?.textContent.trim(),
  turn: card.querySelector('.battle-action-turn')?.textContent.trim(),
  limitation: card.querySelector('.battle-action-limitation')?.textContent.trim(),
  reason: card.querySelector('.battle-action-reason')?.textContent.trim(),
  disabled: card.disabled, selected: card.dataset.selected === 'true', pressed: card.getAttribute('aria-pressed'),
  visible: card.getClientRects().length > 0,
  reasonVisible: !!card.querySelector('.battle-action-reason')?.getClientRects().length,
})))`);

async function checkBattleActionLayout(mobile = false, viewportWidth = mobile ? 390 : 1440) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: mobile ? 844 : 1050, deviceScaleFactor: 1, mobile });
  await sleep(150);
  const layout = await evaluate(`(() => {
    const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
    const cards = [...document.querySelectorAll('.battle-action-card')].filter(card => card.getClientRects().length);
    const preview = document.querySelector('.battle-action-preview');
    if (!preview) return null;
    return { fits: document.documentElement.scrollWidth <= innerWidth, preview: rect(preview),
      confirm: rect(preview.querySelector('[data-action="battle-confirm"]')),
      previewOverflow: preview.scrollWidth > preview.clientWidth + 1,
      cards: cards.map(card => ({ ...rect(card), text: card.textContent.trim(), overflow: card.scrollWidth > card.clientWidth + 1,
        textEscapes: [...card.querySelectorAll('.battle-action-label, .battle-action-description, .battle-action-cost, .battle-action-effect, .battle-action-turn, .battle-action-limitation, .battle-action-reason')].some(text => {
          const bounds = rect(text), cardBounds = rect(card);
          return bounds.left < cardBounds.left - 1 || bounds.right > cardBounds.right + 1 || bounds.top < cardBounds.top - 1 || bounds.bottom > cardBounds.bottom + 1;
        }),
      })),
    };
  })()`);
  const mode = `${mobile ? 'Mobile' : 'Desktop'} (${viewportWidth}px)`;
  assert.ok(layout?.cards.length, `${mode} battle actions must show cards and a preview`);
  assert.equal(layout.fits || false, true, `${mode} action menu must fit horizontally`);
  assert.equal(layout.previewOverflow, false, `${mode} selected-action preview must not overflow`);
  assert.ok(layout.confirm.left >= layout.preview.left - 1 && layout.confirm.right <= layout.preview.right + 1 && layout.confirm.top >= layout.preview.top - 1 && layout.confirm.bottom <= layout.preview.bottom + 1, `${mode} confirm control must fit inside its preview`);
  const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  for (const [index, card] of layout.cards.entries()) {
    assert.equal(card.overflow || card.textEscapes, false, `${mode} action explanations must stay inside the card: ${card.text}`);
    assert.equal(overlaps(card, layout.preview), false, `${mode} action cards must not overlap their preview`);
    for (const next of layout.cards.slice(index + 1)) assert.equal(overlaps(card, next), false, `${mode} action cards must not overlap one another`);
  }
}

async function checkBattleActionMenu() {
  const original = await saved();
  const inject = async fixture => {
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(serializeGame(fixture))})`);
    await reloadGame();
    await waitHeading(fixture.battle.kind === 'wild' ? 'Wild Voltkit encounter' : 'friendly challenge');
  };
  const disabledReason = async (actionName, extra, reason) => {
    const selector = `.battle-action-card[data-action="${actionName}"]${extra}`;
    await showBattleCardCategory(selector);
    const card = (await battleActionCards()).find(card => card.action === actionName && (extra.includes('data-id') ? extra.includes(`"${card.id}"`) : extra.includes('data-index') ? extra.includes(`"${card.index}"`) : true));
    assert.ok(card?.disabled && card.reasonVisible, `Unavailable ${actionName} must be disabled with a visible reason`);
    assert.match(card.reason, reason, `Unavailable ${actionName} must explain its restriction`);
    return selector;
  };
  try {
    let fixture = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
    for (const [speciesId, hp] of [['creature_algobear', 40], ['creature_terradeer', 0]]) {
      fixture.party.push({ uid: `action-qa-${speciesId}`, speciesId, hp, maxHp: SPECIES[speciesId].baseHp + 15, focus: 4, level: 5, xp: 0 });
      fixture.dex.species[speciesId].seen = true;
      fixture.dex.species[speciesId].recruited = true;
    }
    fixture = act(fixture, { type: 'START_BATTLE', kind: 'rival' }).state;
    await inject(fixture);
    const beforeSelection = await saved();
    assert.equal((await battleActionCards()).filter(card => card.selected).length, 0, 'A new encounter must wait for the player to choose an action');
    assert.equal(await evaluate(`document.querySelector('[data-action="battle-confirm"]')?.disabled`), true, 'Confirm must be unavailable until an action is selected');
    for (const category of ['skills', 'commands', 'party']) {
      await click(`[data-action="battle-category"][data-id="${category}"]`);
      assert.equal(await evaluate(`document.querySelector('[data-action="battle-category"][data-id="${category}"]').getAttribute('aria-pressed')`), 'true', 'The active action category must be identified');
      const cards = (await battleActionCards()).filter(card => card.visible);
      assert.ok(cards.length && cards.every(card => card.group === category), 'Only the current category must display action cards');
      for (const card of cards) {
        assert.ok(card.label && card.cost && card.effect && card.turn, `Every action must explain its name, resource cost, effect and turn rule before selection: ${card.action}`);
        if (card.disabled) assert.ok(card.reason && card.reasonVisible, 'Disabled actions must explain why they are unavailable');
      }
      await checkBattleActionLayout();
      await checkBattleActionLayout(true);
      await checkBattleActionLayout(true, 320);
    }
    assert.deepEqual(await saved(), beforeSelection, 'Browsing action categories must not change battle progress');
    const explained = await battleActionCards();
    assert.match(explained.find(card => card.id === 'pattern_pulse').cost, /2.*Focus|Focus.*2/i, 'Pattern Pulse must state its actual Focus cost');
    assert.match(explained.find(card => card.id === 'pattern_pulse').effect, /15/, 'Attacks must state their power');
    assert.match(explained.find(card => card.action === 'scan').turn, /free|no turn|0 turn/i, 'Scanning must explicitly explain that it costs no turn');
    assert.match(explained.find(card => card.action === 'potion').effect, /30.*HP|HP.*30/i, 'Potions must explain their healing limit');
    const fullHpHeal = explained.find(card => card.id === 'quiet_recovery');
    assert.match(fullHpHeal.effect, /0 HP/i, 'A healing move at full HP must explain its actual zero healing');
    assert.match(fullHpHeal.limitation, /full HP/i, 'A healing move at full HP must explain the limitation');
    await disabledReason('potion', '', /full|maximum/i);
    await disabledReason('switch', '[data-index="0"]', /active|current|already/i);
    await disabledReason('switch', '[data-index="2"]', /faint|rest|0 HP/i);
    await disabledReason('bond', '', /Kai|rival|friendly|wild/i);
    await disabledReason('flee', '', /Kai|rival|friendly/i);

    const skill = '.battle-action-card[data-action="battle-move"][data-id="pattern_pulse"]';
    await showBattleCardCategory(skill);
    const beforeStyle = await evaluate(`(() => { const style = getComputedStyle(document.querySelector(${JSON.stringify(skill)})); window.__actionPreview = document.querySelector('.battle-action-preview'); return { border: style.borderColor, background: style.backgroundColor }; })()`);
    await click(skill);
    let selected = (await battleActionCards()).filter(card => card.selected);
    assert.equal(selected.length, 1, 'Selecting a card must highlight exactly one action');
    assert.equal(selected[0].id, 'pattern_pulse');
    assert.equal(selected[0].pressed, 'true', 'Selected cards must expose their pressed state');
    assert.deepEqual(await saved(), beforeSelection, 'Selecting a move must not spend Focus, HP, items or a turn');
    const preview = await evaluate(`(() => {
      const card = document.querySelector(${JSON.stringify(skill)}), preview = document.querySelector('.battle-action-preview'), style = getComputedStyle(card);
      return { text: preview.textContent.trim(), live: preview.getAttribute('aria-live'), stable: preview === window.__actionPreview, confirmEnabled: !preview.querySelector('[data-action="battle-confirm"]').disabled, border: style.borderColor, background: style.backgroundColor };
    })()`);
    assert.equal(preview.live, 'polite', 'The selected action preview must announce changes accessibly');
    assert.equal(preview.stable, true, 'Selecting an action must update the existing live preview');
    assert.equal(preview.confirmEnabled, true, 'A selected available action must enable confirmation');
    for (const text of [selected[0].label, selected[0].cost, selected[0].effect, selected[0].turn]) assert.ok(preview.text.includes(text), 'The preview must explain the selected action before confirmation');
    assert.ok(preview.border !== beforeStyle.border || preview.background !== beforeStyle.background, 'A selected action must have visible styling feedback');
    await checkBattleActionLayout();
    await evaluate(`document.querySelector('.battle-action-menu').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-actions-desktop.png');
    await checkBattleActionLayout(true);
    await evaluate(`document.querySelector('.battle-action-card[data-selected="true"]').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-actions-mobile.png', true);
    await evaluate(`document.querySelector('.battle-action-preview').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await screenshot('battle-actions-preview-mobile.png', true);
    await checkBattleActionLayout(true, 320);

    const guard = '.battle-action-card[data-action="guard"]';
    await showBattleCardCategory(guard);
    await click(guard);
    selected = (await battleActionCards()).filter(card => card.selected);
    assert.equal(selected.length, 1);
    assert.equal(selected[0].action, 'guard', 'Choosing another card must replace the selection');
    assert.deepEqual(await saved(), beforeSelection, 'Changing the selected action must not advance battle');
    await click('[data-action="battle-clear"]');
    assert.equal((await battleActionCards()).filter(card => card.selected).length, 0, 'Cancelling must clear the selected action');
    assert.deepEqual(await saved(), beforeSelection, 'Cancelling a selection must preserve all battle resources');
    const basic = '.battle-action-card[data-action="battle-move"][data-id="observe_strike"]';
    await showBattleCardCategory(basic);
    await evaluate(`document.querySelector(${JSON.stringify(basic)}).focus()`);
    await pressKey('Enter', 'Enter', 13);
    await pressKey('Enter', 'Enter', 13);
    assert.equal((await battleActionCards()).find(card => card.selected)?.id, 'observe_strike', 'Keyboard activation must select the focused move');
    assert.deepEqual(await saved(), beforeSelection, 'Repeated keyboard selection must not execute a move');
    for (let count = 0; count < 12 && !await evaluate(`document.activeElement?.dataset.action === 'battle-confirm'`); count++) await pressKey('Tab', 'Tab', 9);
    assert.equal(await evaluate(`document.activeElement?.dataset.action`), 'battle-confirm', 'Keyboard users must be able to Tab from a selected card to confirm');
    await pressKey('Enter', 'Enter', 13);
    await evaluate(`document.querySelector('[data-action="battle-confirm"]').click(); document.querySelector('[data-action="battle-confirm"]').click()`);
    assert.deepEqual(await saved(), act(beforeSelection, { type: 'BATTLE_MOVE', moveId: 'observe_strike' }).state, 'Confirmation must execute the selected move exactly once');
    assert.equal((await battleActionCards()).filter(card => card.selected).length, 0, 'Execution must clear the old selection');
    assert.equal(await evaluate(`document.querySelector('[data-action="battle-confirm"]').disabled`), true, 'A second action must need a fresh selection');
    await action('scan');
    await disabledReason('scan', '', /already|scanned/i);

    const limited = structuredClone(fixture);
    limited.party[0].hp -= 12;
    limited.party[0].focus = 0;
    limited.inventory.potions = 0;
    limited.inventory.bondCrystals = 0;
    await inject(limited);
    const unavailableMove = await disabledReason('battle-move', '[data-id="pattern_pulse"]', /Focus|need|require/i);
    await disabledReason('battle-move', '[data-id="quiet_recovery"]', /Focus|need|require/i);
    await disabledReason('potion', '', /no|0|empty|stock/i);
    const blockedState = await saved();
    await evaluate(`document.querySelector(${JSON.stringify(unavailableMove)}).click()`);
    assert.deepEqual(await saved(), blockedState, 'An unavailable action must not change the game');
    assert.equal((await battleActionCards()).filter(card => card.selected).length, 0, 'An unavailable action must not become selected');
    assert.ok((await battleActionCards()).find(card => card.action === 'guard' && !card.disabled), 'Guard must remain available when Focus is empty');
    assert.ok((await battleActionCards()).find(card => card.id === 'observe_strike' && !card.disabled), 'The free basic attack must remain available when Focus is empty');

    limited.battle = null;
    limited.flags.rivalDefeated = true;
    limited.quests.firstBond.status = 'complete';
    const wild = act(limited, { type: 'START_BATTLE', kind: 'wild' }).state;
    await inject(wild);
    await disabledReason('bond', '', /crystal|no|0|stock/i);
    assert.ok((await battleActionCards()).find(card => card.action === 'flee' && !card.disabled), 'Leaving must be available during a wild encounter');
    const full = structuredClone(wild);
    full.inventory.bondCrystals = 5;
    const speciesId = 'creature_samplet';
    const maxHp = SPECIES[speciesId].baseHp + 15;
    full.party.push({ uid: 'action-qa-full-party', speciesId, hp: maxHp, maxHp, focus: 8, level: 5, xp: 0 });
    full.dex.species[speciesId].seen = true;
    full.dex.species[speciesId].recruited = true;
    await inject(full);
    await disabledReason('bond', '', /party|full|four|4/i);
    let solo = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
    solo = act(solo, { type: 'START_BATTLE', kind: 'rival' }).state;
    await inject(solo);
    await disabledReason('switch', '[data-index="0"]', /already|active|another/i);
    assert.match((await battleActionCards()).find(card => card.action === 'switch').limitation, /another healthy/i, 'A lone companion must explain why switching is unavailable');
    checks.push('Battle action menu: category explanations, visible costs/effects/turn rules, two-step mouse/keyboard selection and confirmation, unchanged resources before confirm, single execution, selected feedback, full HP/low Focus/empty supplies/current or fainted companion/rival/full-party restrictions, desktop/390px/320px fit');
  } finally {
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(original))})`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await reloadGame();
  }
}

async function checkBattleMessages() {
  const original = await saved();
  try {
    // A legal imported party can share a species with Kai's partner. This
    // deliberately catches attribution based on names rather than battle sides.
    let fixture = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
    const speciesId = 'creature_algobear';
    const maxHp = SPECIES[speciesId].baseHp + 5 * 3;
    fixture.party.push({ uid: 'qa-algobear', speciesId, hp: 40, maxHp, focus: 4, level: 5, xp: 0 });
    fixture.dex.species[speciesId].seen = true;
    fixture.dex.species[speciesId].recruited = true;
    fixture = act(fixture, { type: 'START_BATTLE', kind: 'rival' }).state;
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(serializeGame(fixture))})`);
    await reloadGame();
    await waitHeading('friendly challenge');
    await action('switch', '[data-index="1"]');
    const beforeScan = await saved();
    await action('scan');
    assert.equal((await saved()).battle.turn, beforeScan.battle.turn, 'A scan message must not advance the turn');
    await action('battle-move', '[data-id="repair_rhythm"]');
    await action('guard');
    await action('potion');
    await action('battle-move', '[data-id="focus_field"]');
    await action('battle-move', '[data-id="observe_strike"]');
    await action('switch', '[data-index="0"]');
    await action('switch', '[data-index="1"]');
    const encounter = await saved();
    assert.equal(encounter.battle.activeIndex, 1, 'Same-species attribution fixture must keep the player Algobear active');
    const desktop = await checkBattleLayout();
    assert.ok(desktop.events.length > 8, 'History must retain more than the former eight-message limit');
    assert.equal(desktop.events.length, encounter.battle.log.length, 'All retained battle events must be available for review');
    const sharedSpeciesHit = desktop.events.find(event => event.side === 'enemy' && event.type === 'damage' && event.actor?.includes('Algobear') && event.target?.includes('Algobear'));
    assert.ok(sharedSpeciesHit, 'Enemy and player Databeasts with the same species must still identify actor and target');
    assert.notEqual(sharedSpeciesHit.actor, sharedSpeciesHit.target, 'Opposing Databeasts with the same name must have distinct side labels');
    for (const type of ['damage', 'heal', 'status', 'scan', 'switch']) assert.ok(desktop.events.some(event => event.type === type), `History must display ${type} events`);
    assert.ok(desktop.events.some(event => event.type === 'heal' && /Potion/i.test(event.action)), 'Potion healing must be labeled explicitly');
    assert.ok(desktop.events.some(event => event.type === 'heal' && /Repair Rhythm/i.test(event.action)), 'Databeast healing must identify its move');
    for (const event of desktop.events.filter(event => ['damage', 'heal'].includes(event.type))) assert.match(event.effect, /\d+.*HP|HP.*\d+/i, 'HP outcomes must include a readable amount and unit');
    await screenshot('battle-desktop.png');
    await checkBattleLayout(true);
    await screenshot('battle-mobile.png', true);
    await checkBattleLayout(true, 320);
    const reviewPosition = await evaluate(`(() => {
      const log = document.querySelector('.battle-log');
      log.scrollTop = 0;
      log.focus({ preventScroll: true });
      return log.scrollTop;
    })()`);
    await sleep(100);
    await action('guard');
    const reviewed = await evaluate(`(() => {
      const log = document.querySelector('.battle-log');
      return { position: log.scrollTop, focused: document.activeElement === log, awayFromLatest: log.scrollHeight - log.scrollTop - log.clientHeight > 8 };
    })()`);
    assert.ok(Math.abs(reviewed.position - reviewPosition) <= 1 && reviewed.awayFromLatest, 'A new action must preserve the position of someone reviewing earlier battle events');
    assert.equal(reviewed.focused, true, 'A new action must preserve keyboard focus while reviewing history');
    const beforeReload = await saved();
    await reloadGame();
    await waitHeading('friendly challenge');
    assert.deepEqual(await saved(), beforeReload, 'Structured battle history must survive a midbattle reload');

    // Original version 1 saves contain plain strings and no reliable side or
    // turn metadata. Preserve the text without inventing an actor or target.
    const legacy = structuredClone(beforeReload);
    legacy.battle.log = ['Statifox used Measured Strike for 8 damage.', `Earlier field note: ${'observed'.repeat(45)}`];
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(legacy))})`);
    await reloadGame();
    await waitHeading('friendly challenge');
    const legacyLayout = await checkBattleLayout(true);
    assert.equal(legacyLayout.events.length, legacy.battle.log.length, 'Original save messages must remain readable');
    assert.ok(legacyLayout.events.every(event => event.side === 'system' && event.type === 'legacy'), 'Original message strings must be shown as neutral history');
    assert.ok(legacyLayout.events.every((event, index) => event.text.includes(legacy.battle.log[index])), 'Original message text must survive loading');
    assert.equal(legacyLayout.turns[0].turn, 0, 'Original messages without turn metadata need a separate history group');
    fixture.battle = null;
    fixture.flags.rivalDefeated = true;
    fixture.quests.firstBond.status = 'complete';
    fixture = act(fixture, { type: 'START_BATTLE', kind: 'wild' }).state;
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(serializeGame(fixture))})`);
    await reloadGame();
    await waitHeading('Wild Voltkit encounter');
    await action('flee');
    assert.equal((await saved()).battle, null, 'Leaving a wild encounter must end the battle');
    await checkBattleRecap('escape', 1);
    checks.push('Battle timeline: actor/target attribution with matching species, player/enemy alignment, chronological turns, full history, damage/healing/guard/potion/scan/switch outcomes, keyboard access, desktop/390px/320px fit, latest-event reflow and preserved history review, stats/portrait separation, reload, original save history and immediate escape recap');
  } finally {
    await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(original))})`);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await reloadGame();
  }
}

const musicState = () => evaluate(`(() => {
  const status = document.querySelector('#music-status');
  return status && { scene: status.dataset.scene, status: status.dataset.status, ducked: status.dataset.ducked === 'true', gain: Number(status.dataset.effectiveGain),
    text: status.textContent.trim(), enabled: document.querySelector('#music-toggle-button')?.getAttribute('aria-pressed'), volume: Number(document.querySelector('#music-volume')?.value),
    controls: [...document.querySelectorAll('[data-music-control]')].map(control => ({ enabled: control.querySelector('[data-music-action="toggle"]')?.getAttribute('aria-pressed'), volume: Number(control.querySelector('[data-music-action="volume"]')?.value), output: control.querySelector('[data-music-volume-value]')?.textContent.trim() })) };
})()`);

async function waitMusic(scene, status) {
  return eventually(async () => { const state = await musicState(); return state?.scene === scene && (!status || state.status === status) && state; }, `Music did not enter ${scene}${status ? ` (${status})` : ''}`);
}

async function checkMusicFileSource(scene) {
  const audio = await evaluate('window.__audioTest.snapshot()');
  const current = audio.contexts[0]?.sources.findLast(source => source.live);
  assert.ok(current?.decodedFromFile && current.decodedTrack === scene && current.encodedByteLength === musicTrackSizes[scene], `${scene} playback must select its own decoded MP3 rather than a different scene or generated replacement`);
  assert.ok(audio.decodes.some(decode => decode.context === 0 && decode.track === scene && decode.byteLength === musicTrackSizes[scene] && decode.mp3), `${scene} playback must decode the actual bundled MP3 bytes`);
}

const musicFileLoads = scene => evaluate(`({ fetches: window.__audioTest.fetches.filter(request => request.track === ${JSON.stringify(scene)}).length, decodes: window.__audioTest.decodes.filter(decode => decode.context === 0 && decode.track === ${JSON.stringify(scene)}).length })`);

async function checkBackgroundMusic() {
  await cdp('Page.navigate', { url });
  await waitHeading('Every adventure');
  const before = await saved();
  try {
    const initial = await musicState();
    assert.ok(initial, 'Persistent background music controls must be available');
    assert.equal(initial.enabled, 'true', 'Background music must default to enabled');
    assert.equal(initial.volume, 30, 'Background music must default to 30 percent volume');
    assert.equal(await evaluate('window.__audioTest.contexts.length'), 0, 'Loading the game must not open an AudioContext before a user gesture');
    assert.equal(await evaluate('window.__audioTest.fetches.length'), 0, 'Loading the game must not download music before a user gesture');
    await pressKey('Shift', 'ShiftLeft', 16);
    await waitMusic('village', 'playing');
    await checkMusicFileSource('village');
    assert.equal(await evaluate('window.__audioTest.contexts.length'), 1, 'The first gesture must lazily open one music context');
    const setVolume = value => evaluate(`(() => { const input = document.querySelector('#music-volume'); input.value = ${value}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await setVolume(65);
    let state = await musicState();
    assert.equal(state.volume, 65);
    assert.ok(state.controls.length >= 2 && state.controls.every(control => control.enabled === 'true' && control.volume === 65), 'Footer and modal music controls must stay synchronized');
    assert.deepEqual(await saved(), before, 'Music volume must not change gameplay saves');
    await setVolume(0);
    assert.equal((await musicState()).gain, 0, 'Zero volume must be silent without changing gameplay');
    await setVolume(65);
    await waitMusic('village', 'playing');
    assert.equal(await evaluate('window.__audioTest.decodes.length'), 1, 'Changing volume must reuse the decoded village buffer');
    await click('#modal-root [data-music-action="toggle"]');
    assert.equal((await musicState()).enabled, 'false', 'Modal music controls must be able to mute playback');
    assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(musicPreferenceKey)}))`), { enabled: false, volume: .65 }, 'Music preferences must be stored separately from game progress');
    assert.deepEqual(await saved(), before, 'Muting music must not change gameplay saves');
    await reloadGame();
    await waitHeading('Every adventure');
    assert.equal((await musicState()).enabled, 'false', 'Mute preference must survive reload');
    assert.equal((await musicState()).volume, 65, 'Music volume preference must survive reload');
    assert.equal(await evaluate('window.__audioTest.contexts.length'), 0, 'A muted reload must not initialize audio hardware');
    await click('#modal-root [data-music-action="toggle"]');
    await waitMusic('village', 'playing');
    await checkMusicFileSource('village');
    for (const width of [1440, 390, 320]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1050 : 844, deviceScaleFactor: 1, mobile: width !== 1440 });
      await sleep(100);
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('[data-music-control]')].every(control => { const bounds = control.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && control.scrollWidth <= control.clientWidth + 1; })`), true, `${width}px music controls must fit without overlap or horizontal overflow`);
    }

    const controller = await evaluate(`(async () => {
      const { createMusicController, MUSIC_MASTER_LEVEL } = await import('/music.js');
      const storage = { getItem: () => null, setItem() {} };
      const contextId = window.__audioTest.contexts.length;
      const music = window.__musicControllerTest = createMusicController({ storage, fetchAudio: null });
      music.setScene('forest');
      const lazy = window.__audioTest.contexts.length === contextId;
      await music.unlock();
      const started = music.getState();
      music.setDialogueActive(true);
      const dialogue = music.getState();
      music.setNarrating(true);
      const narration = music.getState();
      music.setNarrating(false);
      const restored = music.getState();
      music.setDialogueActive(false);
      const base = music.getState();
      music.setScene('battle');
      const fading = window.__audioTest.snapshot().contexts[contextId];
      music.setScene('mystery'); music.setScene('celebration');
      window.__audioTest.advance(2);
      const settled = window.__audioTest.snapshot().contexts[contextId];
      const count = settled.sources.length;
      music.setScene('celebration'); music.setScene('celebration');
      const repeated = window.__audioTest.snapshot().contexts[contextId].sources.length;
      music.setHidden(true);
      const hidden = { state: music.getState(), audio: window.__audioTest.snapshot().contexts[contextId] };
      await music.setHidden(false);
      await new Promise(resolve => setTimeout(resolve, 0));
      const visible = music.getState();
      music.destroy();
      return { contextId, masterLevel: MUSIC_MASTER_LEVEL, lazy, started, dialogue, narration, restored, base, fading, settled, count, repeated, hidden, visible, closed: window.__audioTest.snapshot().contexts[contextId], events: window.__audioTest.events.filter(event => event.context === contextId) };
    })()`);
    assert.equal(controller.lazy, true, 'Selecting a scene must not create audio before an unlock gesture');
    assert.equal(controller.started.playing, true, 'Unlock must start the selected scene');
    assert.ok(controller.masterLevel > 0 && controller.masterLevel <= 1, 'Music must expose its nominal master gain');
    for (const [name, factor] of [['dialogue', .45], ['narration', .2], ['restored', .45], ['base', 1]]) assert.ok(Math.abs(controller[name].effectiveGain - controller.masterLevel * .3 * factor) < 1e-9, `${name} must use the intended music ducking level`);
    assert.ok(controller.fading.sources.some(source => source.stopAt > controller.fading.currentTime) && controller.fading.sources.filter(source => source.live).length >= 2, 'Track changes must overlap the outgoing and incoming sources during a crossfade');
    assert.ok(controller.events.some(event => event.method === 'linear' && event.value === 0) && controller.events.some(event => event.method === 'linear' && event.value > 0), 'Scene transitions must schedule gain ramps instead of abrupt cuts');
    assert.equal(controller.settled.sources.filter(source => source.live).length, 1, 'Rapid scene changes must retire old loops and leave one current source');
    assert.equal(controller.repeated, controller.count, 'Re-rendering the same scene must not create duplicate loops');
    assert.equal(controller.hidden.audio.state, 'suspended', 'Hidden pages must suspend their audio context');
    assert.equal(controller.hidden.audio.sources.filter(source => source.live).length, 0, 'Hidden pages must stop scheduled music sources');
    assert.equal(controller.visible.playing, true, 'A visible, previously unlocked page must resume its scene');
    assert.equal(controller.closed.sources.filter(source => source.live).length, 0, 'Destroying a music controller must retire its sources');

    let village = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
    village.flags.rivalDefeated = true;
    village.quests.firstBond.status = 'complete';
    const inject = async (fixture, scene) => {
      await evaluate(`localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(serializeGame(fixture))})`);
      await reloadGame();
      await waitMusic(scene);
      await pressKey('Shift', 'ShiftLeft', 16);
      await waitMusic(scene, 'playing');
    };
    const battle = act(village, { type: 'START_BATTLE', kind: 'rival' }).state;
    battle.battle.enemy.hp = 1;
    await inject(battle, 'battle');
    await checkMusicFileSource('battle');
    assert.deepEqual(await musicFileLoads('battle'), { fetches: 1, decodes: 1 }, 'Battle music must load and decode its file once');
    const sourcesBeforeMenus = await evaluate('window.__audioTest.snapshot().contexts[0].sources.length');
    await action('dex');
    await waitMusic('battle', 'playing');
    await click('#modal-root [data-action="close"]');
    await waitHeading('friendly challenge');
    await action('save-menu');
    await waitMusic('battle', 'playing');
    await click('#modal-root [data-action="close"]');
    await waitHeading('friendly challenge');
    assert.equal(await evaluate('window.__audioTest.snapshot().contexts[0].sources.length'), sourcesBeforeMenus, 'Battle music must continue through DataDex and save menus without restarting');
    assert.deepEqual(await musicFileLoads('battle'), { fetches: 1, decodes: 1 }, 'Battle menus must reuse the decoded battle file');
    await action('battle-move', '[data-id="observe_strike"]');
    await waitMusic('celebration', 'playing');
    await checkMusicFileSource('celebration');
    const resultSources = await evaluate('window.__audioTest.snapshot().contexts[0].sources.length');
    await finishDialogue();
    assert.equal(await evaluate('window.__audioTest.snapshot().contexts[0].sources.length'), resultSources, 'Result dialogue changes must keep one celebration theme');
    await close();
    await waitMusic('village', 'playing');
    await checkMusicFileSource('village');
    const villageLoads = await musicFileLoads('village');
    await visit('sanctuary', 'catch your breath');
    await waitMusic('rest', 'playing');
    await checkMusicFileSource('rest');
    await close();
    await waitMusic('village', 'playing');
    await checkMusicFileSource('village');
    assert.deepEqual(await musicFileLoads('village'), villageLoads, 'Returning to the village must reuse its downloaded and decoded MP3');
    for (const scene of ['battle', 'celebration', 'village', 'rest']) assert.deepEqual(await musicFileLoads(scene), { fetches: 1, decodes: 1 }, 'Each scene must maintain an independent one-file cache');

    const forest = structuredClone(village);
    forest.map = 'forest'; forest.player.x = 3; forest.player.y = 11;
    await inject(forest, 'forest');
    await checkMusicFileSource('forest');
    await visit('inferra', 'nocturnal');
    await waitMusic('mystery', 'playing');
    await checkMusicFileSource('mystery');
    const storySources = await evaluate('window.__audioTest.snapshot().contexts[0].sources.length');
    await finishDialogue();
    assert.equal(await evaluate('window.__audioTest.snapshot().contexts[0].sources.length'), storySources, 'A major story conversation must retain its theme across speaker changes');
    await close();
    await waitMusic('forest', 'playing');
    await checkMusicFileSource('forest');
    for (const scene of ['forest', 'mystery']) assert.deepEqual(await musicFileLoads(scene), { fetches: 1, decodes: 1 }, 'Story transitions must keep forest and mystery file caches independent');
    forest.time = 'night';
    await inject(forest, 'night');
    await checkMusicFileSource('night');
    await visit('camp', 'Wait for');
    await waitMusic('rest', 'playing');
    await checkMusicFileSource('rest');
    await close();
    await waitMusic('night', 'playing');
    await checkMusicFileSource('night');
    await visit('camp', 'Wait for');
    await waitMusic('rest', 'playing');
    await checkMusicFileSource('rest');
    await finishDialogue();
    await action('change-time');
    await waitMusic('forest', 'playing');
    await checkMusicFileSource('forest');
    for (const scene of ['night', 'rest', 'forest']) assert.deepEqual(await musicFileLoads(scene), { fetches: 1, decodes: 1 }, 'Day/night and camp transitions must reuse each scene\'s own file cache');
    const beforeHidden = await saved();
    await evaluate('window.__audioTest.setHidden(true)');
    await eventually(() => evaluate(`window.__audioTest.snapshot().contexts[0].state === 'suspended'`), 'Hidden game page did not suspend music');
    await evaluate('window.__audioTest.setHidden(false)');
    await waitMusic('forest', 'playing');
    await checkMusicFileSource('forest');
    assert.deepEqual(await musicFileLoads('forest'), { fetches: 1, decodes: 1 }, 'Resuming a hidden page must reuse its decoded scene file');
    assert.deepEqual(await saved(), beforeHidden, 'Visibility changes must not modify game progress');

    const musicFiles = [];
    // Separate sequential evaluations release each decoded PCM buffer before
    // inspecting the next full-length track; no hardware output is opened.
    for (const id of musicTrackIds) {
      const file = await evaluate(`(async () => {
        const response = await fetch(${JSON.stringify(`/music/${id}.mp3`)});
        const encoded = await response.arrayBuffer();
        const context = new OfflineAudioContext(2, 1, 22050);
        const buffer = await context.decodeAudioData(encoded.slice(0));
        const channels = [];
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const samples = buffer.getChannelData(channel);
          let peak = 0, power = 0, finite = true;
          for (let i = 0; i < samples.length; i++) { const sample = samples[i]; finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); power += sample * sample; }
          channels.push({ finite, peak, rms: Math.sqrt(power / samples.length), samples: samples.length });
        }
        return { ok: response.ok, contentType: response.headers.get('content-type'), bytes: encoded.byteLength, duration: buffer.duration, sampleRate: buffer.sampleRate, channels };
      })()`);
      assert.equal(file.ok, true, `The bundled ${id} MP3 must be served successfully`);
      assert.match(file.contentType, /^audio\/mpeg(?:;|$)/i, `The ${id} MP3 must use the MPEG audio content type`);
      assert.equal(file.bytes, musicTrackSizes[id], `The served ${id} MP3 must contain the complete bundled asset`);
      assert.ok(file.duration > 1 && file.duration < 3600 && file.channels.length >= 1 && file.channels.length <= 2, `The ${id} MP3 must decode to a finite playable duration and supported channel count`);
      assert.ok(file.channels.every(channel => channel.finite && channel.peak > .005 && channel.peak < 1.25 && channel.rms > .001 && Math.abs(channel.samples - file.duration * file.sampleRate) <= 1), `The ${id} MP3 must decode to non-silent finite audio samples within plausible PCM bounds`);
      musicFiles.push({ id, ...file });
    }

    const waveforms = await evaluate(`(async () => {
      const { renderMusicTrack } = await import('/music-tracks.js');
      const results = [];
      for (const id of ['village', 'forest', 'night', 'battle', 'mystery', 'celebration', 'rest']) {
        const context = new OfflineAudioContext(1, 44100, 22050);
        const source = context.createBufferSource();
        source.buffer = renderMusicTrack(context, id); source.connect(context.destination); source.start();
        const rendered = await context.startRendering(), samples = rendered.getChannelData(0);
        let peak = 0, power = 0, finite = true, hash = 2166136261;
        for (let i = 0; i < samples.length; i++) { const sample = samples[i]; finite &&= Number.isFinite(sample); peak = Math.max(peak, Math.abs(sample)); power += sample * sample; if (i % 17 === 0) hash = Math.imul(hash ^ (Math.round(sample * 32767) & 65535), 16777619) >>> 0; }
        results.push({ id, finite, peak, rms: Math.sqrt(power / samples.length), hash });
      }
      return results;
    })()`);
    assert.ok(waveforms.every(track => track.finite && track.peak > .005 && track.peak <= 1 && track.rms > .001), 'Each track must render a non-silent, finite waveform within the audio range');
    assert.equal(new Set(waveforms.map(track => track.hash)).size, 7, 'Every scene must render a distinct original music phrase');
    await writeFile(resolve(artifactDir, 'music-smoke.json'), JSON.stringify({ status: 'passed', musicFiles, villageFile: musicFiles.find(file => file.id === 'village'), waveforms, verification: 'Mocked output context tracks each requested MP3; native OfflineAudioContext sequentially decodes all seven actual files and renders procedural fallback samples. No audible-output claim.' }, null, 2));
    checks.push('Background music: gesture-only initialization/download, all seven matching MP3s selected by live UI scenes with independent fetch/decode cache reuse, native offline format/size/duration/channel/PCM validation for every file, synced volume/mute and separate reload preferences, crossfade ramps, rapid-transition cleanup, no duplicate loops, dialogue/narration ducking, battle menus/story/result/map/day-night transitions, hidden pause/resume, mobile fit and procedural fallback rendering (no audible-output claim)');
  } finally {
    await evaluate('window.__audioTest.setHidden(false); localStorage.clear()');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  }
}

async function checkSpokenDialogue() {
  // Headless machines may have no audio device. Mock the browser speech API so
  // this checks real UI synchronization deterministically, not audible output.
  const mock = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const voices = ['English One', 'English Two', 'English Three', 'English Four', 'English Five', 'English Six', 'English Seven'].map((name, index) => ({ name, lang: 'en-US', default: index === 0, voiceURI: name }));
    const listeners = new Map();
    const test = window.__speechTest = { spoken: [], cancelCount: 0, voices };
    class Utterance { constructor(text) { this.text = text; } }
    const synthesis = {
      getVoices() { return test.voices; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
      cancel() { test.cancelCount++; },
      speak(utterance) {
        test.spoken.push({ utterance, end: utterance.onend, error: utterance.onerror });
        utterance.onstart?.();
      },
    };
    test.voicesChanged = () => listeners.get('voiceschanged')?.();
    test.snapshot = () => ({ count: test.spoken.length, canceled: test.cancelCount, text: test.spoken.at(-1)?.utterance.text, voice: test.spoken.at(-1)?.utterance.voice?.name, rate: test.spoken.at(-1)?.utterance.rate, pitch: test.spoken.at(-1)?.utterance.pitch });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  })()` });
  let unsupported;
  const speech = () => evaluate('window.__speechTest.snapshot()');
  try {
    await cdp('Page.navigate', { url });
    await waitHeading('Every adventure');
    await action('begin');
    const first = await dialogue();
    assert.equal((await speech()).count, 0, 'Spoken dialogue must be off until the player enables it');
    assert.equal(await evaluate(`document.querySelector('#speech-toggle-button').getAttribute('aria-pressed')`), 'false');
    assert.equal(await evaluate(`document.activeElement?.dataset.action`), 'dialogue-next', 'Opening unfinished dialogue must focus Next instead of a music control');
    await pressKey('Shift', 'ShiftLeft', 16);
    const dialogueMusic = await waitMusic('village', 'playing');
    assert.ok(dialogueMusic.ducked && dialogueMusic.gain > 0, 'Music must soften while a dialogue is open');
    const beforeKeyboardMusic = await saved();
    await evaluate(`window.__musicKeyboardToggle = document.querySelector('#modal-root [data-music-action="toggle"]'); window.__musicKeyboardToggle.focus()`);
    for (const [key, code, virtualKey, enabled] of [['Enter', 'Enter', 13, 'false'], [' ', 'Space', 32, 'true']]) {
      await pressKey(key, code, virtualKey);
      assert.equal((await musicState()).enabled, enabled, `${code} must activate the focused modal music toggle`);
      assert.deepEqual(await dialogue(), first, `${code} on a music control must not advance unfinished dialogue`);
      assert.equal(await evaluate(`document.activeElement === window.__musicKeyboardToggle`), true, 'Keyboard music toggles must preserve focus on the same control');
    }
    await waitMusic('village', 'playing');
    await evaluate(`document.querySelector('#modal-music-volume').focus()`);
    await pressKey('ArrowRight', 'ArrowRight', 39);
    assert.equal((await musicState()).volume, dialogueMusic.volume + 1, 'The focused music slider must support keyboard volume changes');
    assert.deepEqual(await dialogue(), first, 'Keyboard volume changes must not advance unfinished dialogue');
    assert.equal(await evaluate(`document.activeElement?.id`), 'modal-music-volume', 'Keyboard volume changes must preserve slider focus');
    await pressKey('ArrowLeft', 'ArrowLeft', 37);
    assert.equal((await musicState()).volume, dialogueMusic.volume, 'Keyboard volume changes must be reversible');
    await evaluate(`window.__audioTest.contexts[0].suspend()`);
    await waitMusic('village', 'retry');
    await evaluate(`document.querySelector('#modal-root [data-music-action="retry"]').focus()`);
    await pressKey('Enter', 'Enter', 13);
    await waitMusic('village', 'playing');
    assert.deepEqual(await dialogue(), first, 'Retrying interrupted music with Enter must not advance unfinished dialogue');
    assert.deepEqual(await saved(), beforeKeyboardMusic, 'Keyboard music controls and retry must preserve gameplay progress');
    await action('speech-toggle');
    const firstSpeech = await speech();
    assert.equal(firstSpeech.count, 1);
    assert.equal(firstSpeech.text, first.line, 'Speech must use exactly the visible dialogue text');
    assert.ok(firstSpeech.voice, 'An available installed voice must be assigned');
    assert.ok(Math.abs((await musicState()).gain - dialogueMusic.gain * .2 / .45) < 1e-9, 'Active narration must duck music below its dialogue-only level');
    const gameBeforeSpeech = await saved();
    await evaluate(`window.__originalDialogueBox = document.querySelector('.dialogue-box'); document.querySelector('[data-action="speech-skip"]').focus()`);
    await action('speech-skip');
    assert.ok((await speech()).canceled > firstSpeech.canceled, 'Skip voice must stop speech');
    assert.ok(Math.abs((await musicState()).gain - dialogueMusic.gain) < 1e-9, 'Skipping narration must restore the dialogue music level');
    assert.deepEqual(await dialogue(), first, 'Skipping voice must not advance or close the visible segment');
    assert.equal(await evaluate(`document.querySelector('.dialogue-box') === window.__originalDialogueBox`), true, 'Speech controls must not rebuild the conversation');
    assert.equal(await evaluate(`document.activeElement?.dataset.action`), 'speech-skip', 'Playback state changes must preserve keyboard focus');
    await evaluate(`window.__speechTest.spoken[0].end?.(); window.__speechTest.voicesChanged()`);
    assert.equal((await speech()).count, 1, 'Late events and voice discovery must not replay a skipped line');
    assert.deepEqual(await saved(), gameBeforeSpeech, 'Speech controls must not modify game progression');
    await action('speech-replay');
    assert.equal((await speech()).count, 2);
    assert.equal((await speech()).text, first.line);
    const beforeNext = await speech();
    await action('dialogue-next');
    const second = await dialogue();
    const secondSpeech = await speech();
    assert.equal(secondSpeech.count, beforeNext.count + 1);
    assert.ok(secondSpeech.canceled > beforeNext.canceled, 'Next must interrupt the prior reading');
    assert.equal(secondSpeech.text, second.line);
    assert.notEqual(second.speakerId, first.speakerId, 'This check needs a speaker change');
    assert.notEqual(secondSpeech.voice, firstSpeech.voice, 'Different speakers must use different available voices');
    assert.notDeepEqual([secondSpeech.rate, secondSpeech.pitch], [firstSpeech.rate, firstSpeech.pitch], 'Character delivery must also distinguish speakers');
    await evaluate(`window.__speechTest.spoken[1].end?.(); window.__speechTest.spoken[1].error?.({ error: 'interrupted' })`);
    assert.equal(await evaluate(`document.querySelector('[data-action="speech-skip"]').getAttribute('aria-disabled')`), 'false', 'A stale callback must not stop the current speaker');
    assert.ok((await musicState()).gain < dialogueMusic.gain, 'A stale voice callback must not restore music while another line is speaking');
    await evaluate(`window.__speechTest.spoken.at(-1).end?.()`);
    assert.ok(Math.abs((await musicState()).gain - dialogueMusic.gain) < 1e-9, 'Finishing narration must restore the dialogue music level');
    assert.deepEqual(await dialogue(), second, 'Finishing speech must not advance dialogue');
    assert.equal((await speech()).count, secondSpeech.count);
    await action('dialogue-back');
    assert.equal((await speech()).text, first.line, 'Back must speak the segment being reviewed');
    await action('speech-toggle');
    const muted = await speech();
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(SPEECH_PREFERENCE_KEY)})`), 'false');
    await action('dialogue-next');
    assert.equal((await speech()).count, muted.count, 'Muting voice must allow progression without speaking');
    await action('speech-toggle');
    assert.equal((await speech()).text, (await dialogue()).line, 'Enabling voice midway must read the currently displayed line');
    const beforeClose = await speech();
    await pressKey('Escape', 'Escape', 27);
    assert.ok((await speech()).canceled > beforeClose.canceled, 'Closing a conversation must cancel speech');
    assert.equal(await dialogue(), null);
    assert.equal((await musicState()).ducked, false, 'Closing dialogue must release the dialogue music reduction');
    await reloadGame();
    await eventually(() => evaluate(`document.querySelector('#speech-toggle-button')?.getAttribute('aria-pressed') === 'true'`), 'Voice preference must survive reload');
    assert.equal((await speech()).count, 0, 'Reloading without dialogue must not speak old content');
    await click('#speech-toggle-button');
    await reloadGame();
    await eventually(() => evaluate(`document.querySelector('#speech-toggle-button')?.getAttribute('aria-pressed') === 'false'`), 'Disabled voice preference must survive reload');
    await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: mock.identifier });
    unsupported = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined }); Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });` });
    await evaluate(`localStorage.removeItem(${JSON.stringify(saveKey)}); localStorage.setItem(${JSON.stringify(SPEECH_PREFERENCE_KEY)}, 'true')`);
    await reloadGame();
    await waitHeading('Every adventure');
    await action('begin');
    const unavailableFirst = await dialogue();
    assert.equal(await evaluate(`document.querySelector('#speech-toggle-button').disabled`), true, 'An unsupported browser must clearly disable speech controls');
    assert.ok(await evaluate(`document.querySelector('#speech-status')?.textContent.trim()`), 'Unavailable speech needs a readable explanation');
    await action('dialogue-next');
    assert.notEqual((await dialogue()).line, unavailableFirst.line, 'Unsupported speech must not block normal dialogue progression');
    checks.push('Optional spoken dialogue: exact visible text, character voices, Next/Back interruption, skip/replay/mute, stale callbacks, focus preservation, music Enter/Space/slider/retry without dialogue advancement, narration music ducking/restoration, reload preferences and unsupported-browser progression (mock API; no audible-output claim)');
  } finally {
    if (unsupported) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: unsupported.identifier });
    else await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: mock.identifier });
    await evaluate('localStorage.clear()');
  }
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
  // This broad regression suite exercises continuation of the original prototype.
  // The dedicated act1-browser-smoke.mjs verifies the fresh investigation-first route.
  const legacyOpening=serializeGame(createGame());
  await cdp('Page.addScriptToEvaluateOnNewDocument', {source:`if(!localStorage.getItem(${JSON.stringify(saveKey)}))localStorage.setItem(${JSON.stringify(saveKey)},${JSON.stringify(legacyOpening)});`});
  await checkBackgroundMusic();
  await checkSpokenDialogue();
  await cdp('Page.navigate', { url });
  await waitHeading('Every adventure');
  await evaluate(`document.querySelector('#observer-name').value = 'Smoke Observer'`);
  await action('begin');
  const firstLine = await dialogue();
  assert.ok(firstLine?.line && firstLine.speaker.includes('Lyra'), 'Starter introduction must identify Professor Lyra');
  assert.ok(firstLine.portrait && firstLine.portraitVisible && firstLine.portraitLabel, 'Lyra must have a visible accessible portrait');
  assert.equal(firstLine.backEnabled, false, 'Back must be unavailable on the first segment');
  assert.equal(await evaluate(`document.querySelectorAll('#dialogue-line').length`), 1, 'Only one dialogue segment must be displayed');
  assert.equal(await evaluate(`!!document.querySelector('[data-action="choose"]')`), false, 'Starter choices must wait until the final segment');
  const beforeDialogueMovement = await saved();
  await pressKey('d', 'KeyD', 68);
  assert.deepEqual((await saved()).player, beforeDialogueMovement.player, 'Player movement must stop during dialogue');
  assert.deepEqual(await dialogue(), firstLine, 'Movement keys must not advance dialogue');
  await screenshot('dialogue.png');
  await screenshot('dialogue-mobile.png', true);
  assert.equal(await evaluate(`(() => {
    const portrait = document.querySelector('.dialogue-box svg[role="img"]')?.getBoundingClientRect();
    const line = document.querySelector('#dialogue-line')?.getBoundingClientRect();
    return document.documentElement.scrollWidth <= 390 && !!portrait && portrait.left >= 0 && portrait.right <= 390 && !!line && line.right <= 390;
  })()`), true, 'Mobile conversation and portrait must fit within the screen');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await action('dialogue-next');
  const secondLine = await dialogue();
  assert.notEqual(secondLine.line, firstLine.line, 'Next must reveal a different segment');
  await action('dialogue-back');
  assert.deepEqual(await dialogue(), firstLine, 'Back must restore the preceding text, speaker and portrait');
  await pressKey('Enter', 'Enter', 13);
  assert.deepEqual(await dialogue(), secondLine, 'Enter must advance exactly one segment');
  await pressKey('Enter', 'Enter', 13, true);
  assert.deepEqual(await dialogue(), secondLine, 'Held key repeats must not skip dialogue');
  await evaluate(`document.querySelector('[data-action="dialogue-back"]').focus()`);
  await pressKey('Enter', 'Enter', 13);
  assert.deepEqual(await dialogue(), firstLine, 'Keyboard activation of Back must go back without also advancing');
  await pressKey(' ', 'Space', 32);
  assert.deepEqual(await dialogue(), secondLine, 'Space must advance exactly one segment');
  await pressKey('e', 'KeyE', 69);
  const thirdLine = await dialogue();
  assert.notEqual(thirdLine.line, secondLine.line, 'E must advance dialogue');
  const introduction = [firstLine, secondLine, thirdLine, ...await finishDialogue()];
  assert.ok(new Set(introduction.map(segment => segment.expression)).size > 1, 'Lyra must change expression during her conversation');
  assert.equal((await dialogue()).nextEnabled, false, 'Next must stop at the final segment');
  assert.equal(await evaluate(`document.querySelectorAll('[data-action="choose"]').length`), 3, 'All three starters must be available after dialogue');
  const finalLine = await dialogue();
  await pressKey('e', 'KeyE', 69);
  await pressKey('Enter', 'Enter', 13, true);
  assert.deepEqual(await dialogue(), finalLine, 'Advancement and held keys must stop at the dialogue boundary');
  assert.equal((await saved()).starter, null, 'Advancement keys must not select a newly revealed starter');
  await action('dialogue-back');
  assert.equal(await evaluate(`!!document.querySelector('[data-action="choose"]')`), false, 'Reviewing an earlier segment must hide final choices');
  await pressKey('Escape', 'Escape', 27);
  assert.equal(await evaluate(`!!document.querySelector('#modal-root .modal')`), false, 'Escape must dismiss a conversation');
  assert.equal((await saved()).starter, null, 'Dismissal must not make a dialogue choice');
  await visit('lab', 'Choose your first companion');
  assert.deepEqual(await dialogue(), firstLine, 'Reopening a conversation must start with its first segment');
  await finishDialogue();
  await action('choose', '[data-id="creature_statifox"]');
  assert.equal((await saved()).starter, 'creature_statifox');
  checks.push('Portrait dialogue, expression changes, sequential Next/Back, Enter/Space/E, held-key guard, choice boundary, Escape, mobile fit, startup and autosave');
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
  await checkBattleProgression();
  await checkBattleActionMenu();
  await checkBattleMessages();
  console.log('Initial desktop and mobile screenshots ready. Starting full Stage 1 walkthrough.');

  await visit('lab', 'Listen to the world');
  await close();
  await visit('gate', 'Village gate');
  assert.equal((await saved()).map, 'village');
  await close();
  await visit('kai', 'A friendly rivalry');
  await finishDialogue();
  await action('start-battle', '[data-kind="rival"]');
  await action('guard');
  const beforeScan = await saved();
  await action('scan');
  const scanned = await saved();
  assert.equal(scanned.battle.turn, beforeScan.battle.turn);
  assert.equal(scanned.party[0].hp, beforeScan.party[0].hp);
  await action('potion');
  let finalRivalTurn;
  for (let i = 0; i < 12 && (await saved()).battle; i++) {
    finalRivalTurn = (await saved()).battle.turn;
    const choice = await evaluate(`document.querySelector('[data-action="battle-move"][data-id="pattern_pulse"]:not(:disabled)') ? 'pattern_pulse' : 'observe_strike'`);
    await action('battle-move', `[data-id="${choice}"]`);
  }
  assert.equal((await saved()).flags.rivalDefeated, true);
  await checkBattleRecap('victory', finalRivalTurn);
  await close();
  checks.push('Path walking, lab dialogue, locked gate, Kai victory, decisive hit/faint/victory recap before result dialogue, free scan, guard, potion');

  await visit('tower', 'The rain');
  const towerConversation = await finishDialogue();
  assert.ok(new Set(towerConversation.map(segment => segment.speakerId)).size > 1, 'The tower conversation must display multiple speakers');
  for (let i = 1; i < towerConversation.length; i++) {
    if (towerConversation[i].speakerId !== towerConversation[i - 1].speakerId) {
      assert.notEqual(towerConversation[i].speaker, towerConversation[i - 1].speaker, 'Speaker labels must update when the speaker changes');
      assert.notEqual(towerConversation[i].portrait, towerConversation[i - 1].portrait, 'Portraits must update when the speaker changes');
    }
  }
  await close();
  checks.push('Multi-speaker dialogue updates active names and portraits');
  await visit('gate');
  await visit('inferra', 'nocturnal');
  const inferraIntro = await inferraDialogue('Inferra introduction');
  assert.equal(inferraIntro.backEnabled, false, 'Inferra introduction must begin at its first segment');
  await noDialogueActions(['start-investigation', 'investigation'], 'Inferra assignment must wait until all segments are read');
  const beforeInferraIntro = await saved();
  await screenshot('inferra-dialogue.png');
  await screenshot('inferra-mobile.png', true);
  assert.equal(await evaluate(`(() => {
    const portrait = document.querySelector('.dialogue-box svg[role="img"]')?.getBoundingClientRect();
    const line = document.querySelector('#dialogue-line')?.getBoundingClientRect();
    return document.documentElement.scrollWidth <= 390 && !!portrait && portrait.left >= 0 && portrait.right <= 390 && !!line && line.right <= 390;
  })()`), true, 'Inferra portrait and dialogue must fit on mobile');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await heldDialogueKeys(inferraIntro, 'Held Enter, Space and E must not skip Inferra introduction');
  const inferraSegments = [inferraIntro];
  for (const [key, code, virtualKey] of [['Enter', 'Enter', 13], [' ', 'Space', 32], ['e', 'KeyE', 69]]) {
    const before = await dialogue();
    await pressKey(key, code, virtualKey);
    const after = await dialogue();
    assert.notEqual(after.line, before.line, `${code} must advance Inferra's conversation exactly once`);
    assert.ok(after.speaker && after.portraitVisible, 'Inferra conversation must identify every active speaker');
    await heldDialogueKeys(after, 'Repeating a key must not skip the current Inferra segment');
    inferraSegments.push(after);
  }
  for (let i = 0; i < 3; i++) await action('dialogue-back');
  assert.deepEqual(await dialogue(), inferraIntro, 'Back must restore Inferra initial name, portrait, expression and text');
  inferraSegments.push(...await finishDialogue());
  assert.ok(new Set(inferraSegments.filter(segment => segment.speakerId === 'inferra').map(segment => segment.expression)).size > 1, 'Inferra must use different expressions during her introduction');
  assert.deepEqual(await saved(), beforeInferraIntro, 'Reading Inferra introduction must not start or change the investigation');
  const inferraLastIntro = await dialogue();
  await pressKey('e', 'KeyE', 69);
  assert.deepEqual(await dialogue(), inferraLastIntro, 'E must stop at Inferra final segment');
  await evaluate(`document.querySelector('[data-action="start-investigation"]').focus()`);
  await heldDialogueKeys(inferraLastIntro, 'Held keys must not automatically accept Inferra assignment');
  assert.equal((await saved()).quests.nocturnal.status, 'locked', 'Inferra assignment must require a deliberate player choice');
  await action('dialogue-back');
  await noDialogueActions(['start-investigation'], 'Back must hide Inferra assignment while reviewing an earlier segment');
  await finishDialogue();
  await action('start-investigation');
  await action('hint');
  const inferraHint = await inferraDialogue('Inferra field guidance');
  await noDialogueActions(['dialogue-return'], 'Inferra guidance must finish before returning to field notes');
  await heldDialogueKeys(inferraHint, 'Held keys must not skip Inferra guidance');
  await finishDialogue();
  await action('dialogue-return');
  await waitHeading('The Nocturnal Mystery');
  assert.equal((await saved()).quests.nocturnal.status, 'active');
  await close();

  await visit('inferra', 'The Nocturnal Mystery');
  await inferraDialogue('Inferra active investigation revisit');
  await noDialogueActions(['investigation', 'finding'], 'Inferra active revisit must show dialogue before investigation actions');
  await finishDialogue();
  await action('investigation');
  await waitHeading('The Nocturnal Mystery');
  assert.equal(await dialogue(), null, 'Opening investigation notes must display the evidence view');
  assert.equal((await saved()).quests.nocturnal.observations.length, 0);
  await close();
  for (const time of ['day', 'night']) {
    if ((await saved()).time !== time) { await visit('camp', 'Wait for'); await finishDialogue(); await action('change-time'); }
    for (const [id, title] of [['meadow', 'Sunlit Meadow'], ['riverbank', 'Riverbank'], ['canopy', 'High Canopy']]) {
      await visit(id, title);
      await action('observe');
      await close();
    }
  }
  assert.equal((await saved()).quests.nocturnal.observations.length, 6);
  await click('#investigation-button');
  await action('investigation');
  await action('hint');
  const readyHint = await finishDialogue();
  assert.match(readyHint.map(segment => segment.line).join(' '), /compar/i, 'Completed fieldwork hints must guide comparison');
  assert.equal((await saved()).quests.nocturnal.observations.length, 6, 'Hints must preserve every recorded category');
  await action('dialogue-return');
  await close();
  await visit('inferra', 'The Nocturnal Mystery');
  const inferraReady = await inferraDialogue('Inferra ready investigation revisit');
  assert.equal((await saved()).quests.nocturnal.status, 'ready');
  await noDialogueActions(['investigation', 'finding'], 'Inferra ready revisit must show dialogue before choosing findings');
  await heldDialogueKeys(inferraReady, 'Held keys must not skip Inferra ready conversation');
  await finishDialogue();
  await action('investigation');
  await action('finding', '[data-answer="nocturnal"]');
  assert.equal((await saved()).quests.nocturnal.status, 'ready');
  await inferraDialogue('Inferra incorrect finding feedback');
  await finishDialogue();
  await action('dialogue-return');
  await action('finding', '[data-answer="biased"]');
  assert.equal((await saved()).flags.compass, true);
  await inferraDialogue('Inferra completed investigation');
  await finishDialogue();
  await action('mastery');
  const masteryIntro = await inferraDialogue('Inferra optional mastery challenge');
  await noDialogueActions(['master'], 'Inferra mastery choices must wait until the final segment');
  await heldDialogueKeys(masteryIntro, 'Held keys must not skip Inferra mastery introduction');
  await finishDialogue();
  const masteryLastLine = await dialogue();
  assert.equal(await evaluate(`document.querySelectorAll('[data-action="master"]').length`), 3, 'Inferra mastery must offer all three plans after dialogue');
  await evaluate(`document.querySelector('[data-action="master"][data-answer="representative"]').focus()`);
  await heldDialogueKeys(masteryLastLine, 'Held keys must not automatically select a mastery plan');
  assert.equal((await saved()).dex.concepts.concept_sampling_bias, 'understood', 'Mastery needs a deliberate answer');
  await action('master', '[data-answer="night"]');
  const masteryFeedback = await inferraDialogue('Inferra incorrect mastery feedback');
  assert.equal(masteryFeedback.expression, 'thoughtful', 'Incorrect mastery feedback must show Inferra thoughtful expression');
  await noDialogueActions(['dialogue-return', 'master'], 'Inferra mastery feedback must finish before returning to the challenge');
  await finishDialogue();
  await action('dialogue-return');
  await waitHeading('Plan the next expedition');
  assert.deepEqual(await dialogue(), masteryLastLine, 'Returning from feedback must preserve the final mastery introduction segment');
  assert.equal(await evaluate(`document.querySelectorAll('[data-action="master"]').length`), 3, 'Returning from feedback must immediately restore the mastery choices');
  await action('master', '[data-answer="representative"]');
  assert.equal((await saved()).dex.concepts.concept_sampling_bias, 'mastered');
  const masterySuccess = await inferraDialogue('Inferra mastery success feedback');
  assert.equal(masterySuccess.expression, 'happy', 'Successful mastery feedback must show Inferra happy expression');
  await noDialogueActions(['dialogue-return'], 'Mastery success dialogue must finish before reviewing discoveries');
  await finishDialogue();
  await action('dialogue-return');
  await waitHeading('The DataDex');
  assert.equal(await evaluate(`document.querySelector('[data-action="dex-tab"][data-tab="knowledge"]').classList.contains('active')`), true, 'Mastery success must return to DataDex discoveries');
  await close();

  await visit('inferra', 'A fuller picture of the forest');
  const completedInferra = await inferraDialogue('Inferra completed investigation revisit');
  await noDialogueActions(['investigation', 'mastery', 'dex'], 'Inferra completed revisit must finish before offering followup choices');
  await heldDialogueKeys(completedInferra, 'Held keys must not skip Inferra completed conversation');
  await finishDialogue();
  assert.equal(await evaluate(`!!document.querySelector('[data-action="investigation"]')`), true, 'Completed Inferra visit must offer the investigation notes');
  await action('investigation');
  await waitHeading('The Nocturnal Mystery');
  assert.equal((await saved()).quests.nocturnal.status, 'complete');
  await close();
  checks.push('Inferra portraits and expressions, initial/active/ready/completed NPC conversations, Next/Back and Enter/Space/E, mobile fit, held-key and gated-action safety');
  checks.push('All six habitat/time observations, portrait guidance and revised conclusion, Sampling Compass, wrong mastery feedback retry, mastery success and DataDex discoveries');

  assert.equal((await saved()).flags.recruitedVoltkit, false);
  await click('#investigation-button');
  await waitHeading('Your quest journal');
  assert.equal(await evaluate(`!!document.querySelector('[data-action="next-objective"]')`), true, 'A finished investigation must guide the player home');
  await screenshot('quest-journal.png');
  await screenshot('quest-journal-mobile.png', true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 390'), true, 'Quest journal must fit on mobile');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await action('next-objective');
  await eventually(async () => (await saved()).map === 'village', 'Quest journal must lead to the forest exit');
  await click('#investigation-button');
  await action('next-objective');
  await waitHeading('Bring the evidence home');
  await noDialogueActions(['report-findings'], 'Sharing the report must wait for Lyra dialogue');
  assert.equal((await saved()).flags.reportedToLyra, false, 'Reading the report scene must not finish the quest');
  await finishDialogue();
  const reportLastLine = await dialogue();
  await evaluate(`document.querySelector('[data-action="report-findings"]').focus()`);
  await heldDialogueKeys(reportLastLine, 'Held keys must not submit the report');
  await action('report-findings');
  assert.equal((await saved()).flags.reportedToLyra, true);
  assert.equal((await saved()).flags.recruitedVoltkit, false, 'Main story must finish without optional recruitment');
  await waitHeading('A first step for Harvest Village');
  await close();
  assert.equal(await evaluate(`document.querySelector('#objective').textContent.includes('Stage 1 main story complete')`), true);
  await reloadGame();
  await eventually(async () => (await saved()).flags.reportedToLyra, 'The field report must survive reload');
  await visit('lab', 'Listen to the world');
  await finishDialogue();
  assert.equal(await evaluate(`!!document.querySelector('[data-action="report-findings"]')`), false, 'Returning to Lyra must not offer duplicate completion');
  await close();
  checks.push('Quest journal purpose/action/completion/hints, mobile fit, guided return to village and lab, gated report, optional recruitment independence, report save/reload and completed Lyra revisit');
  await visit('gate');

  await visit('voltkit', 'A spark in');
  await finishDialogue();
  await action('start-battle', '[data-kind="wild"]');
  await action('scan');
  await action('battle-move', '[data-id="observe_strike"]');
  await action('battle-move', '[data-id="observe_strike"]');
  const midbattle = await saved();
  await reloadGame();
  await waitHeading('Wild Voltkit encounter');
  assert.deepEqual(await saved(), midbattle, 'Reload must preserve the unfinished encounter');
  await action('save-menu');
  await action('save');
  await action('load');
  await waitHeading('Wild Voltkit encounter');
  let finalBondTurn;
  for (let i = 0; i < 5 && (await saved()).battle; i++) {
    finalBondTurn = (await saved()).battle.turn;
    await action('bond');
  }
  assert.equal((await saved()).flags.recruitedVoltkit, true);
  assert.equal((await saved()).party.length, 2);
  await checkBattleRecap('bond', finalBondTurn);
  await close();
  checks.push('Voltkit scan and weakening, midbattle reload and manual load, successful recruitment with immediate accepted-crystal/bond-complete recap');

  await visit('exit');
  await visit('sanctuary', 'catch your breath');
  await finishDialogue();
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
  await reloadGame();
  await eventually(() => evaluate(`document.querySelector('#objective')?.textContent.includes('Stage 1 main story complete')`), 'Completed progress did not resume');
  assert.deepEqual(await saved(), completed);
  checks.push('Sanctuary healing/restocking, DataDex field notes, export/new journey/import, final reload');
  await screenshot('completed.png');
  assert.deepEqual(errors, [], 'Browser runtime must have no errors');
  await writeFile(resolve(artifactDir, 'browser-smoke.json'), JSON.stringify({ status: 'passed', url, checks, errors, screenshots: ['dialogue.png', 'dialogue-mobile.png', 'battle-desktop.png', 'battle-mobile.png', 'battle-actions-desktop.png', 'battle-actions-mobile.png', 'battle-actions-preview-mobile.png', 'battle-exp-desktop.png', 'battle-exp-mobile.png', 'battle-level-up.png', 'battle-level-up-mobile.png', 'inferra-dialogue.png', 'inferra-mobile.png', 'quest-journal.png', 'quest-journal-mobile.png', 'prototype.png', 'mobile.png', 'completed.png'] }, null, 2));
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
