import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, act, createGame } from '../dist/engine.js';
import { getBattleActions } from '../dist/battle-actions.js';

function battleFor(speciesId = 'creature_statifox', kind = 'rival') {
  let state = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
  if (kind === 'wild') {
    state.flags.rivalDefeated = true;
    state.quests.firstBond.status = 'complete';
  }
  state = act(state, { type: 'START_BATTLE', kind }).state;
  if (speciesId !== 'creature_statifox') {
    const maxHp = SPECIES[speciesId].baseHp + 15;
    state.party.push({ uid: `test-${speciesId}`, speciesId, hp: maxHp, maxHp, focus: 8, level: 5, xp: 0 });
    state.dex.species[speciesId].seen = true;
    state.dex.species[speciesId].recruited = true;
    if (speciesId === 'creature_voltkit') state.flags.recruitedVoltkit = true;
    state.battle.activeIndex = 1;
  }
  return state;
}

const find = (state, key) => getBattleActions(state).find(item => item.key === key);

test('every species exposes its actual moves and every battle command', () => {
  for (const species of Object.values(SPECIES)) {
    const state = battleFor(species.id);
    const member = state.party[state.battle.activeIndex];
    member.hp -= 1;
    const before = structuredClone(state);
    const actions = getBattleActions(state);
    assert.deepEqual(actions.filter(item => item.group === 'skills').map(item => item.key), species.moves.map(move => `move:${move.id}`));
    assert.equal(new Set(actions.map(item => item.key)).size, actions.length);
    for (const key of ['guard', 'scan', 'potion', 'bond', 'flee']) assert.ok(actions.some(item => item.key === key));
    assert.equal(actions.filter(item => item.group === 'party').length, state.party.length);
    for (const move of species.moves) {
      const item = find(state, `move:${move.id}`);
      assert.equal(item.description, move.description, 'species copy is preserved');
      assert.equal(item.available, true);
      assert.equal(item.unavailableReason, '');
      assert.deepEqual(item.action, { type: 'BATTLE_MOVE', moveId: move.id });
      const result = act(state, item.action);
      const event = result.battleEvents.find(event => event.action === move.name && event.side === 'player');
      assert.ok(event, 'the advertised action executes in the engine');
      if (move.kind === 'attack') {
        assert.match(item.effect, new RegExp(`Power ${move.power} attack against enemy Algobear`));
        assert.doesNotMatch(item.effect, /\d+ (?:HP|damage)/, 'power must not be presented as predicted damage');
      } else if (move.kind === 'heal') {
        assert.match(item.effect, /Restore 1 HP/);
        assert.equal(event.amount, 1, 'preview respects the HP cap');
      } else {
        assert.match(item.effect, /Recover 0 Focus/);
        assert.equal(event.focus, 0, 'support remains useful for guard at full Focus');
      }
    }
    assert.deepEqual(state, before, 'describing or executing cloned actions leaves the original unchanged');
  }
});

test('Focus requirements disable paid skills while free attacks, guard, and support stay available', () => {
  for (const species of Object.values(SPECIES)) {
    const state = battleFor(species.id);
    const member = state.party[state.battle.activeIndex];
    member.focus = 0;
    for (const move of species.moves) {
      const item = find(state, `move:${move.id}`);
      assert.equal(item.available, move.cost === 0);
      if (move.cost > 0) {
        assert.match(item.unavailableReason, new RegExp(`Needs ${move.cost} Focus`));
        assert.throws(() => act(state, item.action), /Not enough Focus/);
      }
    }
    assert.equal(find(state, 'guard').available, true);
    const support = species.moves.find(move => move.kind === 'support');
    assert.match(find(state, `move:${support.id}`).effect, /Recover 4 Focus/);
  }
});

test('healing previews actual HP and preserve engine permission for zero-healing skills', () => {
  const state = battleFor();
  const heal = find(state, 'move:quiet_recovery');
  assert.equal(heal.available, true, 'the engine permits a heal at full HP');
  assert.match(heal.effect, /Restore 0 HP/);
  assert.match(heal.limitation, /full HP/);
  assert.equal(act(state, heal.action).battleEvents.find(event => event.type === 'heal').amount, 0);

  assert.equal(find(state, 'potion').available, false);
  assert.match(find(state, 'potion').unavailableReason, /full HP/);
  assert.throws(() => act(state, find(state, 'potion').action), /full HP/);
  state.party[0].hp -= 5;
  const potion = find(state, 'potion');
  assert.equal(potion.available, true);
  assert.match(potion.effect, /Restore 5 HP/);
  assert.equal(act(state, potion.action).battleEvents.find(event => event.action === 'Potion').amount, 5);
  state.inventory.potions = 0;
  assert.equal(find(state, 'potion').available, false);
  assert.match(find(state, 'potion').unavailableReason, /No potions left/);
  assert.throws(() => act(state, potion.action), /No potions left/);
});

test('scan is a free, nonmutating preview and becomes unavailable after one scan', () => {
  const state = battleFor();
  const before = structuredClone(state);
  const scan = find(state, 'scan');
  assert.equal(scan.available, true);
  assert.match(scan.turn, /Free.*no turn consumed/);
  assert.deepEqual(state, before);
  const result = act(state, scan.action);
  assert.equal(result.state.battle.turn, state.battle.turn);
  assert.equal(result.state.party[0].hp, state.party[0].hp);
  assert.equal(result.state.party[0].focus, state.party[0].focus);
  assert.equal(find(result.state, 'scan').available, false);
  assert.match(find(result.state, 'scan').unavailableReason, /already been scanned/);
  assert.throws(() => act(result.state, scan.action), /already scanned/);
});

test('bonding and leaving explain rival restrictions, wild requirements, and turn behavior', () => {
  const rival = battleFor();
  for (const key of ['bond', 'flee']) {
    const item = find(rival, key);
    assert.equal(item.available, false);
    assert.match(item.unavailableReason, /Kai/);
    assert.throws(() => act(rival, item.action));
  }
  const wild = battleFor('creature_statifox', 'wild');
  assert.equal(find(wild, 'bond').available, true);
  assert.match(find(wild, 'bond').turn, /enemy replies unless battle ends/);
  assert.match(find(wild, 'bond').limitation, /Weaken and scan/);
  assert.match(find(wild, 'bond').limitation, /failed attempt still uses a crystal and allows an enemy reply/);
  const flee = find(wild, 'flee');
  assert.equal(flee.available, true);
  assert.match(flee.turn, /Free.*ends encounter/);
  assert.equal(act(wild, flee.action).state.battle, null);
  wild.inventory.bondCrystals = 0;
  assert.equal(find(wild, 'bond').available, false);
  assert.match(find(wild, 'bond').unavailableReason, /No Bond Crystals/);
  assert.throws(() => act(wild, find(wild, 'bond').action), /No Bond Crystals/);

  for (const speciesId of ['creature_algobear', 'creature_terradeer', 'creature_samplet']) {
    const maxHp = SPECIES[speciesId].baseHp + 15;
    wild.party.push({ uid: speciesId, speciesId, hp: maxHp, maxHp, focus: 8, level: 5, xp: 0 });
    wild.dex.species[speciesId].seen = true;
    wild.dex.species[speciesId].recruited = true;
  }
  assert.match(find(wild, 'bond').unavailableReason, /party is full/);
  assert.throws(() => act(wild, find(wild, 'bond').action), /party is full/);
});

test('switch cards include active, healthy, and fainted partners with engine-aligned reasons', () => {
  const lone = battleFor();
  const active = find(lone, 'switch:0');
  assert.equal(active.available, false);
  assert.match(active.unavailableReason, /already active.*another healthy Databeast/);
  assert.match(active.limitation, /another healthy Databeast/);
  assert.throws(() => act(lone, active.action), /already active/);

  const state = battleFor('creature_terradeer');
  const switchBack = find(state, 'switch:0');
  assert.equal(switchBack.label, 'Switch to Statifox');
  assert.equal(switchBack.available, true);
  assert.match(switchBack.effect, /Statifox takes the field/);
  assert.match(switchBack.turn, /1 turn.*enemy replies/);
  assert.equal(act(state, switchBack.action).state.battle.activeIndex, 0);
  state.party[0].hp = 0;
  const fainted = find(state, 'switch:0');
  assert.equal(fainted.available, false);
  assert.match(fainted.unavailableReason, /fainted/);
  assert.throws(() => act(state, fainted.action), /healthy party member/);
});

test('guard preview shows capped Focus and explains expiration when the enemy supports', () => {
  const state = battleFor();
  state.party[0].focus = 7;
  state.battle.turn = 3;
  const item = find(state, 'guard');
  assert.match(item.effect, /recovers 1 Focus/);
  assert.match(item.limitation, /expires.*including a support move/);
  const next = act(state, item.action).state;
  assert.equal(next.party[0].hp, state.party[0].hp, 'enemy support deals no damage');
  assert.equal(next.party[0].focus, 8);
  assert.equal(next.battle.guarded, false, 'guard is consumed by the enemy support turn');
  assert.equal(next.battle.enemyGuarded, true);
  assert.deepEqual(getBattleActions(createGame()), []);
});
