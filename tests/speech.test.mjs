import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController, SPEECH_PREFERENCE_KEY } from '../dist/speech.js';
import { getConversation, createDialogue, currentSegment } from '../dist/dialogue.js';

const segment = (speaker = 'lyra', text = 'Look closely. What do you notice?') => ({ speaker, text });
const voice = (name, lang = 'en-US', isDefault = false) => ({ name, lang, default: isDefault, voiceURI: name });

function harness({ voices = [], preference, storageFailure = false, speakFailure = false } = {}) {
  const stored = new Map(preference === undefined ? [] : [[SPEECH_PREFERENCE_KEY, preference]]);
  const utterances = [];
  const listeners = new Map();
  const changes = [];
  const storage = {
    getItem(key) { if (storageFailure) throw new Error('Storage unavailable'); return stored.get(key) ?? null; },
    setItem(key, value) { if (storageFailure) throw new Error('Storage unavailable'); stored.set(key, String(value)); },
  };
  class Utterance { constructor(text) { this.text = text; } }
  const synthesis = {
    voices,
    cancelCount: 0,
    failSpeak: speakFailure,
    getVoices() { return this.voices; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    cancel() { this.cancelCount++; this.onCancel?.(); },
    speak(utterance) {
      if (this.failSpeak) throw new Error('Audio service unavailable');
      utterances.push(utterance);
      utterance.onstart?.();
    },
  };
  const controller = createSpeechController({ synthesis, Utterance, storage, onChange: state => changes.push(state) });
  return { controller, synthesis, utterances, stored, listeners, changes };
}

test('speech is opt-in, reads the exact current segment once, and never advances dialogue', () => {
  const { controller, utterances } = harness();
  const dialogue = createDialogue(getConversation('starters', { playerName: 'Mira' }));
  const first = currentSegment(dialogue);
  controller.sync(first);
  assert.equal(controller.getState().enabled, false);
  assert.equal(utterances.length, 0);
  controller.setEnabled(true);
  assert.equal(utterances.length, 1);
  assert.equal(utterances[0].text, first.text);
  assert.equal(controller.getState().status, 'speaking');
  controller.sync(first);
  controller.setEnabled(true);
  assert.equal(utterances.length, 1, 'Rendering the same segment must not queue another reading');
  utterances[0].onend?.();
  assert.equal(controller.getState().status, 'finished');
  assert.equal(dialogue.index, 0, 'Finishing speech must leave progression under player control');
  assert.equal(currentSegment(dialogue), first);
  controller.sync(first);
  assert.equal(utterances.length, 1, 'A completed segment must not restart during a rerender');
});

test('moving between segments interrupts speech and rejects stale completion or error events', () => {
  const { controller, synthesis, utterances, changes } = harness({ preference: 'true' });
  controller.sync(segment('lyra', 'First line.'));
  const oldEnd = utterances[0].onend;
  const oldError = utterances[0].onerror;
  synthesis.onCancel = () => oldError?.({ error: 'interrupted' });
  const before = synthesis.cancelCount;
  const previousChanges = changes.length;
  controller.sync(segment('kai', 'Second line!'));
  assert.ok(synthesis.cancelCount > before, 'The previous voice must be stopped before the next segment');
  assert.equal(utterances.length, 2);
  assert.equal(utterances[1].text, 'Second line!');
  assert.ok(changes.slice(previousChanges).every(state => state.status !== 'error'), 'Even a synchronous cancellation callback must be treated as stale');
  oldEnd?.();
  oldError?.({ error: 'interrupted' });
  assert.equal(controller.getState().status, 'speaking', 'Canceled speech callbacks must not replace the new segment state');
  utterances[1].onend?.();
  assert.equal(controller.getState().status, 'finished');
  const after = synthesis.cancelCount;
  controller.sync(null);
  assert.ok(synthesis.cancelCount > after);
  assert.equal(controller.getState().status, 'idle');
  controller.replay();
  assert.equal(utterances.length, 2, 'Closing the dialogue must clear the segment that could be replayed');
});

test('skip stops only the current reading, replay is deliberate, and mute cancels and persists', () => {
  const { controller, synthesis, utterances, stored } = harness({ preference: 'true' });
  const first = segment();
  controller.sync(first);
  const staleEnd = utterances[0].onend;
  const before = synthesis.cancelCount;
  controller.skip();
  assert.ok(synthesis.cancelCount > before);
  assert.equal(controller.getState().status, 'skipped');
  assert.equal(controller.getState().enabled, true, 'Skip must leave spoken dialogue enabled for later lines');
  controller.sync(first);
  staleEnd?.();
  assert.equal(utterances.length, 1);
  assert.equal(controller.getState().status, 'skipped');
  controller.replay();
  assert.equal(utterances.length, 2);
  assert.equal(utterances[1].text, first.text);
  const staleError = utterances[1].onerror;
  controller.setEnabled(false);
  assert.equal(controller.getState().status, 'off');
  assert.equal(stored.get(SPEECH_PREFERENCE_KEY), 'false');
  staleError?.({ error: 'canceled' });
  controller.sync(segment('inferra', 'A new observation.'));
  controller.replay();
  assert.equal(utterances.length, 2, 'Muted dialogue must remain fully readable without speaking');
  controller.setEnabled(true);
  assert.equal(utterances.at(-1).text, 'A new observation.');
  assert.equal(stored.get(SPEECH_PREFERENCE_KEY), 'true');
});

test('speech preferences restore independently of game saves and storage failure is harmless', () => {
  for (const preference of ['false', 'malformed', '1']) {
    const { controller } = harness({ preference });
    assert.equal(controller.getState().enabled, false);
  }
  assert.equal(harness({ preference: 'true' }).controller.getState().enabled, true);
  const { controller, utterances } = harness({ storageFailure: true });
  assert.doesNotThrow(() => {
    controller.sync(segment());
    controller.setEnabled(true);
    controller.setEnabled(false);
  });
  assert.equal(utterances.length, 1, 'Storage restrictions must not prevent optional playback');
  assert.equal(controller.getState().enabled, false);
});

test('available English voices and character delivery differ, with stable assignments across returns', () => {
  const { controller, utterances } = harness({ preference: 'true', voices: [voice('French default', 'fr-FR', true), voice('English One'), voice('English Two', 'en-GB'), voice('English Three')] });
  controller.sync(segment('lyra'));
  const lyra = utterances.at(-1);
  controller.sync(segment('kai'));
  const kai = utterances.at(-1);
  controller.sync(segment('inferra'));
  const inferra = utterances.at(-1);
  assert.equal(new Set([lyra.voice, kai.voice, inferra.voice]).size, 3, 'Use different installed voices when the English voice pool permits');
  assert.ok([lyra, kai, inferra].every(utterance => utterance.voice.lang.startsWith('en')));
  assert.notDeepEqual([lyra.rate, lyra.pitch], [kai.rate, kai.pitch], 'Delivery must distinguish Lyra and Kai even on devices with few voices');
  controller.sync(segment('lyra', 'Back again.'));
  assert.equal(utterances.at(-1).voice, lyra.voice);
  assert.equal(utterances.at(-1).rate, lyra.rate);
  assert.equal(utterances.at(-1).pitch, lyra.pitch);

  const windows = harness({ preference: 'true', voices: [voice('Microsoft David'), voice('Microsoft Zira'), voice('Microsoft Hazel', 'en-GB')] });
  const assigned = {};
  for (const speaker of ['lyra', 'kai', 'inferra', 'rowan', 'ranger']) {
    windows.controller.sync(segment(speaker));
    assigned[speaker] = windows.utterances.at(-1);
  }
  assert.equal(assigned.lyra.voice.name, 'Microsoft Zira');
  assert.equal(assigned.kai.voice.name, 'Microsoft David');
  assert.equal(assigned.inferra.voice.name, 'Microsoft Hazel', 'An unused English voice still provides variety');
  assert.equal(assigned.rowan.voice.name, 'Microsoft David', 'Reuse a fitting installed voice before an arbitrary fallback');
  assert.equal(assigned.ranger.voice.name, 'Microsoft David');
  assert.notDeepEqual([assigned.rowan.rate, assigned.rowan.pitch], [assigned.ranger.rate, assigned.ranger.pitch], 'Shared platform voices retain distinct character delivery');
});

test('an initially empty voice list uses the browser default and later voice loading never repeats a line', () => {
  const { controller, synthesis, utterances, listeners } = harness({ preference: 'true' });
  const first = segment();
  controller.sync(first);
  assert.equal(utterances.length, 1, 'Do not wait indefinitely for installed voices');
  assert.ok(!utterances[0].voice, 'An empty list should let the browser choose its default');
  synthesis.voices = [voice('Loaded English')];
  listeners.get('voiceschanged')?.();
  controller.sync(first);
  assert.equal(utterances.length, 1, 'Loading voices must not replay or overlap the current segment');
  controller.sync(segment('inferra', 'Try another habitat.'));
  assert.equal(utterances.at(-1).voice.name, 'Loaded English');
});

test('playback failures leave progression available and replay can recover', () => {
  const { controller, synthesis, utterances } = harness({ preference: 'true', speakFailure: true });
  const first = segment();
  assert.doesNotThrow(() => controller.sync(first));
  assert.equal(controller.getState().status, 'error');
  synthesis.failSpeak = false;
  controller.replay();
  assert.equal(utterances.at(-1).text, first.text);
  utterances.at(-1).onerror?.({ error: 'not-allowed' });
  assert.equal(controller.getState().status, 'error');
  controller.sync(segment('kai', 'We can keep going.'));
  assert.equal(utterances.at(-1).text, 'We can keep going.');
  assert.equal(controller.getState().status, 'speaking');
});

test('unsupported or incomplete browser APIs leave dialogue usable without throwing', () => {
  for (const options of [{ synthesis: null, Utterance: null }, { synthesis: { speak() {} }, Utterance: class {} }, { synthesis: { speak() {}, cancel() {} }, Utterance: null }]) {
    const controller = createSpeechController({ ...options, storage: null });
    assert.equal(controller.getState().supported, false);
    assert.doesNotThrow(() => {
      controller.sync(segment());
      controller.setEnabled(true);
      controller.skip();
      controller.replay();
      controller.sync(null);
      controller.destroy();
    });
    assert.equal(controller.getState().status, 'unavailable');
  }
});

test('destroy cancels active speech, removes voice listeners, and makes late callbacks harmless', () => {
  const { controller, synthesis, utterances, listeners, changes } = harness({ preference: 'true' });
  controller.sync(segment());
  const staleEnd = utterances[0].onend;
  const staleError = utterances[0].onerror;
  const before = synthesis.cancelCount;
  controller.destroy();
  assert.ok(synthesis.cancelCount > before);
  assert.equal(listeners.has('voiceschanged'), false);
  const changeCount = changes.length;
  staleEnd?.();
  staleError?.({ error: 'canceled' });
  controller.sync(segment('kai', 'Late update.'));
  controller.replay();
  assert.equal(utterances.length, 1);
  assert.equal(changes.length, changeCount, 'Late browser events must not update a disposed interface');
});
