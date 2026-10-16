import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversation, createDialogue, currentSegment, advanceDialogue, previousDialogue, isDialogueComplete } from '../dist/dialogue.js';
import { SPEAKERS, portraitMarkup } from '../dist/portraits.js';

const textOf = conversation => conversation.segments.map(segment => segment.text).join(' ');

function assertReadableConversation(conversation) {
  for (const key of ['id', 'title', 'subtitle', 'endLabel']) {
    assert.ok(typeof conversation[key] === 'string' && conversation[key].trim(), `${key} must be readable`);
  }
  assert.doesNotThrow(() => createDialogue(conversation));
  for (const segment of conversation.segments) {
    const speaker = SPEAKERS[segment.speaker];
    assert.ok(speaker, `Unknown speaker ${segment.speaker} in ${conversation.id}`);
    assert.ok(speaker.expressions.includes(segment.expression), `${segment.speaker} cannot show ${segment.expression}`);
    assert.ok(portraitMarkup(segment.speaker, segment.expression).includes(speaker.name));
    assert.doesNotMatch(segment.text, /\b(?:undefined|NaN)\b/, 'Missing context must not leak into dialogue');
  }
}

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
  assert.ok(textOf(before).includes('<Observer>'));
  assert.ok(textOf(before).includes('Statifox'));
  assert.match(textOf(before), /Kai.*square/);
  assert.match(textOf(after), /eastern road.*Professor Inferra.*forest/);
  assert.notDeepEqual(before.segments, after.segments, 'Lyra must give directions for the current progression');
  assert.equal(context.rivalDefeated, false);
  assert.notEqual(before.segments, getConversation('lyra', context).segments, 'new conversations must not share mutable content');

  const firstMatch = getConversation('rival', context);
  const rematch = getConversation('rival', { ...context, rivalDefeated: true });
  assert.ok(textOf(firstMatch).includes('<Observer>'));
  assert.ok(textOf(firstMatch).includes('Statifox'));
  assert.notDeepEqual(firstMatch.segments, rematch.segments);
  const daylight = getConversation('camp', { time: 'night' });
  const moonlight = getConversation('camp', { time: 'day' });
  assert.match(textOf(daylight), /daylight|sun/);
  assert.match(textOf(moonlight), /moonlight|dark/);
  assert.notDeepEqual(daylight.segments, moonlight.segments);
});

test('encounter dialogue distinguishes recruitment, victory, defeat, and retreat', () => {
  const recruited = getConversation('battle-result', { kind: 'wild', recruited: true });
  const fled = getConversation('battle-result', { kind: 'wild', events: ['You step away safely. The wild encounter can be tried again.'] });
  const wildDefeated = getConversation('battle-result', { kind: 'wild', events: ['Voltkit slipped back into the grass. Another encounter is always available.'] });
  const rivalWon = getConversation('battle-result', { kind: 'rival', won: true });
  const lost = getConversation('battle-result', { kind: 'rival', won: false });
  assert.match(textOf(recruited), /Voltkit.*(?:joins|team)/);
  assert.match(textOf(recruited), /DataDex.*bonded/);
  assert.match(textOf(fled), /step away safely/);
  assert.match(textOf(wildDefeated), /Voltkit.*grass/);
  assert.match(textOf(wildDefeated), /another encounter|return|try again/);
  assert.equal(rivalWon.segments[0].speaker, 'kai');
  assert.match(textOf(rivalWon), /eastern road.*Professor Inferra/);
  assert.match(textOf(lost), /sanctuary/);
  assert.match(textOf(lost), /health|well again/);
  assert.match(textOf(lost), /try again/);
  assert.equal(new Set([recruited, fled, wildDefeated, rivalWon, lost].map(textOf)).size, 5, 'Every encounter outcome needs distinct dialogue');
  assert.deepEqual(getConversation('battle-result', { kind: 'wild', won: true }).segments, wildDefeated.segments);
});

test('Inferra opens every investigation stage with her portrait and relevant guidance', () => {
  for (const questStatus of ['locked', 'active', 'ready', 'complete']) {
    const context = { questStatus, observationCount: questStatus === 'active' ? 2 : 6, playerName: 'Mira', mastered: false };
    const original = structuredClone(context);
    const conversation = getConversation('inferra', context);
    assert.equal(conversation.id, 'inferra', 'progression keeps a stable conversation ID');
    assert.equal(conversation.segments[0].speaker, 'inferra', `${questStatus} must open with Inferra`);
    assert.ok(textOf(conversation).includes('Mira'));
    assert.deepEqual(context, original, 'reading dialogue must not update quest progression');
    assertReadableConversation(conversation);
  }
  const opening = getConversation('inferra', { questStatus: 'locked' });
  const rangerClaim = opening.segments.filter(segment => segment.speaker === 'ranger').map(segment => segment.text).join(' ');
  assert.match(rangerClaim, /nearly every.*nocturnal/i);
  assert.match(rangerClaim, /18\s+Bayowl/);
  assert.match(rangerClaim, /12\s+Samplet/);
  assert.match(rangerClaim, /canopy.*night/);
  for (const habitat of ['meadow', 'riverbank', 'canopy']) assert.ok(textOf(opening).includes(habitat));
  assert.match(textOf(opening), /daylight.*moonlight/);
  assert.match(textOf(opening), /six records|six observations|six combinations/i);
  assert.match(textOf(opening), /campfire.*change the time/);
  assert.match(textOf(opening), /DataDex/);
  const active = getConversation('inferra', { questStatus: 'active', observationCount: 2 });
  assert.match(textOf(active), /meadow, riverbank, and canopy.*daylight and moonlight/);
  assert.match(textOf(active), /campfire.*change the time/);
  const ready = getConversation('inferra', { questStatus: 'ready', observationCount: 6 });
  assert.match(textOf(ready), /all six/);
  assert.match(textOf(ready), /daylight.*moonlight.*canopy/);
  assert.match(textOf(ready), /uncertain|unsure/);
  const complete = getConversation('inferra', { questStatus: 'complete' });
  assert.match(textOf(complete), /Sampling Compass/);
  assert.match(textOf(complete), /(?:cannot|can't).*every creature/);
  assert.match(textOf(complete), /evidence.*(?:change|revise)/i);
  const mastered = getConversation('inferra', { questStatus: 'complete', mastered: true });
  assert.notDeepEqual(mastered.segments, complete.segments, 'Mastery must be acknowledged on later visits');
  assert.match(textOf(mastered), /DataDex.*mastery/);
});

test('Inferra states the actual recorded observation count when revisited during fieldwork', () => {
  const variants = [];
  for (let observationCount = 0; observationCount <= 6; observationCount++) {
    const conversation = getConversation('inferra', { questStatus: 'active', observationCount });
    assert.ok(textOf(conversation).includes(`${observationCount} of the six`));
    variants.push(textOf(conversation));
  }
  assert.equal(new Set(variants).size, 7, 'Each observation count must generate its own progress report');
});

test('Inferra hints progress from a nudge to a guided explanation and clamp their level', () => {
  const hints = [1, 2, 3].map(hintLevel => getConversation('inferra-hint', { hintLevel }));
  assert.match(textOf(hints[0]), /missing/);
  assert.match(textOf(hints[1]), /same habitat.*daylight and moonlight/);
  assert.match(textOf(hints[2]), /night-only.*cannot establish.*nearly every/);
  assert.equal(new Set(hints.map(textOf)).size, 3, 'Hints must offer progressively different guidance');
  assert.deepEqual(getConversation('inferra-hint', { hintLevel: 100 }).segments, hints[2].segments);
  assert.deepEqual(getConversation('inferra-hint', { hintLevel: 0 }).segments, hints[0].segments);
  for (const hint of hints) {
    assert.equal(hint.segments[0].speaker, 'inferra');
    assert.equal(hint.segments[0].expression, 'thoughtful');
    assertReadableConversation(hint);
  }
});

test('Inferra feedback explains each misconception and uses supported portrait expressions', () => {
  const nocturnal = getConversation('inferra-finding-feedback', { answer: 'nocturnal' });
  const certain = getConversation('inferra-finding-feedback', { answer: 'certain' });
  const mastered = getConversation('inferra-mastery-feedback', { mastered: true });
  const retry = getConversation('inferra-mastery-feedback', { mastered: false });
  assert.match(textOf(nocturnal), /daytime records/);
  assert.match(textOf(nocturnal), /night-only.*(?:miss|leave)/);
  assert.match(textOf(certain), /not certainty.*every creature or future sighting/);
  assert.notDeepEqual(nocturnal.segments, certain.segments, 'Different misconceptions need different explanations');
  assert.match(textOf(mastered), /DataDex/);
  assert.match(textOf(mastered), /mastery/i);
  assert.match(textOf(mastered), /consistent.*(?:method|count)/);
  assert.equal(mastered.segments[0].expression, 'happy');
  assert.match(textOf(retry), /(?:larger|bigger|more).*sample/i);
  assert.match(textOf(retry), /leave out|blind spot|bias/);
  assert.match(textOf(retry), /habitats.*daylight and moonlight/);
  assert.match(textOf(retry), /consistent observation method/);
  assert.equal(retry.segments[0].expression, 'thoughtful');
  for (const conversation of [nocturnal, certain, mastered, retry, getConversation('inferra-hint')]) {
    assert.equal(conversation.segments[0].speaker, 'inferra');
    assertReadableConversation(conversation);
  }
});

test('Inferra hints use missing field records and switch to comparison once collection is ready', () => {
  const missingObservations = ['Riverbank · moonlight'];
  const remaining = getConversation('inferra-hint', {questStatus:'active', hintLevel:2, missingObservations});
  assert.ok(textOf(remaining).includes(missingObservations[0]), 'Field guidance must identify the actual missing category');
  const camp = getConversation('inferra-hint', {questStatus:'active', hintLevel:3, missingObservations, hintTarget:'camp'});
  assert.match(textOf(camp), /campfire/i);
  const record = getConversation('inferra-hint', {questStatus:'active', hintLevel:3, missingObservations, hintTarget:'riverbank', time:'night'});
  assert.ok(textOf(record).includes(missingObservations[0]));
  assert.match(textOf(record), /Record in DataDex/);
  const ready = getConversation('inferra-hint', {questStatus:'ready', hintLevel:1, missingObservations:[]});
  assert.match(textOf(ready), /six/i);
  assert.match(textOf(ready), /compar/i);
  assert.notDeepEqual(ready.segments, getConversation('inferra-hint', {questStatus:'active', hintLevel:1}).segments);
  for (const conversation of [remaining, camp, record, ready]) assertReadableConversation(conversation);
});

test('story and battle guidance preserve evidence and the playable mechanics', () => {
  const forecast = textOf(getConversation('tower'));
  assert.match(forecast, /0\s*mm/);
  assert.match(forecast, /46\s*mm/);
  assert.match(forecast, /gauge|measured/);
  const rival = textOf(getConversation('rival'));
  assert.match(rival, /Guard/);
  assert.match(rival, /Focus/);
  assert.match(rival, /less damage|reduce damage/);
  assert.match(rival, /one free scan.*no turn/i);
  assert.match(rival, /moves.*(?:already|past).*not.*next/);
  const wild = textOf(getConversation('wild'));
  assert.match(wild, /scan.*HP.*Bond Crystal/i);
  assert.match(wild, /avoid defeating|do not defeat|don't defeat/i);
  assert.match(wild, /try again/);
  const complete = textOf(getConversation('complete'));
  assert.match(complete, /sampling bias/i);
  assert.match(complete, /habitat.*time/);
  assert.match(complete, /(?:haven't|have not|not).*every creature.*(?:tomorrow|future).*(?:could|might|uncertain|surprise)/i);
  assert.match(complete, /Sampling Compass/);
});

test('all conversation branches contain readable segments and supported speaker portraits', () => {
  const cases = [
    ['starters'], ['lyra'], ['lyra', { rivalDefeated: true }], ['lyra', {reportedToLyra:true}], ['lyra-report'], ['report-complete'],
    ['rival'], ['rival', { rivalDefeated: true }], ['kai-before-starter'],
    ['gate-locked'], ['sanctuary'], ['tower'], ['inferra'],
    ...['locked', 'active', 'ready', 'complete'].map(questStatus => ['inferra', { questStatus, observationCount: 2 }]),
    ['inferra', { questStatus: 'complete', mastered: true }],
    ...[1, 2, 3].map(hintLevel => ['inferra-hint', { hintLevel }]),
    ['inferra-finding-feedback', { answer: 'nocturnal' }], ['inferra-finding-feedback', { answer: 'certain' }],
    ['inferra-mastery-feedback', { mastered: false }], ['inferra-mastery-feedback', { mastered: true }],
    ['complete'], ['mastery'], ['wild'], ['wild', { recruited: true }],
    ['camp', { time: 'day' }], ['camp', { time: 'night' }],
    ['battle-result', { kind: 'wild', recruited: true }],
    ['battle-result', { kind: 'wild', events: ['You step away safely.'] }],
    ['battle-result', { kind: 'wild', events: ['Voltkit slipped back into the grass.'] }],
    ['battle-result', { kind: 'wild', won: true }], ['battle-result', { kind: 'wild', won: false }],
    ['battle-result', { kind: 'rival', won: true }], ['battle-result', { kind: 'rival', won: false }],
  ];
  for (const [id, extra = {}] of cases) {
    const context = { playerName: 'Mira', starterName: 'Statifox', ...extra };
    const original = structuredClone(context);
    const conversation = getConversation(id, context);
    assert.equal(conversation.id, id);
    assertReadableConversation(conversation);
    assert.deepEqual(context, original, `Reading ${id} must not change its context`);
    if (['inferra', 'inferra-hint', 'inferra-finding-feedback', 'inferra-mastery-feedback', 'complete', 'mastery'].includes(id)) {
      assert.equal(conversation.segments[0].speaker, 'inferra');
    }
  }
  assert.ok(getConversation('starters').segments.length >= 3, 'Starter dialogue must support the full keyboard walkthrough');
  assert.ok(getConversation('inferra').segments.length >= 4, 'Inferra introduction must support the full keyboard walkthrough');
});
