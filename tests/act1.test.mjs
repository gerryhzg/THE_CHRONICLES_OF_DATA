import test from 'node:test';
import assert from 'node:assert/strict';
import { ACT1_RECORDS, ACT1_SHOP, SPECIES, act, createGame, getAct1TutorialStep, parseGame, serializeGame } from '../dist/engine.js';

const starters = ['creature_statifox', 'creature_algobear', 'creature_terradeer'];
const step = (state, action) => act(state, action, () => 0).state;
const apply = (state, actions) => actions.reduce(step, state);
function investigation() {
  return apply(createGame(), [{ type: 'ACT1_INTRO_COMPLETE' }, { type: 'ACT1_START' }]);
}
function collect(state, id) {
  const clues = id === 'farm' ? ['farm_crate'] : id === 'river' ? ['river_reeds'] : ['shop_receipt', 'shop_box', 'shop_tower'];
  state = apply(state, clues.map(id => ({ type: 'ACT1_FIELD_ACTION', id })));
  return step(state, { type: 'ACT1_COLLECT_RECORD', id });
}
function compared() {
  let state = ACT1_RECORDS.reduce((state, record) => collect(state, record.id), investigation());
  state = apply(state, ACT1_RECORDS.map(record => ({ type: 'ACT1_COMPARE_RECORD', id: record.id })));
  return step(state, { type: 'ACT1_COMPLETE_COMPARISON' });
}
function ready(starter = starters[0]) {
  let state = step(compared(), { type: 'ACT1_RECEIVE_DEX' });
  state = apply(state, starters.map(id => ({ type: 'ACT1_DEMO', id })));
  return step(state, { type: 'CHOOSE_STARTER', speciesId: starter });
}
function finishBattle(state) {
  for (let turn = 0; state.battle && turn < 20; turn++) state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  assert.equal(state.battle, null, 'a practiced team can finish the friendly match');
  assert.equal(state.flags.rivalDefeated, true);
  return state;
}
function win(starter = starters[0]) {
  let state = step(ready(starter), { type: 'START_BATTLE', kind: 'rival' });
  state = apply(state, [
    { type: 'BATTLE_MOVE', moveId: 'observe_strike' }, { type: 'BATTLE_GUARD' },
    { type: 'BATTLE_SCAN' }, { type: 'BATTLE_SWITCH', index: 1 },
  ]);
  return finishBattle(state);
}
function oldShape(state) {
  state = structuredClone(state);
  delete state.act1;
  delete state.inventory.antidotes;
  delete state.inventory.archiveFragments;
  delete state.dex.species.creature_cloudfin;
  delete state.dex.concepts.concept_historical_observation;
  return state;
}

test('a new adventure requires the opening, field investigation, comparison, DataDex, and demonstrations', () => {
  const state = createGame();
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.act1.migrated, false);
  assert.throws(() => step(state, { type: 'ACT1_START' }), /opening/);
  assert.throws(() => step(state, { type: 'ACT1_COLLECT_RECORD', id: 'farm' }), /Accept Lyra/);
  assert.throws(() => step(state, { type: 'CHOOSE_STARTER', speciesId: starters[0] }), /rainfall investigation/);
  assert.throws(() => step(state, { type: 'ACT1_RECEIVE_DEX' }), /comparison/);
  assert.throws(() => step(state, { type: 'ACT1_COUNCIL_COMPLETE' }), /friendly battle/);
  assert.throws(() => step(state, { type: 'ACT1_DEMO', id: starters[0] }), /Receive the DataDex/);
  const named = step(state, { type: 'SET_NAME', name: 'Rain' });
  assert.equal(named.flags.introSeen, false, 'naming does not skip the opening');
  const opened = step(named, { type: 'ACT1_INTRO_COMPLETE' });
  assert.equal(opened.flags.introSeen, true);
  assert.deepEqual(parseGame(serializeGame(opened)), opened);
});

test('combat difficulty is saved separately and changes incoming damage without changing the quest', () => {
  const standard=ready();
  const relaxed=step(standard,{type:'SET_COMBAT_DIFFICULTY',difficulty:'relaxed'});
  assert.deepEqual(relaxed.quests,standard.quests);
  assert.deepEqual(relaxed.act1.records,standard.act1.records);
  assert.equal(parseGame(serializeGame(relaxed)).act1.combatDifficulty,'relaxed');
  const original=step(step(standard,{type:'START_BATTLE',kind:'rival'}),{type:'BATTLE_MOVE',moveId:'observe_strike'});
  const gentler=step(step(relaxed,{type:'START_BATTLE',kind:'rival'}),{type:'BATTLE_MOVE',moveId:'observe_strike'});
  assert.ok(gentler.party[0].hp>original.party[0].hp,'relaxed combat reduces incoming damage');
  assert.equal(gentler.battle.enemy.hp,original.battle.enemy.hp,'player attacks retain their strength');
  assert.throws(()=>step(gentler,{type:'SET_COMBAT_DIFFICULTY',difficulty:'standard'}),/Finish or flee/);
  assert.throws(()=>step(standard,{type:'SET_COMBAT_DIFFICULTY',difficulty:'impossible'}),/Standard or Relaxed/);
  const early=structuredClone(standard);delete early.act1.combatDifficulty;
  assert.equal(parseGame(JSON.stringify(early)).act1.combatDifficulty,'standard');
});

test('all six record collection orders preserve the same evidence and cannot duplicate it', () => {
  for (const order of [['farm', 'river', 'shop'], ['farm', 'shop', 'river'], ['river', 'farm', 'shop'], ['river', 'shop', 'farm'], ['shop', 'farm', 'river'], ['shop', 'river', 'farm']]) {
    let state = investigation();
    for (const id of order) {
      const before = structuredClone(state);
      state = collect(state, id);
      assert.deepEqual(before.act1.records, order.slice(0, order.indexOf(id)), 'field actions do not mutate their input');
      const duplicate = collect(state, id);
      assert.deepEqual(duplicate, state, 'collecting or inspecting twice does not duplicate progress or rewards');
      state = parseGame(serializeGame(state));
    }
    assert.deepEqual(state.act1.records, order);
    assert.equal(state.act1.comparisonComplete, false);
    assert.equal(state.act1.dexReceived, false);
  }
});

test('records must be revealed through playable field actions, including all three shop objects', () => {
  let state = investigation();
  for (const id of ['farm', 'river', 'shop']) assert.throws(() => step(state, { type: 'ACT1_COLLECT_RECORD', id }), /Move|ripples|Inspect/);
  state = step(state, { type: 'ACT1_FIELD_ACTION', id: 'shop_tower' });
  assert.throws(() => step(state, { type: 'ACT1_COLLECT_RECORD', id: 'shop' }), /shipping receipt/);
  state = step(state, { type: 'ACT1_FIELD_ACTION', id: 'shop_receipt' });
  assert.throws(() => step(state, { type: 'ACT1_COLLECT_RECORD', id: 'shop' }), /potion box/);
  state = step(state, { type: 'ACT1_FIELD_ACTION', id: 'shop_box' });
  state = step(state, { type: 'ACT1_COLLECT_RECORD', id: 'shop' });
  assert.deepEqual(state.act1.records, ['shop']);
  assert.throws(() => step(state, { type: 'ACT1_FIELD_ACTION', id: 'guess' }), /known village clue/);
});

test('comparison examines every recovered historical row and grants its reward only once', () => {
  let state = investigation();
  assert.throws(() => step(state, { type: 'ACT1_COMPARE_RECORD', id: 'farm' }), /all three/);
  state = ACT1_RECORDS.reduce((state, record) => collect(state, record.id), state);
  state = step(state, { type: 'ACT1_COMPARE_RECORD', id: 'river' });
  const saved = parseGame(serializeGame(state));
  assert.deepEqual(saved.act1.compared, ['river']);
  assert.throws(() => step(saved, { type: 'ACT1_COMPLETE_COMPARISON' }), /all three/);
  state = apply(saved, ['farm', 'shop'].map(id => ({ type: 'ACT1_COMPARE_RECORD', id })));
  state = step(state, { type: 'ACT1_COMPLETE_COMPARISON' });
  assert.equal(state.researchPoints, 10);
  assert.equal(state.dex.concepts.concept_historical_observation, 'understood');
  assert.equal(state.act1.dexReceived, false, 'the conversation must grant the device separately');
  assert.deepEqual(step(state, { type: 'ACT1_COMPLETE_COMPARISON' }), state);
  state = step(state, { type: 'ACT1_RECEIVE_DEX' });
  assert.equal(state.coins, 50);
  assert.deepEqual(step(state, { type: 'ACT1_RECEIVE_DEX' }), state);
  assert.deepEqual(ACT1_RECORDS.map(row => [row.rainfall, row.temperature, row.archiveRainfall]), [[12, 17, 0], [28, 15, 0], [7, 19, 0]]);
});

test('each starter is selectable after all three demonstrations and gets exactly one permanent slot', () => {
  for (const starter of starters) {
    let state = step(compared(), { type: 'ACT1_RECEIVE_DEX' });
    state = step(state, { type: 'ACT1_DEMO', id: starters[0] });
    assert.throws(() => step(state, { type: 'CHOOSE_STARTER', speciesId: starter }), /all three/);
    assert.deepEqual(step(state, { type: 'ACT1_DEMO', id: starters[0] }), state);
    state = apply(state, starters.slice(1).map(id => ({ type: 'ACT1_DEMO', id })));
    state = step(parseGame(serializeGame(state)), { type: 'CHOOSE_STARTER', speciesId: starter });
    assert.equal(state.party.length, 1);
    assert.equal(state.party[0].speciesId, starter);
    assert.equal(state.party[0].level, 5);
    assert.throws(() => step(state, { type: 'CHOOSE_STARTER', speciesId: starter }), /already chosen/);
  }
});

test('Kai lends Cloudfin and teaches attack, defense, free Scan, and switching before a finishing blow', () => {
  let state = step(ready(), { type: 'START_BATTLE', kind: 'rival' });
  assert.equal(state.battle.enemy.speciesId, 'creature_voltkit');
  assert.equal(state.battle.enemy.level, 4);
  assert.equal(state.party[1].speciesId, 'creature_cloudfin');
  assert.equal(getAct1TutorialStep(state), 'attack');
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'pattern_pulse' });
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'pattern_pulse' });
  assert.equal(state.battle.enemy.hp, 1, 'the practice opponent waits for the other lessons');
  assert.equal(state.flags.rivalDefeated, false);
  assert.equal(getAct1TutorialStep(state), 'guard');
  state = step(state, { type: 'BATTLE_GUARD' });
  const turn = state.battle.turn;
  state = step(state, { type: 'BATTLE_SCAN' });
  assert.equal(state.battle.turn, turn);
  assert.equal(getAct1TutorialStep(state), 'switch');
  const saved = parseGame(serializeGame(state));
  state = step(saved, { type: 'BATTLE_SWITCH', index: 1 });
  assert.equal(getAct1TutorialStep(state), null);
  const result = act(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  state = result.state;
  assert.equal(state.battle, null);
  assert.equal(result.battleProgression.recipient.uid, state.party[0].uid, 'loaned Cloudfin cannot take the starter’s XP');
  assert.equal(state.party.length, 1);
  assert.equal(state.party[0].xp, 30);
  assert.equal(state.party[0].hp, state.party[0].maxHp);
  assert.equal(state.dex.species.creature_cloudfin.recruited, false);
  assert.equal(state.dex.species.creature_cloudfin.seen, true);
  assert.equal(state.inventory.bondCrystals, 7);
});

test('all three starters can win the complete lesson and the council opens a permanent returnable road', () => {
  for (const starter of starters) {
    let state = win(starter);
    assert.throws(() => step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12 }), /council/);
    state = step(state, { type: 'ACT1_COUNCIL_COMPLETE' });
    assert.deepEqual(step(state, { type: 'ACT1_COUNCIL_COMPLETE' }), state);
    state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12 });
    state = step(state, { type: 'START_INVESTIGATION' });
    state = step(state, { type: 'OBSERVE', habitatId: 'habitat_meadow' });
    state = parseGame(serializeGame(state));
    state = step(state, { type: 'MOVE', map: 'village', x: 16, y: 15 });
    state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12 });
    assert.equal(state.quests.nocturnal.observations.length, 1, 'the existing forest investigation still works after Act I');
  }
});

test('friendly defeat returns the loan, heals the starter, retains lessons, and permits a retry', () => {
  let state = step(ready(), { type: 'START_BATTLE', kind: 'rival' });
  state.inventory.potions = 0;
  state = step(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
  const supplies = structuredClone(state.inventory);
  state = step(state, { type: 'BATTLE_POTION' });
  assert.deepEqual(state.inventory, supplies, 'Lyra provides the practice potion');
  for (let turn = 0; state.battle && turn < 80; turn++) state = step(state, { type: 'BATTLE_GUARD' });
  assert.equal(state.battle, null);
  assert.equal(state.flags.rivalDefeated, false);
  assert.equal(state.party.length, 1);
  assert.equal(state.party[0].hp, state.party[0].maxHp);
  assert.equal(state.party[0].xp, 0);
  assert.deepEqual(state.inventory, supplies);
  assert.equal(state.act1.tutorial.attack, true);
  state = step(parseGame(serializeGame(state)), { type: 'START_BATTLE', kind: 'rival' });
  assert.equal(state.party.length, 2);
  assert.equal(new Set(state.party.map(member => member.uid)).size, 2);
});

test('rematches do not repeat tutorial gifts or require a loan', () => {
  const won = win();
  let state = step(won, { type: 'START_BATTLE', kind: 'rival' });
  assert.equal(state.party.length, 1);
  assert.equal(getAct1TutorialStep(state), null);
  state = finishBattle(state);
  assert.equal(state.coins, won.coins);
  assert.equal(state.inventory.bondCrystals, won.inventory.bondCrystals);
});

test('optional village activities are persistent, order independent, and reward only once', () => {
  let state = investigation();
  assert.throws(() => step(state, { type: 'ACT1_SIDE_ACTION', id: 'scarf_return' }), /Find the lost scarf/);
  for (const id of ['scarf_find', 'scarf_return', 'old_journal', 'supply_chest', 'garden_clear']) {
    state = step(state, { type: 'ACT1_SIDE_ACTION', id });
    const saved = parseGame(serializeGame(state));
    assert.deepEqual(step(saved, { type: 'ACT1_SIDE_ACTION', id }), state);
  }
  assert.equal(state.coins, 15);
  assert.equal(state.inventory.archiveFragments, 1);
  assert.equal(state.inventory.potions, 4);
  assert.equal(state.researchPoints, 5);
  assert.equal(state.starter, null, 'side activities never require a starter');
  state = ACT1_RECORDS.reduce((state, record) => collect(state, record.id), state);
  state = apply(state, ACT1_RECORDS.map(record => ({ type: 'ACT1_COMPARE_RECORD', id: record.id })));
  state = step(state, { type: 'ACT1_COMPLETE_COMPARISON' });
  assert.equal(state.dex.concepts.concept_historical_observation, 'mastered');
});

test('Nell exchanges coins for the specified supplies without granting unaffordable purchases', () => {
  let state = step(compared(), { type: 'ACT1_RECEIVE_DEX' });
  for (const item of ACT1_SHOP) {
    const before = structuredClone(state);
    state = step(state, { type: 'BUY_ITEM', id: item.id });
    assert.equal(state.coins, before.coins - item.price);
    assert.equal(state.inventory[item.inventoryKey], before.inventory[item.inventoryKey] + 1);
  }
  assert.equal(state.coins, 8);
  assert.throws(() => step(state, { type: 'BUY_ITEM', id: 'potion' }), /12 Aether Coins/);
  assert.throws(() => step(state, { type: 'BUY_ITEM', id: 'bogus' }), /stocked by Nell/);
});

test('original v1 saves migrate at first selection, midbattle, and after forest unlock', () => {
  let original = oldShape(createGame());
  delete original.flags.reportedToLyra;
  let state = parseGame(JSON.stringify(original));
  assert.equal(state.act1.migrated, true);
  assert.equal(state.flags.reportedToLyra, false);
  assert.equal(state.inventory.archiveFragments, 0);
  state = step(state, { type: 'CHOOSE_STARTER', speciesId: starters[0] });
  state = step(state, { type: 'START_BATTLE', kind: 'rival' });
  assert.equal(state.battle.enemy.speciesId, 'creature_algobear');
  assert.equal(state.party.length, 1);
  state = parseGame(JSON.stringify(oldShape(state)));
  state = finishBattle(state);
  state = step(state, { type: 'MOVE', map: 'forest', x: 9, y: 12 });
  state = parseGame(JSON.stringify(oldShape(state)));
  assert.equal(state.map, 'forest');
  assert.equal(state.act1.councilComplete, true);
  assert.deepEqual(parseGame(serializeGame(state)), state);
});

test('Act I saves reject duplicate clues, impossible unlocks, leaked loans, and malformed migration shapes', () => {
  const reject = (source, change, pattern) => {
    const state = structuredClone(source);
    change(state);
    assert.throws(() => parseGame(JSON.stringify(state)), pattern);
  };
  reject(investigation(), state => { state.act1.records = ['farm']; }, /farm ledger/);
  reject(collect(investigation(), 'farm'), state => { state.act1.records.push('farm'); }, /identifiers/);
  reject(investigation(), state => { state.act1.dexReceived = true; }, /DataDex requires/);
  reject(ready(), state => { state.act1.councilComplete = true; }, /council requires/);
  reject(ready(), state => { state.flags.rivalDefeated = true; }, /tutorial is incomplete/);
  reject(createGame(), state => { state.act1.migrated = 'yes'; }, /Act I flags/);
  const legacy = oldShape(createGame());
  legacy.extra = true;
  assert.throws(() => parseGame(JSON.stringify(legacy)), /unexpected/);
  const loan = step(ready(), { type: 'START_BATTLE', kind: 'rival' });
  reject(loan, state => { state.battle = null; }, /training Cloudfin/);
  assert.equal(Object.keys(SPECIES).includes('creature_cloudfin'), true);
});
