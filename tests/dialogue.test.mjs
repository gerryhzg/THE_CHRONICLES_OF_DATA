import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversation, createDialogue, currentSegment, advanceDialogue, previousDialogue, isDialogueComplete } from '../dist/dialogue.js';
import { SPEAKERS, portraitMarkup } from '../dist/portraits.js';

test('dialogue begins on one segment and advances only when the player requests it', () => {
  const conversation = getConversation('inferra');
  const first = createDialogue(conversation);
  assert.equal(currentSegment(first).speaker, 'inferra');
  assert.equal(isDialogueComplete(first), false);
  const second = advanceDialogue(first);
  assert.equal(second.index, 1);
  assert.equal(first.index, 0, 'advancing must not mutate the old dialogue');
  assert.equal(second.conversation, conversation, 'advancing must preserve the conversation');

  let dialogue = second;
  for (let i = 1; i < conversation.segments.length; i++) dialogue = advanceDialogue(dialogue);
  assert.equal(isDialogueComplete(dialogue), true);
  assert.equal(currentSegment(dialogue), conversation.segments.at(-1));
  assert.equal(advanceDialogue(dialogue).index, dialogue.index, 'advance stays on the last readable segment');
  const revisited = previousDialogue(dialogue);
  assert.equal(revisited.index, dialogue.index - 1);
  assert.equal(isDialogueComplete(revisited), false);
  assert.equal(previousDialogue(first).index, 0, 'previous stays on the first segment');
});

test('single-segment conversations work and unreadable conversations fail clearly', () => {
  const dialogue = createDialogue({ segments: [{ speaker: 'lyra', expression: 'neutral', text: 'Welcome.' }] });
  assert.equal(isDialogueComplete(dialogue), true);
  assert.equal(advanceDialogue(dialogue).index, 0);
  assert.throws(() => createDialogue({ segments: [] }), /at least one/);
  assert.throws(() => createDialogue({ segments: [{ speaker: 'lyra', expression: 'happy', text: ' ' }] }), /readable text/);
  assert.throws(() => getConversation('missing'), /Unknown conversation: missing/);
});

test('conversations adapt to progression and keep names as plain text for the renderer', () => {
  const context = { playerName: '<Observer>', starterName: 'Statifox', rivalDefeated: false };
  const before = getConversation('lyra', context);
  const after = getConversation('lyra', { ...context, rivalDefeated: true });
  assert.ok(before.segments[0].text.includes('<Observer>'));
  assert.ok(before.segments[0].text.includes('Statifox'));
  assert.ok(before.segments.some(segment => segment.text.includes('Kai is waiting')));
  assert.ok(after.segments.some(segment => segment.text.includes('Professor Inferra')));
  assert.equal(context.rivalDefeated, false);
  assert.notEqual(before.segments, getConversation('lyra', context).segments, 'new conversations must not share mutable content');
});

test('encounter dialogue distinguishes recruitment, victory, defeat, and retreat', () => {
  const recruited = getConversation('battle-result', { kind: 'wild', recruited: true });
  const fled = getConversation('battle-result', { kind: 'wild', events: ['You step away safely. The wild encounter can be tried again.'] });
  const wildDefeated = getConversation('battle-result', { kind: 'wild', events: ['Voltkit slipped back into the grass. Another encounter is always available.'] });
  const rivalWon = getConversation('battle-result', { kind: 'rival', won: true });
  const lost = getConversation('battle-result', { kind: 'rival', won: false });
  assert.match(recruited.segments[0].text, /joins your team/);
  assert.match(fled.segments[0].text, /step away safely/);
  assert.match(wildDefeated.segments[0].text, /slips back/);
  assert.equal(rivalWon.segments[0].speaker, 'kai');
  assert.ok(lost.segments.some(segment => segment.text.includes('sanctuary')));
});

test('Inferra opens every investigation stage with her portrait and relevant guidance', () => {
  for (const questStatus of ['locked', 'active', 'ready', 'complete']) {
    const context = { questStatus, observationCount: questStatus === 'active' ? 2 : 6, playerName: 'Mira', mastered: false };
    const original = structuredClone(context);
    const conversation = getConversation('inferra', context);
    assert.equal(conversation.id, 'inferra', 'progression keeps a stable conversation ID');
    assert.equal(conversation.segments[0].speaker, 'inferra', `${questStatus} must open with Inferra`);
    assert.ok(conversation.segments[0].text.includes('Mira'));
    assert.deepEqual(context, original, 'reading dialogue must not update quest progression');
    if (questStatus !== 'locked') assert.equal(conversation.segments.length, 3);
    for (const segment of conversation.segments) {
      assert.ok(SPEAKERS[segment.speaker].expressions.includes(segment.expression));
      assert.ok(portraitMarkup(segment.speaker, segment.expression).includes(SPEAKERS[segment.speaker].name));
    }
  }
  const opening = getConversation('inferra', { questStatus: 'locked' });
  assert.equal(opening.segments[1].speaker, 'ranger', 'the original ranger claim follows Inferra\'s introduction');
  assert.ok(opening.segments.some(segment => /18 Bayowl and 12 Samplet/.test(segment.text)));
  const active = getConversation('inferra', { questStatus: 'active', observationCount: 2 });
  assert.match(active.segments[0].text, /2 of the six/);
  assert.match(active.segments[1].text, /meadow, riverbank, and canopy.*daylight and moonlight/);
  const ready = getConversation('inferra', { questStatus: 'ready', observationCount: 6 });
  assert.match(ready.segments[0].text, /all six/);
  assert.match(ready.segments.at(-1).text, /uncertainty/);
  const complete = getConversation('inferra', { questStatus: 'complete' });
  assert.match(complete.segments[0].text, /Sampling Compass/);
  assert.match(complete.segments[1].text, /cannot prove how every creature/);
  const mastered = getConversation('inferra', { questStatus: 'complete', mastered: true });
  assert.equal(mastered.segments.length, 4);
  assert.equal(mastered.segments.at(-1).expression, 'happy');
  assert.match(mastered.segments.at(-1).text, /mastery/);
});

test('Inferra states the actual recorded observation count when revisited during fieldwork', () => {
  for (let observationCount = 0; observationCount <= 6; observationCount++) {
    const conversation = getConversation('inferra', { questStatus: 'active', observationCount });
    assert.ok(conversation.segments[0].text.includes(`${observationCount} of the six`));
  }
});

test('Inferra hints progress from a nudge to a guided explanation and clamp their level', () => {
  const hints = [1, 2, 3].map(hintLevel => getConversation('inferra-hint', { hintLevel }));
  assert.match(hints[0].segments[1].text, /missing/);
  assert.match(hints[1].segments[0].text, /Compare the same habitat/);
  assert.match(hints[2].segments[1].text, /cannot establish/);
  assert.deepEqual(getConversation('inferra-hint', { hintLevel: 100 }).segments, hints[2].segments);
  assert.deepEqual(getConversation('inferra-hint', { hintLevel: 0 }).segments, hints[0].segments);
  for (const hint of hints) assert.equal(hint.segments.length, 2);
});

test('Inferra feedback explains each misconception and uses supported portrait expressions', () => {
  const nocturnal = getConversation('inferra-finding-feedback', { answer: 'nocturnal' });
  const certain = getConversation('inferra-finding-feedback', { answer: 'certain' });
  const mastered = getConversation('inferra-mastery-feedback', { mastered: true });
  const retry = getConversation('inferra-mastery-feedback', { mastered: false });
  assert.match(nocturnal.segments[0].text, /daytime records/);
  assert.match(nocturnal.segments[1].text, /revise your finding/);
  assert.match(certain.segments[1].text, /do not establish certainty/);
  assert.equal(mastered.segments.length, 3);
  assert.match(mastered.segments[2].text, /DataDex.*mastery/);
  assert.ok(mastered.segments.every(segment => segment.expression === 'happy'));
  assert.equal(retry.segments.length, 2);
  assert.match(retry.segments[0].text, /larger sample does not fix sampling bias/);
  assert.match(retry.segments[1].text, /habitats.*daylight and moonlight/);
  for (const conversation of [nocturnal, certain, mastered, retry, getConversation('inferra-hint')]) {
    assert.equal(conversation.segments[0].speaker, 'inferra');
    for (const segment of conversation.segments) {
      assert.equal(segment.speaker, 'inferra');
      assert.ok(SPEAKERS.inferra.expressions.includes(segment.expression));
      assert.match(portraitMarkup(segment.speaker, segment.expression), /Professor Inferra/);
    }
  }
  for (const conversation of [nocturnal, certain, retry]) {
    assert.equal(conversation.segments.length, 2);
    assert.ok(conversation.segments.every(segment => segment.expression === 'thoughtful'));
  }
});
