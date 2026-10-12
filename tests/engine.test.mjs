import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, HABITATS, createGame, act, serializeGame, parseGame, saveGame, loadGame, SAVE_KEY } from '../dist/engine.js';

const starters = ['creature_statifox', 'creature_algobear', 'creature_terradeer'];
const step = (state, action, rng) => act(state, action, rng).state;
function winRival(starter) {
  let state = step(createGame(), { type: 'CHOOSE_STARTER', speciesId: starter });
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  const before = structuredClone(state);
  state = step(state, { type: 'BATTLE_SCAN' });
  assert.equal(state.battle.turn, before.battle.turn);
  assert.equal(state.party[0].hp, before.party[0].hp);
  assert.equal(state.party[0].focus, before.party[0].focus);
  assert.equal(before.battle.scanned, false, 'actions must not mutate their input');
  for (let turns = 0; state.battle && turns < 12; turns++) {
    const special = SPECIES[starter].moves.find(move => move.kind === 'attack' && move.cost > 0);
    const basic = SPECIES[starter].moves.find(move => move.kind === 'attack' && move.cost === 0);
    state = step(state, { type: 'BATTLE_MOVE', moveId: state.party[0].focus >= special.cost ? special.id : basic.id });
  }
  assert.equal(state.battle, null);
  assert.equal(state.flags.rivalDefeated, true, `${starter} should be able to win the introductory battle`);
  assert.equal(state.party[0].hp, state.party[0].maxHp, 'friendly battle restores health');
  assert.equal(state.party[0].xp, 30);
  return state;
}

for (const starter of starters) test(`complete introductory battle with ${starter}`, () => winRival(starter));

test('all three starters can also win using only the free basic attack', () => {
  for (const starter of starters) {
    let state = step(createGame(), { type: 'CHOOSE_STARTER', speciesId: starter });
    state = step(state, { type: 'START_BATTLE', kind: 'rival' });
    const basic = SPECIES[starter].moves.find(move => move.kind === 'attack' && move.cost === 0);
    for (let turn = 0; state.battle && turn < 20; turn++) state = step(state, { type: 'BATTLE_MOVE', moveId: basic.id });
    assert.equal(state.flags.rivalDefeated, true);
  }
});

test('scan is free once, stores actual actions, and does not claim forecast certainty', () => {
  let state = winRival(starters[0]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_GUARD' });
  const before = serializeGame(state);
  const result = act(state, { type: 'BATTLE_SCAN' });
  assert.equal(result.state.battle.turn, state.battle.turn);
  assert.equal(result.state.dex.species.creature_voltkit.scans, 1);
  assert.match(result.events.join(' '), /do not establish the probability/);
  assert.match(result.events.join(' '), /Lightning Leap/);
  assert.equal(serializeGame(state), before);
  assert.throws(() => act(result.state, { type: 'BATTLE_SCAN' }), /already scanned/);
});

test('weakening and scan recruit Voltkit, party switching works, and crystals can be replenished', () => {
  let state = winRival(starters[1]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  state = step(state, { type: 'BATTLE_BOND' }, () => 0.05);
  assert.equal(state.flags.recruitedVoltkit, true);
  assert.equal(state.party.length, 2);
  assert.equal(state.dex.species.creature_voltkit.recruited, true);
  assert.equal(state.inventory.bondCrystals, 4);
  state = step(state, { type: 'RESTOCK' });
  assert.equal(state.inventory.bondCrystals, 5);
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  state = step(state, { type: 'BATTLE_SWITCH', index: 1 });
  assert.equal(state.battle.activeIndex, 1);
  assert.equal(state.battle.turn, 2);
});

test('patient bonding attempts eventually succeed even with unfavorable randomness', () => {
  let state = winRival(starters[1]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  assert.ok(state.battle.enemy.hp > 0);
  for (let attempt = 0; state.battle && attempt < 5; attempt++) state = step(state, { type: 'BATTLE_BOND' }, () => 0.999);
  assert.equal(state.flags.recruitedVoltkit, true);
});

test('loss heals and returns to the village, and fleeing preserves retryable wild encounter', () => {
  let state = step(createGame(), { type: 'CHOOSE_STARTER', speciesId: starters[0] });
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  for (let i = 0; state.battle && i < 50; i++) state = step(state, { type: 'BATTLE_GUARD' });
  assert.equal(state.battle, null);
  assert.equal(state.flags.rivalDefeated, false);
  assert.equal(state.party[0].hp, state.party[0].maxHp);
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  assert.ok(state.battle);
  state = winRival(starters[2]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_FLEE' });
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  assert.equal(state.battle.kind, 'wild');
});

test('complete six-category investigation, revise incorrect finding, and master concept', () => {
  let state = winRival(starters[2]);
  state = step(state, { type: 'START_INVESTIGATION' });
  assert.throws(() => act(state, { type: 'SUBMIT_FINDING', answer: 'biased' }), /all three habitats/);
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12, facing: 'up' });
  state = step(state, { type: 'REQUEST_HINT' });
  assert.equal(state.quests.nocturnal.hints, 1);
  for (const time of ['night', 'day']) {
    state = step(state, { type: 'SET_TIME', time });
    for (const habitat of HABITATS) state = step(state, { type: 'OBSERVE', habitatId: habitat.id });
  }
  assert.equal(state.quests.nocturnal.status, 'ready');
  assert.equal(state.quests.nocturnal.observations.length, 6);
  assert.throws(() => act(state, { type: 'OBSERVE', habitatId: 'habitat_meadow' }), /already been recorded/);
  state = step(state, { type: 'SUBMIT_FINDING', answer: 'nocturnal' });
  assert.equal(state.quests.nocturnal.status, 'ready');
  state = step(state, { type: 'SUBMIT_FINDING', answer: 'certain' });
  state = step(state, { type: 'REQUEST_HINT' });
  state = step(state, { type: 'SUBMIT_FINDING', answer: 'biased' });
  assert.equal(state.quests.nocturnal.attempts, 3);
  assert.equal(state.quests.nocturnal.status, 'complete');
  assert.equal(state.flags.compass, true);
  assert.equal(state.dex.concepts.concept_sampling_bias, 'understood');
  const points = state.researchPoints;
  state = step(state, { type: 'MASTER_CONCEPT', answer: 'more_night_observations' });
  assert.equal(state.researchPoints, points);
  state = step(state, { type: 'MASTER_CONCEPT', answer: 'representative' });
  assert.equal(state.dex.concepts.concept_sampling_bias, 'mastered');
  assert.equal(state.dex.species.creature_bayowl.seen, true);
  const masteredPoints = state.researchPoints;
  state = step(state, { type: 'MASTER_CONCEPT', answer: 'representative' });
  assert.equal(state.researchPoints, masteredPoints, 'mastery cannot grant duplicate rewards');
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  assert.equal(state.dex.concepts.concept_observation, 'mastered', 'later scans must preserve mastery');
  state = step(state, { type: 'BATTLE_FLEE' });
  assert.deepEqual(parseGame(serializeGame(state)), state);
});

test('save/load roundtrip supports midbattle continuation and missing/corrupted local storage', () => {
  let state = winRival(starters[0]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_GUARD' });
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert.equal(loadGame(storage), null);
  assert.equal(saveGame(state, storage), true);
  const loaded = loadGame(storage);
  assert.deepEqual(loaded, state);
  assert.deepEqual(act(loaded, { type: 'BATTLE_MOVE', moveId: 'observe_strike' }), act(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' }));
  memory.set(SAVE_KEY, '{broken');
  assert.equal(loadGame(storage), null);
  memory.set(SAVE_KEY, '');
  assert.equal(loadGame(storage), null);
  assert.equal(loadGame({ getItem: () => { throw new Error('denied'); } }), null);
});

test('reject malformed, oversized, unsupported, and tampered saves', () => {
  assert.throws(() => parseGame('{bad'), /not valid JSON/);
  assert.throws(() => parseGame('x'.repeat(128 * 1024 + 1)), /128 KB/);
  assert.throws(() => parseGame('null'), /Invalid save/);
  const invalid = change => { const state = createGame(); change(state); return JSON.stringify(state); };
  assert.throws(() => parseGame(invalid(state => { state.schemaVersion = 2; })), /version/);
  assert.throws(() => parseGame(invalid(state => { state.inventory.potions = -1; })), /inventory/);
  assert.throws(() => parseGame(invalid(state => { state.flags.compass = true; })), /Compass/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = '12'; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = 32; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.y = 22; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = 16.5; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.party.push({ speciesId: 'missing' }); })), /creature/);
  assert.throws(() => parseGame(invalid(state => { state.dex.species.creature_voltkit.seen = 'yes'; })), /species entry/);
  assert.throws(() => parseGame(invalid(state => { state.unknown = {}; })), /unexpected/);
  let state = winRival(starters[0]);
  state = step(state, { type: 'START_INVESTIGATION' });
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12, facing: 'up' });
  state = step(state, { type: 'OBSERVE', habitatId: 'habitat_meadow' });
  state.quests.nocturnal.observations[0].sightings[0].count = 99;
  assert.throws(() => parseGame(JSON.stringify(state)), /counts/);
});

test('unknown and unavailable actions have clear errors', () => {
  const state = createGame();
  assert.throws(() => act(state, { type: 'START_BATTLE', kind: 'rival' }), /Choose a starter/);
  assert.throws(() => act(state, { type: 'MOVE', map: 'forest', x: 1, y: 1 }), /Battle Kai/);
  assert.throws(() => act(state, { type: 'MASTER_CONCEPT', answer: 'representative' }), /Finish/);
  assert.throws(() => act(state, { type: 'NOT_AN_ACTION' }), /Unknown game action/);
});
