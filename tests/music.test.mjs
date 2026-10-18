import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicController, MUSIC_MASTER_LEVEL, MUSIC_PREFERENCE_KEY, MUSIC_TRACKS } from '../dist/music.js';
import { renderMusicSamples } from '../dist/music-tracks.js';

class Parameter {
  constructor() { this.value = 0; this.calls = []; }
  cancelScheduledValues(time) { this.calls.push(['cancel', time]); }
  setValueAtTime(value, time) { this.value = value; this.calls.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.calls.push(['ramp', value, time]); }
}
class Gain {
  constructor() { this.gain = new Parameter(); this.connections = []; this.disconnected = false; }
  connect(node) { this.connections.push(node); }
  disconnect() { this.disconnected = true; }
}
class Source {
  constructor(context) { this.context = context; this.connections = []; this.starts = []; this.stops = []; this.disconnected = false; }
  connect(node) { this.connections.push(node); }
  disconnect() { this.disconnected = true; }
  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); this.stopTime = time; if (time <= this.context.currentTime) this.end(); }
  end() { if (this.ended) return; this.ended = true; this.onended?.(); }
}
class Context {
  constructor() {
    this.state = 'suspended'; this.currentTime = 0; this.destination = {};
    this.sources = []; this.gains = []; this.buffers = []; this.listeners = new Set();
    this.resumeCount = 0; this.suspendCount = 0; this.closeCount = 0;
  }
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(this); this.sources.push(source); return source; }
  createBuffer(channels, length, sampleRate) {
    assert.equal(channels, 1);
    const samples = new Float32Array(length);
    const buffer = { duration: length / sampleRate, length, sampleRate, getChannelData: () => samples };
    this.buffers.push(buffer); return buffer;
  }
  addEventListener(name, listener) { assert.equal(name, 'statechange'); this.listeners.add(listener); }
  removeEventListener(name, listener) { this.listeners.delete(listener); }
  changeState(state) { this.state = state; for (const listener of this.listeners) listener(); }
  resume() {
    this.resumeCount++;
    if (this.failResume) return Promise.reject(new Error('Resume blocked'));
    if (this.deferredResume) return this.deferredResume.then(() => this.changeState('running'));
    this.changeState('running'); return Promise.resolve();
  }
  suspend() { this.suspendCount++; this.changeState('suspended'); return Promise.resolve(); }
  close() { this.closeCount++; this.changeState('closed'); return Promise.resolve(); }
  advance(seconds) {
    this.currentTime += seconds;
    for (const source of this.sources) if (source.stopTime <= this.currentTime) source.end();
  }
}

function harness(preference, options = {}) {
  const context = new Context();
  const stored = new Map(preference === undefined ? [] : [[MUSIC_PREFERENCE_KEY, preference]]);
  const writes = [];
  const changes = [];
  let created = 0;
  const storage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); stored.set(key, value); },
  };
  const controller = createMusicController({ contextFactory: () => { created++; return context; }, fetchAudio: null, storage, onChange: state => changes.push(state), ...options });
  return { controller, context, stored, writes, changes, get created() { return created; } };
}
const settle = async () => { for (let turn = 0; turn < 20; turn++) await Promise.resolve(); };
const lastRamp = parameter => parameter.calls.filter(call => call[0] === 'ramp').at(-1);
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fileHarness() {
  const fetches = [];
  const decodes = [];
  const assets = Object.fromEntries(Object.keys(MUSIC_TRACKS).map((id, index) => [id, {
    download: deferred(), decode: deferred(), bytes: new ArrayBuffer(8),
    file: { id, duration: id === 'village' ? 150.048 : 160 + index, sampleRate: 48000, numberOfChannels: 2 },
  }]));
  const h = harness(undefined, { fetchAudio: (url, options) => {
    const id = /\/([^/]+)\.mp3$/.exec(url.pathname)?.[1];
    assert.ok(assets[id], `unexpected audio URL: ${url}`);
    fetches.push({ id, url, options });
    return assets[id].download.promise;
  } });
  h.context.decodeAudioData = data => {
    const asset = Object.values(assets).find(item => item.bytes === data);
    assert.ok(asset, 'decoding must use the bytes fetched for the requested file');
    decodes.push(data);
    return asset.decode.promise;
  };
  return { ...h, ...assets.village, assets, fetches, decodes,
    async downloaded(id = 'village') {
      const asset = assets[id];
      asset.download.resolve({ ok: true, arrayBuffer: async () => asset.bytes });
      await settle();
    },
    async decoded(id = 'village') { assets[id].decode.resolve(assets[id].file); await settle(); },
  };
}

test('music preferences restore quietly, and no graph or source exists before a user unlock', async () => {
  const h = harness(JSON.stringify({ enabled: true, volume: .4 }));
  h.controller.setScene('forest');
  h.controller.setDialogueActive(true);
  assert.equal(h.created, 0);
  assert.equal(h.context.sources.length, 0);
  assert.equal(h.controller.getState().status, 'locked');
  assert.equal(h.controller.getState().volume, .4);
  await h.controller.unlock();
  assert.equal(h.created, 1);
  assert.equal(h.context.resumeCount, 1);
  assert.equal(h.context.sources.length, 1);
  assert.equal(h.context.sources[0].loop, true);
  assert.equal(h.context.sources[0].buffer.sampleRate, 22050);
  assert.equal(h.controller.getState().scene, 'forest');
  assert.equal(h.controller.getState().playing, true);
  assert.equal(h.controller.getState().effectiveGain, MUSIC_MASTER_LEVEL * .4 * .45);
  assert.equal(h.writes.length, 0, 'scene, unlock and ducking never write preferences or game saves');
  h.controller.destroy();
});

test('crossfades ramp both scene gains, cache buffers, avoid same-scene restarts and clean rapid changes', async () => {
  const h = harness();
  await h.controller.unlock();
  const village = h.context.sources[0];
  const villageGain = village.connections[0];
  assert.deepEqual(lastRamp(villageGain.gain), ['ramp', 1, 1]);
  h.context.advance(2);
  h.controller.setScene('forest');
  const forest = h.context.sources[1];
  assert.deepEqual(lastRamp(villageGain.gain), ['ramp', 0, 3]);
  assert.deepEqual(lastRamp(forest.connections[0].gain), ['ramp', 1, 3]);
  assert.equal(village.stops.at(-1), 3.02);
  h.controller.setScene('forest');
  assert.equal(h.context.sources.length, 2);
  h.context.advance(.2);
  h.controller.setScene('battle');
  assert.equal(village.disconnected, false, 'an older audible tail is allowed to finish smoothly');
  assert.equal(village.stops.at(-1), 3.02, 'a rapid transition never replaces a scheduled fade with a hard cut');
  assert.equal(h.context.sources.filter(source => !source.disconnected).length, 3);
  assert.ok(lastRamp(forest.connections[0].gain)[2] > h.context.currentTime);
  h.context.advance(2);
  assert.equal(village.disconnected, true);
  assert.equal(forest.disconnected, true);
  h.controller.setScene('village');
  assert.equal(h.context.buffers.length, 3, 'returning to village reuses its rendered AudioBuffer');
  assert.equal(h.context.sources.at(-1).buffer, village.buffer);
  assert.equal(h.writes.length, 0);
  h.controller.destroy();
  assert.ok(h.context.sources.every(source => source.disconnected));
});

test('dialogue and narration smoothly duck one master without restarting a track', async () => {
  const h = harness();
  await h.controller.unlock();
  const master = h.context.gains[0].gain;
  h.context.advance(1);
  assert.deepEqual(lastRamp(master), ['ramp', MUSIC_MASTER_LEVEL * .3, .18]);
  h.controller.setDialogueActive(true);
  assert.equal(lastRamp(master)[1], MUSIC_MASTER_LEVEL * .3 * .45);
  h.context.advance(.3);
  h.controller.setNarrating(true);
  assert.equal(lastRamp(master)[1], MUSIC_MASTER_LEVEL * .3 * .2);
  assert.equal(h.controller.getState().ducked, true);
  h.controller.setNarrating(false);
  assert.equal(lastRamp(master)[1], MUSIC_MASTER_LEVEL * .3 * .45);
  h.controller.setDialogueActive(false);
  assert.equal(lastRamp(master)[1], MUSIC_MASTER_LEVEL * .3);
  assert.equal(h.controller.getState().ducked, false);
  assert.equal(h.context.sources.length, 1);
  assert.equal(h.writes.length, 0);
  h.controller.destroy();
});

test('mute and zero volume never start sources; unmute plays the latest scene and persists only music preferences', async () => {
  const h = harness(JSON.stringify({ enabled: false, volume: .3 }));
  await h.controller.unlock();
  assert.equal(h.created, 0, 'muted music never creates an audio context');
  assert.equal(h.context.sources.length, 0);
  assert.equal(h.controller.getState().status, 'off');
  h.controller.setScene('night');
  h.controller.setEnabled(true);
  await h.controller.unlock();
  assert.equal(h.context.sources.length, 1);
  assert.equal(h.controller.getState().scene, 'night');
  h.controller.setVolume(0);
  assert.equal(h.controller.getState().playing, false);
  assert.equal(h.controller.getState().status, 'muted');
  h.controller.setScene('mystery');
  assert.equal(h.context.sources.length, 1);
  h.controller.setVolume(.5);
  assert.equal(h.context.sources.length, 2);
  assert.equal(h.controller.getState().scene, 'mystery');
  h.controller.setVolume(.5);
  h.controller.setEnabled(true);
  assert.equal(h.writes.length, 3, 'unchanged settings do not rewrite storage');
  assert.ok(h.writes.every(([key]) => key === MUSIC_PREFERENCE_KEY));
  assert.deepEqual(JSON.parse(h.stored.get(MUSIC_PREFERENCE_KEY)), { enabled: true, volume: .5 });
  const reload = harness(h.stored.get(MUSIC_PREFERENCE_KEY));
  assert.equal(reload.controller.getState().status, 'locked');
  assert.equal(reload.created, 0, 'restoring enabled music still waits for a fresh gesture');
  h.controller.destroy(); reload.controller.destroy();
});

test('hidden tabs stop sources and suspend; visible unlocked tabs resume only the latest desired scene', async () => {
  const locked = harness();
  locked.controller.setHidden(true);
  locked.controller.setHidden(false);
  assert.equal(locked.created, 0);
  const h = harness();
  await h.controller.unlock();
  const original = h.context.sources[0];
  h.controller.setHidden(true);
  assert.equal(original.disconnected, true);
  assert.equal(h.controller.getState().playing, false);
  assert.equal(h.context.suspendCount, 1);
  h.controller.setScene('rest');
  h.controller.setHidden(false);
  await settle();
  assert.equal(h.context.resumeCount, 2);
  assert.equal(h.controller.getState().playing, true);
  assert.equal(h.controller.getState().scene, 'rest');
  assert.equal(h.context.sources.length, 2);
  h.controller.destroy(); locked.controller.destroy();
});

test('blocked resumes and externally interrupted contexts wait for an explicit retry without loops', async () => {
  const h = harness();
  h.context.failResume = true;
  await h.controller.unlock();
  assert.equal(h.controller.getState().status, 'retry');
  assert.equal(h.context.sources.length, 0);
  h.controller.setScene('battle');
  h.controller.setDialogueActive(true);
  h.controller.setHidden(true);
  h.controller.setHidden(false);
  await settle();
  assert.equal(h.context.resumeCount, 1, 'settings and tab changes do not retry a blocked audio service');
  h.context.failResume = false;
  await h.controller.unlock();
  assert.equal(h.controller.getState().playing, true);
  h.context.changeState('interrupted');
  assert.equal(h.controller.getState().status, 'retry');
  assert.equal(h.controller.getState().playing, false);
  assert.ok(h.context.sources.every(source => source.disconnected));
  h.controller.setScene('forest');
  assert.equal(h.context.resumeCount, 2);
  await h.controller.unlock();
  assert.equal(h.controller.getState().scene, 'forest');
  assert.equal(h.controller.getState().playing, true);
  h.controller.destroy();
});

test('late asynchronous resume after teardown cannot start music or publish stale playback', async () => {
  const h = harness();
  let release;
  h.context.deferredResume = new Promise(resolve => { release = resolve; });
  const pending = h.controller.unlock();
  h.controller.setScene('battle');
  h.controller.destroy();
  const changes = h.changes.length;
  release();
  await pending;
  await settle();
  assert.equal(h.context.sources.length, 0);
  assert.equal(h.context.listeners.size, 0);
  assert.equal(h.context.closeCount, 1);
  assert.equal(h.controller.getState().status, 'destroyed');
  assert.equal(h.changes.length, changes);
  h.controller.setEnabled(false);
  h.controller.setVolume(1);
  h.controller.setHidden(false);
  assert.equal(h.writes.length, 0);
});

test('a closed context can be replaced while its old resume is pending without stale callbacks affecting playback', async () => {
  const first = new Context();
  const second = new Context();
  let release;
  first.deferredResume = new Promise(resolve => { release = resolve; });
  let count = 0;
  const controller = createMusicController({ contextFactory: () => count++ === 0 ? first : second, fetchAudio: null });
  const oldUnlock = controller.unlock();
  first.changeState('closed');
  controller.setScene('forest');
  await controller.unlock();
  assert.equal(controller.getState().playing, true);
  assert.equal(second.sources.length, 1);
  assert.equal(first.listeners.size, 0);
  release();
  await oldUnlock;
  assert.equal(controller.getState().playing, true);
  assert.equal(controller.getState().scene, 'forest');
  assert.equal(first.sources.length, 0);
  assert.equal(second.sources.length, 1);
  controller.destroy();
});

test('the village MP3 loads after unlock, loops its decoded stereo buffer and is cached across visits', async () => {
  const h = fileHarness();
  h.controller.setDialogueActive(true);
  assert.equal(h.fetches.length, 0, 'no download occurs before a user gesture');
  await h.controller.unlock();
  assert.equal(h.controller.getState().status, 'loading');
  assert.equal(h.context.sources.length, 0);
  assert.equal(h.fetches.length, 1);
  assert.equal(h.fetches[0].url.href, new URL('../dist/music/village.mp3', import.meta.url).href);
  await h.controller.unlock();
  h.controller.setVolume(.5);
  h.controller.setNarrating(true);
  assert.equal(h.fetches.length, 1, 'settings and repeated gestures share the pending download');
  await h.downloaded();
  assert.deepEqual(h.decodes, [h.bytes]);
  assert.equal(h.controller.getState().status, 'loading');
  await h.decoded();
  const village = h.context.sources[0];
  assert.equal(village.buffer, h.file);
  assert.equal(village.loop, true);
  assert.equal(village.loopEnd, h.file.duration);
  assert.equal(h.controller.getState().source, 'file');
  assert.equal(h.controller.getState().status, 'playing');
  assert.equal(h.controller.getState().effectiveGain, MUSIC_MASTER_LEVEL * .5 * .2);
  h.context.advance(2);
  h.controller.setScene('forest');
  await h.downloaded('forest');
  await h.decoded('forest');
  const forest = h.context.sources.at(-1);
  assert.equal(forest.buffer, h.assets.forest.file);
  h.controller.setScene('village');
  assert.equal(h.context.sources.at(-1).buffer, h.file);
  assert.equal(forest.stops.length, 1, 'returning to the MP3 still crossfades the outgoing track');
  assert.equal(h.fetches.filter(request => request.id === 'village').length, 1);
  assert.equal(h.fetches.length, 2);
  assert.equal(h.decodes.length, 2);
  h.controller.destroy();
});

test('a pending village download preserves outgoing music and never overrides a newer battle scene', async () => {
  const h = fileHarness();
  h.controller.setScene('forest');
  await h.controller.unlock();
  await h.downloaded('forest');
  await h.decoded('forest');
  const forest = h.context.sources[0];
  h.context.advance(2);
  h.controller.setScene('village');
  assert.equal(h.controller.getState().status, 'loading');
  assert.equal(h.controller.getState().playingScene, 'forest');
  assert.equal(forest.stops.length, 0, 'keep playing until the requested audio is ready');
  await h.downloaded();
  h.controller.setScene('battle');
  assert.equal(h.controller.getState().playingScene, 'forest', 'the prior bed stays audible while battle loads');
  await h.downloaded('battle');
  await h.decoded('battle');
  const battle = h.context.sources.at(-1);
  assert.equal(battle.buffer, h.assets.battle.file);
  assert.equal(h.context.sources.length, 2);
  await h.decoded();
  assert.equal(h.context.sources.length, 2, 'late village decoding cannot start a source during battle');
  assert.equal(h.controller.getState().playingScene, 'battle');
  assert.equal(battle.stops.length, 0);
  h.controller.setScene('village');
  assert.equal(h.context.sources.at(-1).buffer, h.file);
  assert.equal(h.fetches.length, 3);
  h.controller.destroy();
});

test('all seven scene MP3s load their own exact URLs, use their decoded buffers and cache independently', async () => {
  const h = fileHarness();
  const scenes = ['village', 'forest', 'night', 'battle', 'mystery', 'celebration', 'rest'];
  assert.equal(h.fetches.length, 0);
  await h.controller.unlock();
  for (const [index, id] of scenes.entries()) {
    h.controller.setScene(id);
    assert.equal(h.controller.getState().status, 'loading', id);
    const request = h.fetches.at(-1);
    assert.equal(request.id, id);
    assert.equal(request.url.href, new URL(`../dist/music/${id}.mp3`, import.meta.url).href);
    assert.equal(h.fetches.length, index + 1, 'each scene starts only its own lazy download');
    await h.downloaded(id);
    assert.equal(h.decodes.at(-1), h.assets[id].bytes);
    await h.decoded(id);
    const source = h.context.sources.at(-1);
    assert.equal(source.buffer, h.assets[id].file, `${id} plays its own decoded audio rather than another scene or a generated backup`);
    assert.equal(source.loop, true);
    assert.equal(source.loopEnd, h.assets[id].file.duration);
    assert.equal(h.controller.getState().source, 'file');
    assert.equal(h.controller.getState().error, null);
    assert.equal(h.controller.getState().playingScene, id);
    h.context.advance(2);
  }
  for (const id of [...scenes].reverse()) {
    h.controller.setScene(id);
    assert.equal(h.controller.getState().status, 'playing', 'revisits use ready buffers without loading again');
    assert.equal(h.context.sources.at(-1).buffer, h.assets[id].file);
    h.context.advance(2);
  }
  assert.equal(h.fetches.length, 7);
  assert.equal(h.decodes.length, 7);
  assert.equal(h.context.buffers.length, 0, 'successful file loading never renders a generated fallback');
  h.controller.destroy();
});

test('out-of-order concurrent MP3 decodes never interrupt the latest desired scene', async () => {
  const h = fileHarness();
  await h.controller.unlock();
  await h.downloaded('village');
  await h.decoded('village');
  const village = h.context.sources[0];
  h.context.advance(2);
  for (const id of ['forest', 'battle', 'night']) {
    h.controller.setScene(id);
    await h.downloaded(id);
  }
  assert.equal(h.fetches.length, 4);
  assert.equal(h.decodes.length, 4);
  assert.equal(village.stops.length, 0, 'the outgoing bed remains until the desired night buffer is ready');
  await h.decoded('battle');
  assert.equal(h.context.sources.length, 1, 'an earlier requested battle cannot start while night is desired');
  assert.equal(h.controller.getState().status, 'loading');
  assert.equal(h.controller.getState().playingScene, 'village');
  await h.decoded('night');
  const night = h.context.sources.at(-1);
  assert.equal(night.buffer, h.assets.night.file);
  assert.equal(h.controller.getState().playingScene, 'night');
  assert.equal(village.stops.length, 1, 'night readiness starts the normal outgoing crossfade');
  await h.decoded('forest');
  assert.equal(h.context.sources.length, 2, 'a late forest decode cannot add a source or replace night');
  assert.equal(h.controller.getState().playingScene, 'night');
  assert.equal(night.stops.length, 0);
  h.controller.setScene('battle');
  assert.equal(h.context.sources.at(-1).buffer, h.assets.battle.file, 'earlier results remain reusable in their own cache slots');
  assert.equal(h.fetches.length, 4);
  assert.equal(h.decodes.length, 4);
  h.controller.destroy();
});

test('file decoding that finishes while muted or hidden waits until playback is allowed', async () => {
  for (const mode of ['off', 'muted', 'paused']) {
    const h = fileHarness();
    await h.controller.unlock();
    await h.downloaded();
    if (mode === 'off') h.controller.setEnabled(false);
    if (mode === 'muted') h.controller.setVolume(0);
    if (mode === 'paused') h.controller.setHidden(true);
    await h.decoded();
    assert.equal(h.context.sources.length, 0, mode);
    assert.equal(h.controller.getState().status, mode);
    if (mode === 'off') h.controller.setEnabled(true);
    if (mode === 'muted') h.controller.setVolume(.3);
    if (mode === 'paused') h.controller.setHidden(false);
    await settle();
    assert.equal(h.context.sources.length, 1, mode);
    assert.equal(h.context.sources[0].buffer, h.file);
    assert.equal(h.fetches.length, 1);
    h.controller.destroy();
  }
});

test('file download or decode errors play one cached generated backup without retry loops', async () => {
  for (const failure of ['http', 'network', 'decode', 'invalid']) {
    const h = fileHarness();
    await h.controller.unlock();
    if (failure === 'http') h.download.resolve({ ok: false });
    else if (failure === 'network') h.download.reject(new Error('Connection lost'));
    else {
      await h.downloaded();
      if (failure === 'decode') h.decode.reject(new Error('Unsupported audio'));
      else h.decode.resolve({ duration: NaN });
    }
    await settle();
    assert.equal(h.controller.getState().status, 'playing', failure);
    assert.equal(h.controller.getState().source, 'generated', failure);
    assert.ok(h.controller.getState().error, failure);
    const backup = h.context.sources[0].buffer;
    assert.ok(backup.getChannelData(0).some(sample => sample !== 0));
    h.controller.setScene('rest');
    await h.downloaded('rest');
    await h.decoded('rest');
    assert.equal(h.context.sources.at(-1).buffer, h.assets.rest.file);
    h.controller.setScene('village');
    assert.equal(h.context.sources.at(-1).buffer, backup);
    assert.equal(h.fetches.filter(request => request.id === 'village').length, 1, failure);
    assert.equal(h.fetches.length, 2, failure);
    h.controller.destroy();
  }
});

test('replacing a closed context aborts its request and ignores its late decoded audio', async () => {
  const first = new Context();
  const second = new Context();
  const oldDecode = deferred();
  const oldFile = { duration: 10 };
  const newFile = { duration: 150 };
  first.decodeAudioData = () => oldDecode.promise;
  second.decodeAudioData = async () => newFile;
  let created = 0;
  const fetches = [];
  const changes = [];
  const controller = createMusicController({
    contextFactory: () => created++ === 0 ? first : second,
    fetchAudio: (url, options) => {
      fetches.push({ url, options });
      return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    },
    onChange: state => changes.push(state),
  });
  await controller.unlock();
  await settle();
  first.changeState('closed');
  await controller.unlock();
  await settle();
  assert.equal(fetches.length, 2);
  assert.equal(fetches[0].options.signal.aborted, true);
  assert.equal(second.sources[0].buffer, newFile);
  const published = changes.length;
  oldDecode.resolve(oldFile);
  await settle();
  assert.equal(first.sources.length, 0);
  assert.equal(second.sources.length, 1);
  assert.equal(changes.length, published, 'obsolete decode never publishes or starts playback');
  controller.destroy();
});

test('destroy aborts pending downloads and ignores late download or decode completion', async () => {
  for (const stage of ['download', 'decode']) {
    const h = fileHarness();
    await h.controller.unlock();
    if (stage === 'decode') await h.downloaded();
    h.controller.destroy();
    const changes = h.changes.length;
    assert.equal(h.fetches[0].options.signal.aborted, true);
    if (stage === 'download') await h.downloaded();
    await h.decoded();
    assert.equal(h.context.sources.length, 0);
    assert.equal(h.controller.getState().status, 'destroyed');
    assert.equal(h.changes.length, changes);
    assert.equal(h.decodes.length, stage === 'decode' ? 1 : 0);
  }
});

test('missing APIs, inaccessible storage, invalid preferences and invalid controls remain harmless', async () => {
  const unsupported = createMusicController({ contextFactory: null });
  assert.equal(unsupported.getState().supported, false);
  assert.equal((await unsupported.unlock()).status, 'unavailable');
  assert.doesNotThrow(() => unsupported.setScene('battle'));
  unsupported.destroy();
  for (const preference of ['broken', '{}', '{"enabled":true,"volume":4}', '{"enabled":"yes","volume":0.2}']) {
    const h = harness(preference);
    assert.equal(h.controller.getState().enabled, true);
    assert.equal(h.controller.getState().volume, .3);
    h.controller.destroy();
  }
  const h = harness(undefined, { storage: { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Denied'); } } });
  assert.doesNotThrow(() => {
    h.controller.setEnabled(false);
    h.controller.setVolume(-2);
    h.controller.setVolume(Infinity);
    h.controller.setVolume(NaN);
  });
  assert.equal(h.controller.getState().volume, 0);
  h.controller.setVolume(2);
  assert.equal(h.controller.getState().volume, 1);
  h.controller.setScene('unknown');
  assert.equal(h.controller.getState().scene, 'village');
  h.controller.destroy();
});

test('every original score renders deterministic non-silent finite samples with a smooth loop boundary', () => {
  assert.deepEqual(Object.keys(MUSIC_TRACKS).sort(), ['battle', 'celebration', 'forest', 'mystery', 'night', 'rest', 'village']);
  for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
    assert.ok(track.title);
    const rendered = renderMusicSamples(id, 8000);
    assert.equal(rendered.sampleRate, 8000);
    assert.ok(rendered.duration >= 8 && rendered.duration <= 40);
    assert.equal(rendered.samples.length, Math.round(rendered.duration * rendered.sampleRate));
    let peak = 0;
    let energy = 0;
    for (const sample of rendered.samples) {
      assert.ok(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    assert.ok(peak > .05 && peak <= .85, `${id}: audible score retains headroom`);
    assert.ok(Math.sqrt(energy / rendered.samples.length) > .01, `${id}: score is not silent`);
    assert.ok(Math.abs(rendered.samples[0] - rendered.samples.at(-1)) < .08, `${id}: no abrupt jump at the loop seam`);
  }
  assert.deepEqual(renderMusicSamples('village', 8000).samples, renderMusicSamples('village', 8000).samples);
});
