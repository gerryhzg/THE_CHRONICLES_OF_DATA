import { MUSIC_TRACKS, renderMusicTrack } from './music-tracks.js';

export { MUSIC_TRACKS } from './music-tracks.js';
export const MUSIC_PREFERENCE_KEY = 'chronicles-of-data.music.v1';
export const MUSIC_MASTER_LEVEL = .4;
const CROSSFADE = 1;

function browserContextFactory() {
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return typeof Context === 'function' ? () => new Context() : null;
  } catch { return null; }
}

// Music is presentation only. It never reads or writes the game's save record.
export function createMusicController({ contextFactory = browserContextFactory(), fetchAudio = (...args) => globalThis.fetch(...args), storage = null, onChange = () => {} } = {}) {
  let supported = typeof contextFactory === 'function';
  let enabled = true;
  let volume = .3;
  try {
    const saved = JSON.parse(storage?.getItem(MUSIC_PREFERENCE_KEY) || 'null');
    if (saved && typeof saved.enabled === 'boolean' && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) {
      enabled = saved.enabled;
      volume = saved.volume;
    }
  } catch { /* Missing, restricted or malformed preferences use quiet defaults. */ }

  let scene = 'village';
  let context = null;
  let master = null;
  let masterEnvelope = { from: 0, to: 0, start: 0, end: 0 };
  let current = null;
  const fading = new Set();
  const buffers = new Map();
  const loadingBuffers = new Map();
  let bufferVersion = 0;
  let unlocked = false;
  let hidden = false;
  let dialogue = false;
  let narrating = false;
  let destroyed = false;
  let blocked = false;
  let resumePending = null;
  let resumeVersion = 0;
  let suspendPending = false;
  let removeStateListener = () => {};
  let status = supported ? !enabled ? 'off' : volume === 0 ? 'muted' : 'locked' : 'unavailable';

  const duckFactor = () => narrating ? .2 : dialogue ? .45 : 1;
  const mayPlay = () => !destroyed && supported && enabled && volume > 0 && unlocked && !hidden && !blocked && context?.state === 'running';
  const getState = () => ({
    supported, enabled, volume, scene,
    playing: Boolean(current && mayPlay()), status,
    ducked: dialogue || narrating,
    effectiveGain: current && mayPlay() ? MUSIC_MASTER_LEVEL * volume * duckFactor() : 0,
    source: current?.kind || null,
    playingScene: current?.scene || null,
    error: current?.error || null,
  });
  let published = getState();
  function publish() {
    const next = getState();
    if (Object.keys(next).every(key => next[key] === published[key])) return;
    published = next;
    try { onChange(next); } catch { /* Audio feedback cannot interrupt game input. */ }
  }
  function persist() {
    try { storage?.setItem(MUSIC_PREFERENCE_KEY, JSON.stringify({ enabled, volume })); } catch { /* Session controls still work. */ }
  }
  function valueAt(envelope, time) {
    if (time >= envelope.end) return envelope.to;
    if (time <= envelope.start || envelope.end <= envelope.start) return envelope.from;
    return envelope.from + (envelope.to - envelope.from) * (time - envelope.start) / (envelope.end - envelope.start);
  }
  function ramp(parameter, envelope, target, seconds) {
    const now = context.currentTime;
    const from = valueAt(envelope, now);
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(from, now);
    parameter.linearRampToValueAtTime(target, now + seconds);
    return { from, to: target, start: now, end: now + seconds };
  }
  function cleanup(record) {
    if (record.cleaned) return;
    record.cleaned = true;
    record.source.onended = null;
    try { record.source.disconnect(); } catch { /* Already disconnected. */ }
    try { record.gain.disconnect(); } catch { /* Already disconnected. */ }
    fading.delete(record);
    if (current === record) current = null;
  }
  function stop(record, seconds = 0) {
    if (!record || record.cleaned) return;
    if (current === record) current = null;
    fading.add(record);
    try {
      if (seconds > 0) record.envelope = ramp(record.gain.gain, record.envelope, 0, seconds);
      record.source.stop(context.currentTime + seconds + (seconds > 0 ? .02 : 0));
    } catch { cleanup(record); }
    if (seconds === 0) cleanup(record);
  }
  function stopAll(seconds = 0) {
    const records = new Set([...fading, ...(current ? [current] : [])]);
    for (const record of records) stop(record, seconds);
    current = null;
  }
  function setMaster(target, seconds = .18) {
    if (!master) return;
    if (masterEnvelope.to === target) return;
    masterEnvelope = ramp(master.gain, masterEnvelope, target, seconds);
  }
  function clearBuffers() {
    bufferVersion += 1;
    for (const request of loadingBuffers.values()) request.abort?.abort();
    loadingBuffers.clear();
    buffers.clear();
  }
  function prepareBuffer(trackId) {
    if (buffers.has(trackId)) return buffers.get(trackId);
    const track = MUSIC_TRACKS[trackId];
    if (!track.src || fetchAudio === null) {
      const prepared = { buffer: renderMusicTrack(context, trackId), kind: 'generated', error: null };
      buffers.set(trackId, prepared);
      return prepared;
    }
    if (!loadingBuffers.has(trackId)) {
      const targetContext = context;
      const version = bufferVersion;
      const request = { abort: typeof AbortController === 'function' ? new AbortController() : null };
      loadingBuffers.set(trackId, request);
      const isCurrent = () => !destroyed && context === targetContext && version === bufferVersion
        && targetContext.state !== 'closed' && loadingBuffers.get(trackId) === request;
      let fetched;
      try { fetched = fetchAudio(new URL(track.src, import.meta.url), { signal: request.abort?.signal }); }
      catch (error) { fetched = Promise.reject(error); }
      Promise.resolve(fetched).then(response => {
        if (!isCurrent()) return null;
        if (!response?.ok) throw new Error('Music file could not be loaded.');
        return response.arrayBuffer();
      }).then(bytes => {
        if (!isCurrent() || !bytes) return null;
        return targetContext.decodeAudioData(bytes);
      }).then(buffer => {
        if (!isCurrent()) return;
        if (!buffer || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Music file could not be decoded.');
        buffers.set(trackId, { buffer, kind: 'file', error: null });
        loadingBuffers.delete(trackId);
        sync();
      }).catch(error => {
        if (!isCurrent()) return;
        try {
          buffers.set(trackId, { buffer: renderMusicTrack(targetContext, trackId), kind: 'generated', error: error?.message || 'Music file could not be played.' });
          loadingBuffers.delete(trackId);
          sync();
        } catch {
          loadingBuffers.delete(trackId);
          blocked = true;
          sync();
        }
      }).finally(() => {
        if (loadingBuffers.get(trackId) === request) loadingBuffers.delete(trackId);
      });
    }
    return null;
  }
  function startTrack() {
    if (current?.scene === scene) return true;
    const prepared = prepareBuffer(scene);
    // Retain the current bed until the requested file has finished decoding.
    if (!prepared) return false;
    // Retain outgoing tails through their scheduled fade, even during rapid changes.
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    source.buffer = prepared.buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = source.buffer.duration;
    source.connect(gain);
    gain.connect(master);
    const record = { source, gain, scene, kind: prepared.kind, error: prepared.error, cleaned: false, envelope: { from: 0, to: 0, start: context.currentTime, end: context.currentTime } };
    source.onended = () => { cleanup(record); publish(); };
    const outgoing = current;
    current = record;
    try {
      source.start(context.currentTime);
      record.envelope = ramp(gain.gain, record.envelope, 1, CROSSFADE);
      stop(outgoing, CROSSFADE);
    } catch (error) { cleanup(record); throw error; }
    return true;
  }
  function sync() {
    if (destroyed) status = 'destroyed';
    else if (!supported) status = 'unavailable';
    else if (!enabled) { stopAll(.12); setMaster(0, .12); status = 'off'; }
    else if (volume === 0) { stopAll(.12); setMaster(0, .12); status = 'muted'; }
    else if (hidden) { stopAll(); status = 'paused'; }
    else if (!unlocked || !context) status = 'locked';
    else if (blocked) { stopAll(); status = 'retry'; }
    else if (context.state !== 'running' || suspendPending) { stopAll(); status = resumePending || suspendPending ? 'paused' : 'retry'; }
    else {
      try {
        const ready = startTrack();
        setMaster(MUSIC_MASTER_LEVEL * volume * duckFactor());
        status = ready ? 'playing' : 'loading';
      } catch { stopAll(); blocked = true; status = 'retry'; }
    }
    publish();
    return getState();
  }
  function stateChanged() {
    if (destroyed || !context) return;
    if (context.state !== 'running' && !hidden && !resumePending && !suspendPending) blocked = true;
    sync();
  }
  function ensureContext() {
    if (context && context.state !== 'closed') return;
    removeStateListener();
    resumeVersion += 1;
    resumePending = null;
    stopAll();
    try { master?.disconnect(); } catch { /* A closed context may already have released it. */ }
    clearBuffers();
    context = contextFactory();
    master = context.createGain();
    master.gain.setValueAtTime(0, context.currentTime);
    masterEnvelope = { from: 0, to: 0, start: context.currentTime, end: context.currentTime };
    master.connect(context.destination);
    if (typeof context.addEventListener === 'function') {
      context.addEventListener('statechange', stateChanged);
      removeStateListener = () => context?.removeEventListener('statechange', stateChanged);
    } else {
      const audioContext = context;
      const previous = context.onstatechange;
      const listener = event => { try { previous?.call(audioContext, event); } catch { /* Independent listener. */ } stateChanged(); };
      context.onstatechange = listener;
      removeStateListener = () => { if (audioContext.onstatechange === listener) audioContext.onstatechange = previous; };
    }
  }
  function resumeContext() {
    if (resumePending) return resumePending;
    const audioContext = context;
    const requestVersion = ++resumeVersion;
    // Defer the handler, while calling resume synchronously inside the user gesture.
    let resumed;
    try { resumed = audioContext.resume(); } catch (error) { resumed = Promise.reject(error); }
    resumePending = Promise.resolve(resumed).then(() => {
      if (destroyed || audioContext !== context || requestVersion !== resumeVersion) return;
      blocked = audioContext.state !== 'running' && !hidden;
    }).catch(() => {
      if (!destroyed && audioContext === context && requestVersion === resumeVersion) blocked = true;
    }).finally(() => {
      if (requestVersion !== resumeVersion) return;
      resumePending = null;
      if (!destroyed) sync();
    });
    return resumePending;
  }
  async function suspendHidden() {
    if (!context || context.state === 'closed' || suspendPending) return;
    suspendPending = true;
    try { await context.suspend(); } catch { /* Sources are already stopped if suspension is unavailable. */ }
    finally {
      suspendPending = false;
      if (!destroyed && !hidden && unlocked && !blocked && enabled && volume > 0) await resumeContext();
      if (!destroyed) sync();
    }
  }

  return {
    getState,
    setScene(value) {
      if (destroyed) return getState();
      const next = typeof value === 'string' && Object.hasOwn(MUSIC_TRACKS, value) ? value : 'village';
      if (next === scene) return getState();
      scene = next;
      return sync();
    },
    async unlock() {
      if (destroyed || !supported) return getState();
      if (!enabled || volume === 0) return sync();
      unlocked = true;
      blocked = false;
      if (hidden) return sync();
      try { ensureContext(); } catch { supported = false; return sync(); }
      if (context.state !== 'running') await resumeContext();
      return sync();
    },
    setEnabled(value) {
      if (destroyed) return getState();
      const next = Boolean(value);
      if (enabled === next) return getState();
      enabled = next;
      persist();
      return sync();
    },
    setVolume(value) {
      if (destroyed || !Number.isFinite(value)) return getState();
      const next = Math.max(0, Math.min(1, value));
      if (next === volume) return getState();
      volume = next;
      persist();
      return sync();
    },
    setDialogueActive(value) {
      if (destroyed || dialogue === Boolean(value)) return getState();
      dialogue = Boolean(value);
      return sync();
    },
    setNarrating(value) {
      if (destroyed || narrating === Boolean(value)) return getState();
      narrating = Boolean(value);
      return sync();
    },
    setHidden(value) {
      if (destroyed || hidden === Boolean(value)) return getState();
      hidden = Boolean(value);
      if (hidden) {
        sync();
        void suspendHidden();
      } else if (unlocked && !blocked && context && enabled && volume > 0 && !suspendPending) {
        void resumeContext();
      }
      return sync();
    },
    destroy() {
      if (destroyed) return getState();
      destroyed = true;
      resumeVersion += 1;
      resumePending = null;
      stopAll();
      try { removeStateListener(); } catch { /* Browser teardown may run first. */ }
      try { master?.disconnect(); } catch { /* Already disconnected. */ }
      try { Promise.resolve(context?.close()).catch(() => {}); } catch { /* Optional service teardown. */ }
      clearBuffers();
      status = 'destroyed';
      publish();
      return getState();
    },
  };
}
