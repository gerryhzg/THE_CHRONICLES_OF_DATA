import test from 'node:test';
import assert from 'node:assert/strict';
import { HABITATS, SPECIES, createGame, act, serializeGame } from '../dist/engine.js';
import { getQuestGuide, getJourneySteps, getMissingObservations } from '../dist/quests.js';

const step = (state, action, rng) => act(state, action, rng).state;
const travel = (state, map) => step(state, { type: 'MOVE', map, x: 9, y: 12, facing: 'up' });
const chooseStarter = () => step(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' });

function winPractice(state) {
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  const basic = SPECIES[state.starter].moves.find(move => move.kind === 'attack' && move.cost === 0);
  for (let turn = 0; state.battle && turn < 20; turn++) {
    state = step(state, { type: 'BATTLE_MOVE', moveId: basic.id });
  }
  assert.equal(state.flags.rivalDefeated, true);
  return state;
}

function beginFieldwork(state = winPractice(chooseStarter())) {
  return step(travel(state, 'forest'), { type: 'START_INVESTIGATION' });
}

function recordAll(state) {
  for (const time of ['day', 'night']) {
    state = step(state, { type: 'SET_TIME', time });
    for (const habitat of HABITATS) state = step(state, { type: 'OBSERVE', habitatId: habitat.id });
  }
  return state;
}

function readGuide(state) {
  const before = serializeGame(state);
  const result = {
    guide: getQuestGuide(state),
    journey: getJourneySteps(state),
    missing: getMissingObservations(state),
  };
  assert.equal(serializeGame(state), before, 'guidance must not mutate saved progress');
  return result;
}

function assertJourney(journey, completedCount) {
  assert.equal(journey.length, 6);
  assert.deepEqual(journey.map(step => step.done), journey.map((_, index) => index < completedCount));
  assert.deepEqual(journey.map(step => step.current), journey.map((_, index) => index === completedCount));
}

test('main journey destinations follow actual progress through the village report', () => {
  let state = createGame();
  let view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.map, view.guide.targetId], ['first-bond', 'village', 'lab']);
  assertJourney(view.journey, 0);

  state = chooseStarter();
  view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.map, view.guide.targetId], ['first-bond', 'village', 'kai']);
  assertJourney(view.journey, 1);

  state = winPractice(state);
  view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.map, view.guide.targetId], ['nocturnal', 'forest', 'inferra']);
  assertJourney(view.journey, 2);

  state = beginFieldwork(state);
  view = readGuide(state);
  assert.deepEqual([view.guide.map, view.guide.targetId], ['forest', 'meadow']);
  assert.equal(view.missing.length, 6);
  assert.match(view.guide.count, /0 \/ 6/);
  assertJourney(view.journey, 3);

  state = recordAll(state);
  view = readGuide(state);
  assert.equal(state.quests.nocturnal.status, 'ready');
  assert.deepEqual([view.guide.map, view.guide.targetId], ['forest', 'inferra']);
  assert.equal(view.missing.length, 0);
  assert.match(view.guide.count, /6 \/ 6/);
  assertJourney(view.journey, 4);

  state = step(state, { type: 'SUBMIT_FINDING', answer: 'biased' });
  view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.map, view.guide.targetId], ['field-report', 'village', 'lab']);
  assertJourney(view.journey, 5);

  state = step(travel(state, 'village'), { type: 'REPORT_FINDINGS' });
  view = readGuide(state);
  assert.equal(state.flags.recruitedVoltkit, false);
  assert.equal(state.dex.concepts.concept_sampling_bias, 'understood');
  assert.deepEqual([view.guide.id, view.guide.progress, view.guide.targetId], ['stage-one-complete', 100, null]);
  assertJourney(view.journey, 6);
});

test('fieldwork guidance chooses missing categories at the current time before directing players to camp', () => {
  let state = beginFieldwork();
  let view = readGuide(state);
  const allCategories = HABITATS.flatMap(habitat => ['day', 'night'].map(time => `${habitat.id}:${time}`));
  assert.deepEqual(view.missing.map(row => `${row.habitatId}:${row.time}`).sort(), allCategories.sort());

  for (const [index, habitat] of HABITATS.entries()) {
    view = readGuide(state);
    assert.equal(view.guide.targetId, habitat.id.replace('habitat_', ''));
    assert.equal(view.missing.find(row => row.time === state.time).habitatId, habitat.id);
    state = step(state, { type: 'OBSERVE', habitatId: habitat.id });
    view = readGuide(state);
    assert.equal(view.missing.length, 5 - index);
    assert.match(view.guide.count, new RegExp(`${index + 1} / 6`));
    assert.equal(view.missing.some(row => row.habitatId === habitat.id && row.time === 'day'), false);
    assert.equal(view.missing.some(row => row.habitatId === habitat.id && row.time === 'night'), true);
  }

  assert.deepEqual([view.guide.map, view.guide.targetId], ['forest', 'camp']);
  assert.equal(view.missing.every(row => row.time === 'night'), true);
  assertJourney(view.journey, 3);

  state = step(state, { type: 'SET_TIME', time: 'night' });
  view = readGuide(state);
  assert.equal(view.guide.targetId, 'meadow');
  assert.equal(state.quests.nocturnal.observations.length, 3, 'changing time preserves earlier records');
  state = step(state, { type: 'OBSERVE', habitatId: HABITATS[0].id });
  view = readGuide(state);
  assert.equal(view.guide.targetId, 'riverbank');
  assert.equal(view.missing.length, 2);
  assert.match(view.guide.count, /4 \/ 6/);
});

test('optional recruitment and mastery do not skip the active main objective', () => {
  let state = winPractice(chooseStarter());
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  state = step(state, { type: 'BATTLE_BOND' }, () => 0);
  assert.equal(state.flags.recruitedVoltkit, true);
  let view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.targetId], ['nocturnal', 'inferra']);
  assertJourney(view.journey, 2);

  state = beginFieldwork(state);
  state = recordAll(state);
  state = step(state, { type: 'SUBMIT_FINDING', answer: 'biased' });
  state = step(state, { type: 'MASTER_CONCEPT', answer: 'representative' });
  assert.equal(state.dex.concepts.concept_sampling_bias, 'mastered');
  view = readGuide(state);
  assert.deepEqual([view.guide.id, view.guide.map, view.guide.targetId], ['field-report', 'village', 'lab']);
  assertJourney(view.journey, 5);

  state = step(travel(state, 'village'), { type: 'REPORT_FINDINGS' });
  view = readGuide(state);
  assert.equal(view.guide.id, 'stage-one-complete');
  assertJourney(view.journey, 6);
});
