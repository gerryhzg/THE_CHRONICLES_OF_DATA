import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, act, createGame, parseGame, serializeGame } from '../dist/engine.js';
import { MAX_LEVEL, getAttackStrength, getExpProgress, getExpRequired } from '../dist/progression.js';

function battle(kind = 'rival', { level = 5, xp = 0, hp } = {}) {
  let state = act(createGame(), { type: 'CHOOSE_STARTER', speciesId: 'creature_statifox' }).state;
  if (kind === 'wild') {
    state.flags.rivalDefeated = true;
    state.quests.firstBond.status = 'complete';
  }
  const member = state.party[0];
  Object.assign(member, { level, xp, maxHp: SPECIES[member.speciesId].baseHp + level * 3 });
  member.hp = hp ?? member.maxHp;
  return act(state, { type: 'START_BATTLE', kind }).state;
}

function finish(state) {
  state = structuredClone(state);
  state.battle.enemy.hp = 1;
  return act(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
}

function addPartner(state) {
  const partner = { ...state.battle.enemy, uid: 'second-partner', xp: 85 };
  state.party.push(partner);
  Object.assign(state.dex.species[partner.speciesId], { seen: true, recruited: true });
  return partner;
}

test('progress helper describes the existing threshold and attack rules without changing the member', () => {
  const member = { level: 5, xp: 30 };
  assert.equal(MAX_LEVEL, 50);
  assert.equal(getExpRequired(5), 100);
  assert.deepEqual(getExpProgress(member), { level: 5, xp: 30, required: 100, remaining: 70, percent: 30, isMaxLevel: false });
  assert.deepEqual(member, { level: 5, xp: 30 });
  assert.equal(getExpProgress({ level: 5, xp: 120 }).percent, 100, 'legacy over-threshold EXP never overfills the bar');
  assert.equal(getExpProgress({ level: 5, xp: 120 }).remaining, 0);
  for (const species of Object.values(SPECIES)) {
    for (const level of [1, 2, 3, 5, 6, 49, 50]) {
      assert.equal(getAttackStrength(species, level), species.power + Math.floor(level / 3));
      assert.equal(getAttackStrength(species, { level }), getAttackStrength(species, level));
    }
  }
});

test('rival and wild wins report their actual active recipient, EXP and next-level progress', () => {
  for (const [kind, xpGained] of [['rival', 30], ['wild', 18]]) {
    const state = battle(kind);
    const result = finish(state);
    const progression = result.battleProgression;
    assert.equal(result.state.battle, null);
    assert.equal(progression.outcome, 'victory');
    assert.equal(progression.xpGained, xpGained);
    assert.deepEqual(progression.recipient, { uid: state.party[0].uid, speciesId: state.party[0].speciesId, name: 'Statifox' });
    assert.equal(progression.before.xp, 0);
    assert.equal(progression.after.xp, xpGained);
    assert.equal(progression.after.level, 5);
    assert.equal(progression.after.attack, 8);
    assert.deepEqual(progression.levelUps, []);
    assert.deepEqual(progression.unlockedSkills, []);
    assert.equal(getExpProgress(progression.after).remaining, 100 - xpGained);
    assert.equal(result.state.party[0].xp, xpGained);
    assert.deepEqual(result.battleEvents.slice(-3).map(event => event.type), ['damage', 'faint', 'status'], 'the existing action, faint and outcome sequence is unchanged');
  }
});

test('crossing a threshold reports one level, capped HP recovery and the real attack increase', () => {
  for (const hp of [20, 47]) {
    const state = battle('wild', { xp: 82, hp });
    const result = finish(state);
    const progression = result.battleProgression;
    assert.equal(progression.before.level, 5);
    assert.equal(progression.before.maxHp, 47);
    assert.equal(progression.before.attack, 8);
    assert.equal(progression.after.level, 6);
    assert.equal(progression.after.xp, 0);
    assert.equal(progression.after.maxHp, 50);
    assert.equal(progression.after.hp, Math.min(50, hp + 8));
    assert.equal(progression.after.attack, 9);
    assert.deepEqual(progression.levelUps, [{
      level: 6,
      before: { level: 5, hp, maxHp: 47, attack: 8 },
      after: { level: 6, hp: Math.min(50, hp + 8), maxHp: 50, attack: 9 },
      unlockedSkills: [],
    }]);
    assert.match(result.events.join(' '), /reached level 6/);
    assert.equal(getExpProgress(progression.after).required, 120);
    assert.equal(getExpProgress(progression.after).remaining, 120);
  }
});

test('the battle engine uses the same attack statistic shown by progression helpers', () => {
  for (const level of [2, 3, 5, 6, 49, 50]) {
    const state = battle('wild', { level });
    const member = state.party[0];
    const armor = Math.floor(SPECIES[state.battle.enemy.speciesId].guard / 2);
    const expected = Math.max(3, getAttackStrength(SPECIES[member.speciesId], member) + 7 - armor);
    const result = act(state, { type: 'BATTLE_MOVE', moveId: 'observe_strike' });
    const hit = result.battleEvents.find(event => event.type === 'damage' && event.side === 'player');
    assert.equal(hit.amount, Math.min(state.battle.enemy.hp, expected));
  }
});

test('all level-ups from existing over-threshold EXP are reported in order without invented skills', () => {
  const result = finish(battle('wild', { level: 1, xp: 112, hp: 10 }));
  const progression = result.battleProgression;
  assert.equal(progression.xpGained, 18);
  assert.equal(progression.after.level, 4);
  assert.equal(progression.after.xp, 10, '20, 40 and 60 EXP thresholds are each subtracted');
  assert.equal(progression.after.hp, 34);
  assert.equal(progression.after.maxHp, 44);
  assert.deepEqual(progression.levelUps.map(level => level.level), [2, 3, 4]);
  assert.deepEqual(progression.levelUps.map(level => [level.before.attack, level.after.attack]), [[7, 7], [7, 8], [8, 8]], 'attack grows every third level, rather than every level');
  assert.deepEqual(progression.levelUps.map(level => level.after.maxHp - level.before.maxHp), [3, 3, 3]);
  assert.ok(progression.levelUps.every(level => level.after.hp - level.before.hp === 8));
  assert.ok(progression.levelUps.every(level => level.unlockedSkills.length === 0));
  assert.deepEqual(progression.unlockedSkills, []);
  assert.deepEqual(result.battleEvents.filter(event => event.action === 'Level up').map(event => event.text.match(/level (\d+)/)[1]), ['2', '3', '4']);
});

test('only the active winner earns EXP after a manual switch or an automatic replacement', () => {
  let state = battle();
  addPartner(state);
  const reserveXp = state.party[0].xp;
  state = act(state, { type: 'BATTLE_SWITCH', index: 1 }).state;
  const won = finish(state);
  assert.equal(won.battleProgression.recipient.uid, 'second-partner');
  assert.equal(won.battleProgression.before.xp, 85);
  assert.equal(won.battleProgression.after.level, 6);
  assert.equal(won.battleProgression.after.xp, 15);
  assert.equal(won.state.party[0].xp, reserveXp);
  assert.equal(won.state.party[0].level, 5);
  assert.equal(won.battleProgression.after.hp, won.state.party[1].maxHp, 'rival healing is included in the final recipient snapshot');

  state = battle();
  addPartner(state);
  state.party[0].hp = 1;
  state = act(state, { type: 'BATTLE_GUARD' }).state;
  assert.equal(state.battle.activeIndex, 1);
  const replacementWin = finish(state);
  assert.equal(replacementWin.battleProgression.recipient.uid, 'second-partner');
  assert.equal(replacementWin.state.party[0].xp, 0, 'the fainted outgoing partner receives no EXP');
});

test('a successful bond rewards the active partner 18 EXP, not the newly recruited Databeast', () => {
  const state = battle('wild', { xp: 82, hp: 20 });
  const result = act(state, { type: 'BATTLE_BOND' }, () => 0);
  const progression = result.battleProgression;
  assert.equal(progression.outcome, 'bond');
  assert.equal(progression.xpGained, 18);
  assert.equal(progression.recipient.uid, state.party[0].uid);
  assert.equal(progression.after.level, 6);
  assert.equal(result.state.party[1].speciesId, 'creature_voltkit');
  assert.equal(result.state.party[1].xp, 0);
  assert.equal(result.state.party[1].level, 4);
  assert.deepEqual(progression.unlockedSkills, []);

  const failed = act(state, { type: 'BATTLE_BOND' }, () => 0.99);
  assert.ok(failed.state.battle);
  assert.equal(Object.hasOwn(failed, 'battleProgression'), false, 'an unfinished encounter has no reward summary');
});

test('defeat and escaping report zero EXP and never select a reward recipient', () => {
  for (const outcome of ['defeat', 'escape']) {
    const state = battle(outcome === 'escape' ? 'wild' : 'rival', { xp: 99, hp: 1 });
    const action = { type: outcome === 'escape' ? 'BATTLE_FLEE' : 'BATTLE_GUARD' };
    const result = act(state, action);
    assert.equal(result.state.battle, null);
    assert.deepEqual(result.battleProgression, { outcome, xpGained: 0, recipient: null, before: null, after: null, levelUps: [], unlockedSkills: [] });
    assert.equal(result.state.party[0].xp, 99);
    assert.equal(result.state.party[0].level, 5);
  }
});

test('the level cap preserves existing accumulated EXP without adding levels or stats', () => {
  const crossing = finish(battle('rival', { level: 49, xp: 970, hp: 100 }));
  assert.equal(crossing.battleProgression.after.level, 50);
  assert.equal(crossing.battleProgression.after.xp, 20);
  assert.equal(crossing.battleProgression.levelUps.length, 1);
  assert.deepEqual(getExpProgress(crossing.battleProgression.after), { level: 50, xp: 20, required: 0, remaining: 0, percent: 100, isMaxLevel: true });

  const capped = finish(battle('wild', { level: 50, xp: 2000, hp: 100 }));
  assert.equal(capped.battleProgression.xpGained, 18);
  assert.equal(capped.battleProgression.after.level, 50);
  assert.equal(capped.battleProgression.after.xp, 2018, 'the old engine retains rewards at maximum level');
  assert.equal(capped.battleProgression.after.maxHp, capped.battleProgression.before.maxHp);
  assert.equal(capped.battleProgression.after.hp, 100);
  assert.equal(capped.battleProgression.after.attack, capped.battleProgression.before.attack);
  assert.deepEqual(capped.battleProgression.levelUps, []);
});

test('progression snapshots are detached, and saved battles replay with identical results and schema', () => {
  const state = battle('wild', { xp: 82, hp: 20 });
  state.battle.enemy.hp = 1;
  const json = serializeGame(state);
  const action = { type: 'BATTLE_MOVE', moveId: 'observe_strike' };
  const result = act(state, action);
  assert.equal(serializeGame(state), json, 'awarding EXP never mutates the supplied state');
  assert.deepEqual(act(parseGame(json), action), result);
  assert.equal(Object.hasOwn(result.state, 'battleProgression'), false);
  assert.deepEqual(Object.keys(result.state.party[0]), Object.keys(state.party[0]));
  assert.deepEqual(parseGame(serializeGame(result.state)), result.state);
  assert.equal(result.state.schemaVersion, 1);
  const savedResult = serializeGame(result.state);
  result.battleProgression.after.xp = 999;
  result.battleProgression.before.hp = 1;
  result.battleProgression.levelUps[0].after.maxHp = 999;
  assert.equal(serializeGame(result.state), savedResult, 'editing result presentation metadata cannot alter saved creature records');
});
