import { createLegacyGame as createGame } from './fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, HABITATS, act, serializeGame, parseGame, saveGame, loadGame, SAVE_KEY } from '../dist/engine.js';

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
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12, facing: 'up' });
  state = step(state, { type: 'START_INVESTIGATION' });
  assert.throws(() => act(state, { type: 'SUBMIT_FINDING', answer: 'biased' }), /all three habitats/);
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

test('begin investigation at Inferra, finish evidence, then deliver the village report once', () => {
  let state = createGame();
  assert.throws(() => act(state, { type: 'REPORT_FINDINGS' }), /Finish the Nocturnal Mystery/);
  state = winRival(starters[0]);
  assert.throws(() => act(state, { type: 'START_INVESTIGATION' }), /Meet Professor Inferra/);
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12, facing: 'up' });
  state = step(state, { type: 'START_INVESTIGATION' });
  const hint = act(state, { type: 'REQUEST_HINT' });
  state = hint.state;
  assert.equal(state.quests.nocturnal.hints, 1, 'hints are available before the first observation');
  assert.match(hint.events.join(' '), /Sunlit Meadow \(day\)/);
  for (const time of ['day', 'night']) {
    state = step(state, { type: 'SET_TIME', time });
    for (const habitat of HABITATS) state = step(state, { type: 'OBSERVE', habitatId: habitat.id });
  }
  state = step(state, { type: 'SUBMIT_FINDING', answer: 'biased' });
  assert.equal(state.flags.reportedToLyra, false, 'finding confirmation still leaves the village report to deliver');
  assert.throws(() => act(state, { type: 'REPORT_FINDINGS' }), /Harvest Village/);
  state = step(state, { type: 'MOVE', map: 'village', x: 16, y: 13, facing: 'up' });
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  assert.throws(() => act(state, { type: 'REPORT_FINDINGS' }), /Finish or flee the battle/);
  for (let turns = 0; state.battle && turns < 12; turns++) {
    state = step(state, { type: 'BATTLE_MOVE', moveId: state.party[0].focus >= 2 ? 'pattern_pulse' : 'observe_strike' });
  }
  assert.equal(state.battle, null);
  const before = serializeGame(state);
  const legacyComplete = JSON.parse(before);
  delete legacyComplete.flags.reportedToLyra;
  assert.deepEqual(parseGame(JSON.stringify(legacyComplete)), state, 'older completed investigations still offer the new report');
  const result = act(state, { type: 'REPORT_FINDINGS' });
  assert.equal(serializeGame(state), before, 'reporting must not mutate its input');
  assert.equal(result.state.flags.reportedToLyra, true);
  assert.equal(result.state.coins, state.coins);
  assert.equal(result.state.researchPoints, state.researchPoints);
  assert.match(result.events.join(' '), /Stage 1 main story is complete/);
  assert.throws(() => act(result.state, { type: 'REPORT_FINDINGS' }), /already reported/);
  assert.deepEqual(parseGame(serializeGame(result.state)), result.state, 'delivered report survives save/load');
  assert.equal(result.state.flags.recruitedVoltkit, false, 'recruitment is not a main story gate');
  assert.equal(result.state.dex.concepts.concept_sampling_bias, 'understood', 'mastery is not a main story gate');
  state = step(result.state, { type: 'MASTER_CONCEPT', answer: 'representative' });
  assert.equal(state.dex.concepts.concept_sampling_bias, 'mastered', 'optional reflection remains available after reporting');
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_BOND' }, () => 0);
  assert.equal(state.flags.recruitedVoltkit, true, 'optional recruitment remains available after reporting');
  assert.equal(state.flags.reportedToLyra, true);
});

test('exact legacy v1 saves migrate the report flag and preserve active battles', () => {
  let state = winRival(starters[1]);
  state = step(state, { type: 'START_BATTLE', kind: 'wild' });
  state = step(state, { type: 'BATTLE_SCAN' });
  state = step(state, { type: 'BATTLE_GUARD' });
  const legacy = structuredClone(state);
  delete legacy.flags.reportedToLyra;
  const originalJson = JSON.stringify(legacy);
  const migrated = parseGame(originalJson);
  assert.equal(migrated.flags.reportedToLyra, false);
  assert.deepEqual(migrated, state);
  assert.equal(JSON.stringify(legacy), originalJson, 'migration leaves the supplied legacy record untouched');
  assert.deepEqual(act(migrated, { type: 'BATTLE_MOVE', moveId: 'observe_strike' }), act(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' }));
  const invalid = change => { const value = structuredClone(legacy); change(value); return JSON.stringify(value); };
  assert.throws(() => parseGame(invalid(value => { value.flags.extra = false; })), /flags/);
  assert.throws(() => parseGame(invalid(value => { delete value.flags.introSeen; })), /flags/);
  assert.throws(() => parseGame(invalid(value => { value.flags.compass = 'false'; })), /flags/);
  assert.throws(() => parseGame(invalid(value => { value.extra = false; })), /unexpected/);
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
  assert.throws(() => parseGame(invalid(state => { state.flags.reportedToLyra = true; })), /before the investigation/);
  assert.throws(() => parseGame(invalid(state => { state.flags.reportedToLyra = 'true'; })), /flags/);
  assert.throws(() => parseGame(invalid(state => { state.flags.extra = false; })), /flags/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = '12'; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = 32; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.y = 22; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.player.x = 16.5; })), /position/);
  assert.throws(() => parseGame(invalid(state => { state.party.push({ speciesId: 'missing' }); })), /creature/);
  assert.throws(() => parseGame(invalid(state => { state.dex.species.creature_voltkit.seen = 'yes'; })), /species entry/);
  assert.throws(() => parseGame(invalid(state => { state.unknown = {}; })), /unexpected/);
  let state = winRival(starters[0]);
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12, facing: 'up' });
  state = step(state, { type: 'START_INVESTIGATION' });
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

function messageBattle() {
  return step(step(createGame(), { type: 'CHOOSE_STARTER', speciesId: starters[0] }), { type: 'START_BATTLE', kind: 'rival' });
}

test('battle messages identify both sides and preserve player action then enemy reply in one turn', () => {
  const before = messageBattle();
  const result = act(before, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  const [playerHit, enemyHit] = result.state.battle.log.slice(-2);
  assert.equal(playerHit.side, 'player');
  assert.equal(playerHit.actor.speciesId, starters[0]);
  assert.equal(playerHit.target.speciesId, before.battle.enemy.speciesId);
  assert.equal(playerHit.target.side, 'enemy');
  assert.equal(playerHit.action, 'Measured Strike');
  assert.equal(playerHit.amount, before.battle.enemy.hp - result.state.battle.enemy.hp);
  assert.equal(enemyHit.side, 'enemy');
  assert.equal(enemyHit.actor.speciesId, before.battle.enemy.speciesId);
  assert.equal(enemyHit.target.side, 'player');
  assert.equal(enemyHit.amount, before.party[0].hp - result.state.party[0].hp);
  assert.equal(playerHit.turn, before.battle.turn);
  assert.equal(enemyHit.turn, playerHit.turn);
  assert.equal(result.state.battle.turn, playerHit.turn + 1);
  assert.ok(result.events.every(event => typeof event === 'string'), 'Dialogue consumers still receive readable strings');
  assert.equal(before.battle.log.length, 1, 'Logging must not mutate the original state');

  const scanned = act(result.state, { type: 'BATTLE_SCAN' });
  const scan = scanned.state.battle.log.at(-1);
  assert.equal(scan.actor.name, before.player.name);
  assert.equal(scan.target.side, 'enemy');
  assert.equal(scan.type, 'scan');
  assert.equal(scan.turn, result.state.battle.turn);
  assert.equal(scanned.state.battle.turn, result.state.battle.turn, 'Free scan remains in the current turn');
});

test('healing and guard messages report their target and actual capped HP and Focus changes', () => {
  const before = messageBattle();
  before.party[0].hp -= 4;
  const healed = act(before, { type: 'BATTLE_MOVE', moveId: 'quiet_recovery' });
  const healing = healed.state.battle.log.find(event => event.type === 'heal');
  assert.equal(healing.amount, 4);
  assert.deepEqual(healing.actor, healing.target, 'Recovery clearly targets the acting partner');
  assert.equal(healing.action, 'Quiet Recovery');
  assert.match(healing.text, /Your Statifox/);

  const potionState = messageBattle();
  potionState.party[0].hp -= 2;
  const potion = act(potionState, { type: 'BATTLE_POTION' }).state.battle.log.find(event => event.type === 'heal');
  assert.equal(potion.amount, 2);
  assert.equal(potion.actor.name, potionState.player.name);
  assert.equal(potion.target.name, 'Statifox');

  const guarded = act(messageBattle(), { type: 'BATTLE_GUARD' });
  const [guard, reply] = guarded.state.battle.log.slice(-2);
  assert.equal(guard.focus, 0, 'A partner already at full Focus gains zero Focus');
  assert.equal(guard.guarded, true);
  assert.deepEqual(guard.actor, guard.target);
  assert.equal(reply.guarded, true, 'The reply explains that damage was guarded');
  const supportState = messageBattle();
  supportState.party[0].focus = 7;
  const support = act(supportState, { type: 'BATTLE_MOVE', moveId: 'focus_field' }).state.battle.log.at(-2);
  assert.equal(support.focus, 1);
  assert.equal(support.action, 'Focus Field');
});

test('matching species retain their sides through a switch and a saved battle', () => {
  let state = messageBattle();
  const partner = { ...state.battle.enemy, uid: 'mirror-partner' };
  state.party.push(partner);
  Object.assign(state.dex.species[partner.speciesId], { seen: true, recruited: true });
  state = step(state, { type: 'BATTLE_SWITCH', index: 1 });
  const [switched, enemyHit] = state.battle.log.slice(-2);
  assert.equal(switched.target.name, 'Algobear');
  assert.equal(switched.target.side, 'player');
  assert.equal(enemyHit.actor.name, enemyHit.target.name);
  assert.equal(enemyHit.actor.side, 'enemy');
  assert.equal(enemyHit.target.side, 'player');
  assert.match(enemyHit.text, /Enemy Algobear.*Your Algobear/);
  assert.deepEqual(parseGame(serializeGame(state)), state);
});

test('fainting, automatic replacement and final outcomes remain on the action turn', () => {
  const replacementState = messageBattle();
  const partner = { ...replacementState.battle.enemy, uid: 'replacement-partner' };
  replacementState.party.push(partner);
  Object.assign(replacementState.dex.species[partner.speciesId], { seen: true, recruited: true });
  replacementState.party[0].hp = 1;
  const replaced = act(replacementState, { type: 'BATTLE_GUARD' });
  const replacementEvents = replaced.state.battle.log.slice(-4);
  assert.deepEqual(replacementEvents.map(event => event.type), ['status', 'damage', 'faint', 'switch']);
  assert.ok(replacementEvents.every(event => event.turn === 1));
  assert.equal(replacementEvents[1].amount, 1, 'Damage reports HP actually lost');
  assert.equal(replacementEvents[2].actor.name, 'Statifox');
  assert.equal(replacementEvents[3].target.name, 'Algobear');
  assert.equal(replaced.state.battle.activeIndex, 1);
  assert.equal(replaced.state.battle.turn, 2);

  const victoryState = messageBattle();
  victoryState.battle.enemy.hp = 1;
  const won = act(victoryState, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  assert.equal(won.state.battle, null);
  const final = won.battleEvents.slice(1);
  assert.deepEqual(final.slice(0, 3).map(event => event.type), ['damage', 'faint', 'status']);
  assert.equal(final[0].amount, 1);
  assert.equal(final[1].side, 'enemy');
  assert.equal(final[2].action, 'Victory');
  assert.ok(final.every(event => event.turn === 1));

  const defeatState = messageBattle();
  defeatState.party[0].hp = 1;
  const lost = act(defeatState, { type: 'BATTLE_GUARD' });
  assert.equal(lost.state.battle, null);
  assert.deepEqual(lost.battleEvents.slice(-3).map(event => event.type), ['damage', 'faint', 'status']);
  assert.equal(lost.battleEvents.at(-1).action, 'Defeat');
});

test('legacy log strings coexist with validated structured events without losing save compatibility', () => {
  let state = messageBattle();
  state.battle.log = ['Kai challenges you with Algobear!', 'An earlier battle note.'];
  state = step(parseGame(serializeGame(state)), { type: 'BATTLE_GUARD' });
  assert.equal(typeof state.battle.log[0], 'string');
  assert.equal(state.battle.log.at(-1).type, 'damage');
  assert.deepEqual(parseGame(serializeGame(state)), state);
  const invalid = change => { const edited = structuredClone(state); change(edited.battle.log.at(-1)); return JSON.stringify(edited); };
  assert.throws(() => parseGame(invalid(event => { event.actor.side = 'player'; })), /actor side|damage participants/);
  assert.throws(() => parseGame(invalid(event => { event.amount = -1; })), /health change/);
  assert.throws(() => parseGame(invalid(event => { event.turn = state.battle.turn + 1; })), /turn/);
  assert.throws(() => parseGame(invalid(event => { event.target = null; })), /target/);
});
