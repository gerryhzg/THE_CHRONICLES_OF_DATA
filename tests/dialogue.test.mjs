import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversation, createDialogue, currentSegment, advanceDialogue, previousDialogue, isDialogueComplete } from '../dist/dialogue.js';

test('dialogue begins on one segment and advances only when the player requests it', () => {
  const conversation = getConversation('inferra');
  const first = createDialogue(conversation);
  assert.equal(currentSegment(first).speaker, 'ranger');
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
