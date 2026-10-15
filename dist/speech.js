// Speech is optional presentation. It never advances dialogue or changes a save.
export const SPEECH_PREFERENCE_KEY = 'chronicles-of-data.speech-enabled.v1';

const profile = (rate, pitch, preferredNames) => Object.freeze({
  rate, pitch, preferredNames: Object.freeze(preferredNames),
});

// Names are preferences across common Microsoft, Apple, and Google inventories.
// Rate and pitch preserve character differences when only one voice is installed.
export const SPEECH_VOICE_PROFILES = Object.freeze({
  lyra: profile(.94, 1.04, ['Sonia', 'Samantha', 'Zira', 'Aria', 'Karen']),
  kai: profile(1.06, 1.12, ['Guy', 'David', 'Daniel', 'Alex']),
  inferra: profile(.95, 1, ['Serena', 'Susan', 'Jenny', 'Victoria']),
  rowan: profile(.92, .85, ['George', 'Fred', 'Mark', 'Gordon', 'David', 'Daniel']),
  ranger: profile(1, .91, ['Ryan', 'Tom', 'James', 'Albert', 'David', 'Daniel']),
  observer: profile(1.02, 1.06, ['Ava', 'Moira', 'Hazel', 'Evan']),
  narrator: profile(.98, .93, ['Hazel', 'Arthur', 'David', 'Alex']),
});

function readGlobal(name) {
  try { return globalThis[name]; } catch { return undefined; }
}

export function createSpeechController({
  synthesis = readGlobal('speechSynthesis'),
  Utterance = readGlobal('SpeechSynthesisUtterance'),
  storage = null,
  onChange = () => {},
} = {}) {
  let supported = false;
  try {
    supported = typeof synthesis?.speak === 'function'
      && typeof synthesis?.cancel === 'function' && typeof Utterance === 'function';
  } catch { /* Some browser privacy settings make the API inaccessible. */ }

  let enabled = false;
  try { enabled = storage?.getItem(SPEECH_PREFERENCE_KEY) === 'true'; } catch { /* Optional preference. */ }
  let status = supported ? (enabled ? 'idle' : 'off') : 'unavailable';
  let voiceName = null;
  let segment = null;
  let utterance = null; // Keep a strong reference until playback ends or is cancelled.
  let generation = 0;
  let destroyed = false;
  let voicesBySpeaker = new Map();
  let removeVoicesListener = () => {};

  const getState = () => ({ supported, enabled, status, voiceName });
  let lastPublished = getState();
  function publish() {
    const next = getState();
    if (Object.keys(next).every(key => next[key] === lastPublished[key])) return;
    lastPublished = next;
    try { onChange(next); } catch { /* UI feedback must never interrupt the game. */ }
  }

  function refreshVoices() {
    let voices;
    try { voices = synthesis.getVoices(); } catch { voices = []; }
    const seen = new Set();
    const english = Array.from(voices || []).filter(voice => {
      if (!voice || !/^en(?:[-_]|$)/i.test(voice.lang || '')) return false;
      const id = `${voice.voiceURI || voice.name}|${voice.lang}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).sort((a, b) => `${a.lang}|${a.name}|${a.voiceURI}`.localeCompare(`${b.lang}|${b.name}|${b.voiceURI}`));

    const assigned = new Map();
    const unused = [...english];
    for (const [speaker, settings] of Object.entries(SPEECH_VOICE_PROFILES)) {
      const rank = voice => {
        const index = settings.preferredNames.findIndex(name =>
          String(voice.name || '').toLowerCase().includes(name.toLowerCase()));
        return index < 0 ? settings.preferredNames.length : index;
      };
      const matchingUnused = unused.filter(voice => rank(voice) < settings.preferredNames.length);
      const matchingInstalled = english.filter(voice => rank(voice) < settings.preferredNames.length);
      // With a small inventory, a familiar fitting voice is better than an
      // arbitrary unused one. Character delivery still distinguishes reuse.
      const candidates = matchingUnused.length ? matchingUnused
        : matchingInstalled.length ? matchingInstalled : unused.length ? unused : english;
      const chosen = [...candidates].sort((a, b) => rank(a) - rank(b))[0];
      if (!chosen) continue; // An empty inventory can still use the browser default.
      assigned.set(speaker, chosen);
      const index = unused.indexOf(chosen);
      if (index >= 0) unused.splice(index, 1);
    }
    voicesBySpeaker = assigned;
  }

  function cancel() {
    // Invalidate first: cancel() can synchronously dispatch an old error/end event.
    generation += 1;
    utterance = null;
    try { synthesis?.cancel(); } catch { /* A failed audio service cannot block navigation. */ }
  }

  function play() {
    cancel();
    voiceName = null;
    if (!supported) status = 'unavailable';
    else if (!enabled) status = 'off';
    else if (!segment) status = 'idle';
    else {
      const token = generation;
      try {
        const next = new Utterance(segment.text);
        const speaker = Object.hasOwn(SPEECH_VOICE_PROFILES, segment.speaker) ? segment.speaker : 'narrator';
        const settings = SPEECH_VOICE_PROFILES[speaker];
        const voice = voicesBySpeaker.get(speaker);
        next.lang = 'en-US';
        next.rate = settings.rate;
        next.pitch = settings.pitch;
        next.volume = 1;
        if (voice) {
          next.voice = voice;
          next.lang = voice.lang;
        }
        voiceName = voice?.name || 'Browser default';
        const isCurrent = () => !destroyed && generation === token && utterance === next;
        next.onstart = () => {
          if (!isCurrent()) return;
          status = 'speaking';
          publish();
        };
        next.onend = () => {
          if (!isCurrent()) return;
          utterance = null;
          status = 'finished';
          publish();
        };
        next.onerror = () => {
          if (!isCurrent()) return;
          utterance = null;
          status = 'error'; // Replay can recover from a blocked start or a service failure.
          publish();
        };
        utterance = next;
        status = 'speaking';
        // A previously paused shared controller should not silently hold this line.
        try { if (synthesis.paused) synthesis.resume(); } catch { /* Attempt normal playback below. */ }
        synthesis.speak(next);
      } catch {
        utterance = null;
        status = 'error';
      }
    }
    publish();
    return getState();
  }

  if (supported) {
    refreshVoices();
    const changed = () => {
      if (!destroyed) refreshVoices();
      // New voices apply to future lines/replays; never repeat the current line.
    };
    try {
      if (typeof synthesis.addEventListener === 'function') {
        synthesis.addEventListener('voiceschanged', changed);
        removeVoicesListener = () => synthesis.removeEventListener('voiceschanged', changed);
      } else {
        const previous = synthesis.onvoiceschanged;
        const listener = event => {
          try { if (typeof previous === 'function') previous.call(synthesis, event); } catch { /* Independent listener. */ }
          changed();
        };
        synthesis.onvoiceschanged = listener;
        removeVoicesListener = () => {
          if (synthesis.onvoiceschanged === listener) synthesis.onvoiceschanged = previous;
        };
      }
    } catch { /* The initial/default voice remains usable without this event. */ }
  }

  return {
    getState,
    sync(nextSegment) {
      if (destroyed) return getState();
      const next = nextSegment && typeof nextSegment.text === 'string' && nextSegment.text.trim()
        ? nextSegment : null;
      if (next === segment) return getState();
      segment = next;
      return play();
    },
    setEnabled(value) {
      if (destroyed) return getState();
      const next = Boolean(value);
      if (enabled === next) return getState();
      enabled = next;
      try { storage?.setItem(SPEECH_PREFERENCE_KEY, String(enabled)); } catch { /* Session controls still work. */ }
      return play();
    },
    replay() {
      if (destroyed || !enabled || !supported || !segment) return getState();
      return play();
    },
    skip() {
      if (destroyed) return getState();
      cancel();
      status = !supported ? 'unavailable' : !enabled ? 'off' : segment ? 'skipped' : 'idle';
      publish();
      return getState();
    },
    destroy() {
      if (destroyed) return getState();
      destroyed = true;
      cancel();
      segment = null;
      enabled = false;
      voiceName = null;
      status = supported ? 'off' : 'unavailable';
      try { removeVoicesListener(); } catch { /* Browser teardown may already have removed it. */ }
      publish();
      return getState();
    },
  };
}
