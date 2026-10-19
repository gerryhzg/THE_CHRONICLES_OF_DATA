import test from 'node:test';
import assert from 'node:assert/strict';
import { HABITATS, SPECIES, createGame as createAct1Game, act, serializeGame } from '../dist/engine.js';
import { createLegacyGame as createGame } from './fixtures.mjs';
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

test('Act I guidance follows field actions, comparison, demonstrations, and council', () => {
  let state = createAct1Game();
  const view = () => readGuide(state);
  assert.equal(view().guide.id, 'rainfall-records');
  assert.equal(view().journey.length, 13);
  assert.equal(view().journey[0].current, true);
  state = step(state, {type:'ACT1_INTRO_COMPLETE'});
  assert.match(view().guide.text, /Visit Professor Lyra/);
  state = step(state, {type:'ACT1_START'});
  assert.equal(view().guide.targetId, 'farm');
  state = step(state, {type:'ACT1_FIELD_ACTION',id:'farm_crate'});
  assert.match(view().guide.hint, /crate has been moved.*Pick up/);
  state = step(state, {type:'ACT1_COLLECT_RECORD',id:'farm'});
  assert.equal(view().guide.targetId, 'river');
  state = step(state, {type:'ACT1_FIELD_ACTION',id:'river_reeds'});
  assert.match(view().guide.hint, /located.*Retrieve/);
  state = step(state, {type:'ACT1_COLLECT_RECORD',id:'river'});
  assert.equal(view().guide.targetId, 'shop');
  for (const id of ['shop_tower','shop_box','shop_receipt']) state = step(state, {type:'ACT1_FIELD_ACTION',id});
  assert.match(view().guide.hint, /All three objects have been inspected/);
  state = step(state, {type:'ACT1_COLLECT_RECORD',id:'shop'});
  assert.equal(view().guide.targetId, 'tower');
  assert.match(view().guide.count, /0 \/ 3 record pairs/);
  for (const id of ['shop','farm','river']) state = step(state, {type:'ACT1_COMPARE_RECORD',id});
  assert.match(view().guide.hint, /All three discrepancies are marked/);
  state = step(state, {type:'ACT1_COMPLETE_COMPARISON'});
  assert.match(view().guide.completeWhen, /activate the DataDex/);
  state = step(state, {type:'ACT1_RECEIVE_DEX'});
  assert.deepEqual([view().guide.id,view().guide.targetId], ['first-bond','lab']);
  for (const id of ['creature_terradeer','creature_statifox','creature_algobear']) state = step(state, {type:'ACT1_DEMO',id});
  assert.match(view().guide.completeWhen, /Choose one starter/);
  state = step(state, {type:'CHOOSE_STARTER',speciesId:'creature_terradeer'});
  assert.equal(view().guide.targetId, 'kai');
  assert.match(view().guide.text, /Attack, Guard.*Scan.*Switch.*Cloudfin/);
  state = step(state, {type:'START_BATTLE',kind:'rival'});
  state = step(state, {type:'BATTLE_MOVE',moveId:'observe_strike'});
  state = step(state, {type:'BATTLE_GUARD'});
  state = step(state, {type:'BATTLE_SCAN'});
  state = step(state, {type:'BATTLE_SWITCH',index:1});
  for (let turn = 0; state.battle && turn < 30; turn++) {
    state = step(state, {type:'BATTLE_MOVE',moveId:'observe_strike'});
  }
  assert.equal(state.flags.rivalDefeated, true);
  assert.deepEqual([view().guide.id,view().guide.targetId], ['village-council','rowan']);
  state = step(state, {type:'ACT1_COUNCIL_COMPLETE'});
  assert.deepEqual([view().guide.id,view().guide.targetId], ['act-one-complete','gate']);
  assert.match(view().guide.text, /northern village road/);
  state = travel(state, 'forest');
  assert.deepEqual([view().guide.id,view().guide.targetId], ['nocturnal','inferra']);
  assert.equal(view().journey.filter(row => row.done).length, 9);
});

test('Act I collection hints ignore recovered records and optional discoveries', () => {
  let state = step(step(createAct1Game(), {type:'ACT1_INTRO_COMPLETE'}), {type:'ACT1_START'});
  for (const id of ['shop_box','shop_receipt','shop_tower']) state = step(state, {type:'ACT1_FIELD_ACTION',id});
  state = step(state, {type:'ACT1_COLLECT_RECORD',id:'shop'});
  state = step(state, {type:'ACT1_SIDE_ACTION',id:'old_journal'});
  const {guide,journey} = readGuide(state);
  assert.equal(guide.targetId, 'farm');
  assert.match(guide.count, /1 \/ 3/);
  assert.doesNotMatch(guide.hint, /shop|journal/i);
  assert.equal(journey.filter(row => row.done).length, 2);
});
