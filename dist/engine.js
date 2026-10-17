// Browser-native game rules. Every transition returns a fresh, serializable state.
export const SAVE_KEY = 'chronicles-of-data:save:v1';
const SAVE_LIMIT = 128 * 1024;
const SCHEMA_VERSION = 1;

const move = (id, name, description, power, cost = 0, kind = 'attack') => ({ id, name, description, power, cost, kind });
const basics = [
  move('observe_strike', 'Measured Strike', 'A reliable attack that costs no Focus.', 7),
  move('focus_field', 'Focus Field', 'Recover up to 4 Focus and guard for this turn.', 4, 0, 'support'),
];
export const SPECIES = {
  creature_statifox: {
    id: 'creature_statifox', name: 'Statifox', role: 'Insight specialist', type: 'Insight', color: '#edab67', symbol: '🦊',
    description: 'An observant fox that notices patterns in the Flow. Its curiosity makes every new observation valuable.',
    habitat: 'Harvest Village', baseHp: 32, power: 7, guard: 4,
    moves: [...basics, move('pattern_pulse', 'Pattern Pulse', 'Spend 2 Focus for a precise burst of Flow.', 15, 2), move('quiet_recovery', 'Quiet Recovery', 'Recover 15 HP. Costs 3 Focus.', 15, 3, 'heal')],
  },
  creature_algobear: {
    id: 'creature_algobear', name: 'Algobear', role: 'Computational specialist', type: 'Logic', color: '#79b6d5', symbol: '🐻',
    description: 'A sturdy bear that arranges stones in efficient sequences. Careful planning gives its strikes remarkable power.',
    habitat: 'Harvest Village', baseHp: 44, power: 8, guard: 6,
    moves: [...basics, move('efficient_sequence', 'Efficient Sequence', 'Spend 2 Focus for an optimized heavy attack.', 15, 2), move('repair_rhythm', 'Repair Rhythm', 'Recover 15 HP. Costs 3 Focus.', 15, 3, 'heal')],
  },
  creature_terradeer: {
    id: 'creature_terradeer', name: 'Terradeer', role: 'Environmental specialist', type: 'Nature', color: '#9abb69', symbol: '🦌',
    description: 'A gentle deer attuned to soil, rain, and living habitats. It helps observers understand the context behind their records.',
    habitat: 'Harvest Village', baseHp: 38, power: 7, guard: 5,
    moves: [...basics, move('root_rush', 'Root Rush', 'Spend 2 Focus to channel the strength of the forest.', 15, 2), move('nature_mend', 'Nature Mend', 'Restore 20 HP with local knowledge. Costs 3 Focus.', 20, 3, 'heal')],
  },
  creature_voltkit: {
    id: 'creature_voltkit', name: 'Voltkit', role: 'Electrical offense', type: 'Spark', color: '#e9ce64', symbol: '⚡',
    description: 'A lively grassland creature that stores electrical Flow in its ears. Its recent actions are observations, never guarantees of its next move.',
    habitat: 'Village outskirts / forest meadow', baseHp: 27, power: 6, guard: 3,
    moves: [move('thunder_spark', 'Thunder Spark', 'Release a crackling electrical attack.', 8), move('charge', 'Charge', 'Recover up to 4 Focus and guard for this turn.', 4, 0, 'support'), move('lightning_leap', 'Lightning Leap', 'Spend 2 Focus on a powerful leaping attack.', 15, 2), move('static_mend', 'Static Mend', 'Recover 14 HP. Costs 3 Focus.', 14, 3, 'heal')],
  },
  creature_samplet: {
    id: 'creature_samplet', name: 'Samplet', role: 'Scouting and speed', type: 'Insight', color: '#8dd5c5', symbol: '🐾',
    description: 'A tiny forest scout often seen exploring sunny groves. Observing only moonlit paths can miss much of its activity.',
    habitat: "Twin Scholars' Forest", baseHp: 26, power: 6, guard: 3,
    moves: [...basics, move('scout_dash', 'Scout Dash', 'An energetic dash. Costs 2 Focus.', 14, 2)],
  },
  creature_bayowl: {
    id: 'creature_bayowl', name: 'Bayowl', role: 'Adaptive tactics', type: 'Insight', color: '#bda2e4', symbol: '🦉',
    description: 'An owl that thrives among moonlit trees. It changes its approach as new evidence arrives.',
    habitat: 'Forest lookout', baseHp: 30, power: 6, guard: 4,
    moves: [...basics, move('moon_arc', 'Moon Arc', 'A graceful arc of moonlight. Costs 2 Focus.', 14, 2)],
  },
};

const sightings = (samplet, voltkit, bayowl) => [
  { speciesId: 'creature_samplet', count: samplet },
  { speciesId: 'creature_voltkit', count: voltkit },
  { speciesId: 'creature_bayowl', count: bayowl },
].filter(row => row.count > 0);
export const HABITATS = [
  { id: 'habitat_meadow', title: 'Sunlit Meadow', description: 'Sunlight falls through the leaves beside an old observation post.', observations: { day: sightings(8, 2, 0), night: sightings(1, 1, 5) } },
  { id: 'habitat_riverbank', title: 'Riverbank', description: 'Open grassland beside the river rings with the hum of electrical Flow.', observations: { day: sightings(3, 7, 0), night: sightings(0, 2, 3) } },
  { id: 'habitat_canopy', title: 'High Canopy', description: 'A quiet ridge offers a view across the forest canopy.', observations: { day: sightings(5, 3, 1), night: sightings(1, 1, 8) } },
].map(habitat => ({ ...habitat, day: habitat.observations.day, night: habitat.observations.night }));
const STARTERS = ['creature_statifox', 'creature_algobear', 'creature_terradeer'];
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const CONCEPTS = ['concept_observation', 'concept_sampling_bias'];
const LEGACY_FLAGS = ['introSeen', 'rivalDefeated', 'recruitedVoltkit', 'compass'];
const GAME_FLAGS = [...LEGACY_FLAGS, 'reportedToLyra'];

export function createGame() {
  return {
    schemaVersion: SCHEMA_VERSION,
    player: { name: 'Observer', x: 16, y: 15, facing: 'down' },
    map: 'village', time: 'day', starter: null, party: [],
    inventory: { potions: 3, bondCrystals: 5 },
    dex: {
      species: Object.fromEntries(Object.keys(SPECIES).map(id => [id, { seen: false, recruited: false, scans: 0, observations: [] }])),
      concepts: Object.fromEntries(CONCEPTS.map(id => [id, 'unknown'])),
    },
    quests: { firstBond: { status: 'locked' }, nocturnal: { status: 'locked', observations: [], attempts: 0, hints: 0 } },
    battle: null,
    flags: { introSeen: false, rivalDefeated: false, recruitedVoltkit: false, compass: false, reportedToLyra: false },
    coins: 0, researchPoints: 0,
  };
}

function fail(message) { throw new Error(message); }
function ensure(condition, message) { if (!condition) fail(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function creature(speciesId, level, uid) {
  const maxHp = SPECIES[speciesId].baseHp + level * 3;
  return { uid, speciesId, hp: maxHp, maxHp, focus: 8, level, xp: 0 };
}
function trackSeen(state, id) { state.dex.species[id].seen = true; }
function advanceConcept(state, id, status) {
  const stages = ['unknown', 'encountered', 'understood', 'mastered'];
  if (stages.indexOf(status) > stages.indexOf(state.dex.concepts[id])) state.dex.concepts[id] = status;
}
function restoreParty(state) {
  state.party.forEach(member => { member.hp = member.maxHp; member.focus = 8; });
}
function activeMember(state) { return state.party[state.battle.activeIndex]; }
function requireBattle(state) { ensure(state.battle, 'There is no active battle.'); }
function requirePeace(state) { ensure(!state.battle, 'Finish or flee the battle first.'); }
function recordDexObservation(state, speciesId, observation) {
  const entry = state.dex.species[speciesId];
  entry.seen = true;
  if (!entry.observations.includes(observation)) {
    entry.observations.push(observation);
    if (entry.observations.length > 32) entry.observations.shift();
  }
}
function battler(member, side) {
  return { name: SPECIES[member.speciesId].name, speciesId: member.speciesId, side };
}
function trainer(state) { return { name: state.player.name, side: 'player' }; }
function battleName(participant) {
  return `${participant.side === 'enemy' ? 'Enemy' : 'Your'} ${participant.name}`;
}
function addLog(state, events, message, details) {
  events.push(message);
  if (state.battle) {
    state.battle.log.push({ text: message, turn: state.battle.turn, ...details });
    if (state.battle.log.length > 50) state.battle.log.shift();
  }
}
function awardVictory(state, events, bonded = false) {
  const battle = state.battle;
  const firstRivalWin = battle.kind === 'rival' && !state.flags.rivalDefeated;
  const member = activeMember(state);
  addLog(state, events, bonded ? 'Bond complete. Your team welcomes its new partner.' : 'Your team wins the battle!', {
    side: 'system', type: 'status', actor: null, target: null, action: bonded ? 'Bond complete' : 'Victory',
  });
  member.xp += battle.kind === 'rival' ? 30 : 18;
  while (member.level < 50 && member.xp >= member.level * 20) {
    member.xp -= member.level * 20;
    member.level += 1;
    member.maxHp += 3;
    member.hp = Math.min(member.maxHp, member.hp + 8);
    const actor = battler(member, 'player');
    addLog(state, events, `${battleName(actor)} reached level ${member.level}!`, {
      side: 'player', type: 'status', actor, target: actor, action: 'Level up',
    });
  }
  state.coins += battle.kind === 'rival' ? 30 : 12;
  if (battle.kind === 'rival') {
    state.flags.rivalDefeated = true;
    state.quests.firstBond.status = 'complete';
    restoreParty(state);
    events.push(firstRivalWin ? 'Kai: You and your partner make a great team. The forest gate is open!' : 'Kai: Good match! Your team has been healed.');
  } else if (!bonded) {
    events.push('Voltkit slipped back into the grass. Another encounter is always available; try scanning and weakening it before bonding.');
  }
  state.battle = null;
}
function damage(attacker, defender, power, guarded = false) {
  const strength = SPECIES[attacker.speciesId].power + Math.floor(attacker.level / 3);
  const armor = Math.floor(SPECIES[defender.speciesId].guard / 2);
  const hit = Math.max(3, strength + power - armor);
  return guarded ? Math.max(1, Math.floor(hit / 2)) : hit;
}
function enemyTurn(state, events) {
  const battle = state.battle;
  if (!battle) return;
  const enemy = battle.enemy;
  let member = activeMember(state);
  const actor = battler(enemy, 'enemy');
  // A visible repeating sequence supports observation without claiming fixed probabilities.
  const allMoves = SPECIES[enemy.speciesId].moves;
  const charging = battle.turn % 3 === 0;
  let chosen = charging ? allMoves.find(move => move.kind === 'support') : allMoves.find(move => move.kind === 'attack');
  if (!charging && battle.turn % 3 === 1 && enemy.focus >= 2) chosen = allMoves.find(move => move.kind === 'attack' && move.cost === 2) || chosen;
  battle.enemyHistory.push({ turn: battle.turn, moveId: chosen.id, name: chosen.name });
  if (battle.enemyHistory.length > 30) battle.enemyHistory.shift();
  if (chosen.kind === 'support') {
    const recovered = Math.min(4, 8 - enemy.focus);
    enemy.focus = Math.min(8, enemy.focus + 4);
    battle.enemyGuarded = true;
    addLog(state, events, `${battleName(actor)} used ${chosen.name}, recovered ${recovered} Focus, and guards against the next attack.`, {
      side: 'enemy', type: 'status', actor, target: actor, action: chosen.name, focus: recovered, guarded: true,
    });
  } else {
    enemy.focus = Math.max(0, enemy.focus - chosen.cost);
    const hit = Math.max(2, Math.floor(damage(enemy, member, chosen.power, battle.guarded) * (battle.kind === 'rival' ? 0.62 : 0.57)));
    const lost = Math.min(member.hp, hit);
    member.hp = Math.max(0, member.hp - hit);
    const target = battler(member, 'player');
    addLog(state, events, `${battleName(actor)} used ${chosen.name} on ${battleName(target)}. ${battleName(target)} lost ${lost} HP${battle.guarded ? ' (guarded)' : ''}.`, {
      side: 'enemy', type: 'damage', actor, target, action: chosen.name, amount: lost, guarded: battle.guarded,
    });
  }
  battle.guarded = false;
  if (member.hp === 0) {
    const fainted = battler(member, 'player');
    addLog(state, events, `${battleName(fainted)} has fainted.`, {
      side: 'player', type: 'faint', actor: fainted, target: fainted, action: 'Fainted',
    });
    const replacement = state.party.findIndex(candidate => candidate.hp > 0);
    if (replacement >= 0) {
      battle.activeIndex = replacement;
      member = activeMember(state);
      const target = battler(member, 'player');
      addLog(state, events, `${battleName(target)} replaces ${battleName(fainted)} and takes the field.`, {
        side: 'player', type: 'switch', actor: fainted, target, action: 'Automatic switch',
      });
    } else {
      addLog(state, events, 'Your team has been defeated. Lyra brings everyone to the sanctuary to recover.', {
        side: 'system', type: 'status', actor: null, target: null, action: 'Defeat',
      });
      events.push('Your team needs rest. Lyra brings you to the sanctuary; everyone has been healed. You can try again.');
      restoreParty(state);
      state.map = 'village';
      state.player.x = 16;
      state.player.y = 13;
      state.battle = null;
    }
  }
  battle.turn += 1;
}

export function act(currentState, action, rng = Math.random) {
  validateGame(currentState);
  ensure(action && typeof action === 'object' && typeof action.type === 'string', 'Choose a valid game action.');
  const state = clone(currentState);
  // Keep the final timeline available after an outcome clears the active battle.
  const previousBattle = state.battle;
  const events = [];
  switch (action.type) {
    case 'SET_NAME': {
      requirePeace(state);
      ensure(typeof action.name === 'string', 'Your name must be text.');
      const name = action.name.trim();
      ensure(name.length >= 1 && name.length <= 24, 'Choose a name between 1 and 24 characters.');
      state.player.name = name;
      state.flags.introSeen = true;
      events.push(`Welcome to Harvest Village, ${name}.`);
      break;
    }
    case 'CHOOSE_STARTER': {
      requirePeace(state);
      ensure(!state.starter, 'You have already chosen your first partner.');
      ensure(STARTERS.includes(action.speciesId), 'Choose one of the three starter Databeasts.');
      state.starter = action.speciesId;
      state.party.push(creature(action.speciesId, 5, `partner-${action.speciesId}`));
      state.dex.species[action.speciesId].seen = true;
      state.dex.species[action.speciesId].recruited = true;
      advanceConcept(state, 'concept_observation', 'encountered');
      state.flags.introSeen = true;
      state.quests.firstBond.status = 'active';
      events.push(`${SPECIES[action.speciesId].name} joins your adventure. Speak to Kai for your first battle.`);
      break;
    }
    case 'MOVE': {
      requirePeace(state);
      ensure(integer(action.x, 0, 31) && integer(action.y, 0, 21), 'That position is outside the map.');
      ensure(DIRECTIONS.includes(action.facing || state.player.facing), 'Choose a valid direction.');
      const map = action.map || state.map;
      ensure(['village', 'forest'].includes(map), 'That map is unavailable.');
      ensure(map !== 'forest' || state.flags.rivalDefeated, 'Battle Kai before entering the forest.');
      state.player.x = action.x;
      state.player.y = action.y;
      state.player.facing = action.facing || state.player.facing;
      state.map = map;
      break;
    }
    case 'SET_TIME': {
      requirePeace(state);
      ensure(['day', 'night'].includes(action.time), 'Choose day or night.');
      state.time = action.time;
      events.push(action.time === 'night' ? 'The forest settles under a quiet moon.' : 'Morning light reveals a different forest.');
      break;
    }
    case 'START_BATTLE': {
      requirePeace(state);
      ensure(state.starter, 'Choose a starter with Professor Lyra first.');
      ensure(['rival', 'wild'].includes(action.kind), 'Choose a rival or wild encounter.');
      ensure(action.kind !== 'wild' || state.flags.rivalDefeated, 'Complete Kai’s introduction battle first.');
      ensure(action.kind !== 'wild' || !state.flags.recruitedVoltkit, 'Voltkit already joined your team.');
      const index = state.party.findIndex(member => member.hp > 0);
      ensure(index >= 0, 'Rest at the sanctuary before battling.');
      const speciesId = action.kind === 'wild' ? 'creature_voltkit' : STARTERS[(STARTERS.indexOf(state.starter) + 1) % STARTERS.length];
      state.battle = { kind: action.kind, enemy: creature(speciesId, action.kind === 'rival' ? 5 : 4, `enemy-${speciesId}`), activeIndex: index, turn: 1, scanned: false, log: [], enemyHistory: [], guarded: false, enemyGuarded: false, bondAttempts: 0 };
      trackSeen(state, speciesId);
      addLog(state, events, action.kind === 'rival' ? `Kai challenges you with ${SPECIES[speciesId].name}!` : 'A curious wild Voltkit appears!', {
        side: 'system', type: 'intro', actor: null, target: battler(state.battle.enemy, 'enemy'), action: 'Encounter',
      });
      break;
    }
    case 'BATTLE_SCAN': {
      requireBattle(state);
      ensure(!state.battle.scanned, 'You have already scanned this encounter. Scanning costs no turn.');
      const battle = state.battle;
      battle.scanned = true;
      state.dex.species[battle.enemy.speciesId].scans += 1;
      advanceConcept(state, 'concept_observation', 'understood');
      state.researchPoints += 2;
      const names = battle.enemyHistory.map(row => row.name);
      const summary = names.length ? `Observed actions: ${names.join(', ')}. These observations describe this encounter; they do not establish the probability of the next move.` : 'No enemy actions observed yet. Watch its behavior; a small record cannot guarantee its next move.';
      recordDexObservation(state, battle.enemy.speciesId, summary);
      const actor = trainer(state);
      const target = battler(battle.enemy, 'enemy');
      addLog(state, events, `${actor.name} scanned ${battleName(target)} with the DataDex. ${summary} A weakened, scanned wild creature is easier to bond with. No turn consumed.`, {
        side: 'player', type: 'scan', actor, target, action: 'DataDex scan',
      });
      break;
    }
    case 'BATTLE_MOVE': {
      requireBattle(state);
      const member = activeMember(state);
      const chosen = SPECIES[member.speciesId].moves.find(move => move.id === action.moveId);
      ensure(chosen, 'That Databeast does not know this move.');
      ensure(member.focus >= chosen.cost, 'Not enough Focus. Guard or use Focus Field to recover it.');
      member.focus -= chosen.cost;
      const actor = battler(member, 'player');
      if (chosen.kind === 'attack') {
        const battle = state.battle;
        const hit = damage(member, battle.enemy, chosen.power, battle.enemyGuarded);
        const lost = Math.min(battle.enemy.hp, hit);
        const target = battler(battle.enemy, 'enemy');
        battle.enemy.hp = Math.max(0, battle.enemy.hp - hit);
        addLog(state, events, `${battleName(actor)} used ${chosen.name} on ${battleName(target)}. ${battleName(target)} lost ${lost} HP${battle.enemyGuarded ? ' (guarded)' : ''}.`, {
          side: 'player', type: 'damage', actor, target, action: chosen.name, amount: lost, guarded: battle.enemyGuarded,
        });
        battle.enemyGuarded = false;
        if (battle.enemy.hp === 0) {
          addLog(state, events, `${battleName(target)} has fainted.`, {
            side: 'enemy', type: 'faint', actor: target, target, action: 'Fainted',
          });
          awardVictory(state, events);
          break;
        }
      } else if (chosen.kind === 'heal') {
        const restored = Math.min(chosen.power, member.maxHp - member.hp);
        member.hp += restored;
        addLog(state, events, `${battleName(actor)} used ${chosen.name} and restored ${restored} HP to ${battleName(actor)}.`, {
          side: 'player', type: 'heal', actor, target: actor, action: chosen.name, amount: restored,
        });
      } else {
        const recovered = Math.min(chosen.power, 8 - member.focus);
        member.focus = Math.min(8, member.focus + chosen.power);
        state.battle.guarded = true;
        addLog(state, events, `${battleName(actor)} used ${chosen.name}, recovered ${recovered} Focus, and guards against the next attack.`, {
          side: 'player', type: 'status', actor, target: actor, action: chosen.name, focus: recovered, guarded: true,
        });
      }
      enemyTurn(state, events);
      break;
    }
    case 'BATTLE_GUARD': {
      requireBattle(state);
      const member = activeMember(state);
      const recovered = Math.min(3, 8 - member.focus);
      const actor = battler(member, 'player');
      member.focus = Math.min(8, member.focus + 3);
      state.battle.guarded = true;
      addLog(state, events, `${battleName(actor)} guards against the next attack and recovers ${recovered} Focus.`, {
        side: 'player', type: 'status', actor, target: actor, action: 'Guard', focus: recovered, guarded: true,
      });
      enemyTurn(state, events);
      break;
    }
    case 'BATTLE_SWITCH': {
      requireBattle(state);
      ensure(Number.isInteger(action.index) && state.party[action.index] && state.party[action.index].hp > 0, 'Choose a healthy party member.');
      ensure(action.index !== state.battle.activeIndex, 'That partner is already active.');
      const actor = battler(activeMember(state), 'player');
      state.battle.activeIndex = action.index;
      const target = battler(activeMember(state), 'player');
      addLog(state, events, `${battleName(actor)} switches out for ${battleName(target)}. ${battleName(target)} takes the field.`, {
        side: 'player', type: 'switch', actor, target, action: 'Switch',
      });
      enemyTurn(state, events);
      break;
    }
    case 'BATTLE_POTION': {
      requireBattle(state);
      ensure(state.inventory.potions > 0, 'No potions left. The sanctuary can restock your supplies.');
      const member = activeMember(state);
      ensure(member.hp < member.maxHp, 'Your partner already has full HP.');
      const restored = Math.min(30, member.maxHp - member.hp);
      state.inventory.potions -= 1;
      member.hp += restored;
      const actor = trainer(state);
      const target = battler(member, 'player');
      addLog(state, events, `${actor.name} used a Potion on ${battleName(target)}, restoring ${restored} HP.`, {
        side: 'player', type: 'heal', actor, target, action: 'Potion', amount: restored,
      });
      enemyTurn(state, events);
      break;
    }
    case 'BATTLE_BOND': {
      requireBattle(state);
      const battle = state.battle;
      ensure(battle.kind === 'wild', 'Kai’s partner cannot be recruited.');
      ensure(state.party.length < 4, 'Your active party is full.');
      ensure(state.inventory.bondCrystals > 0, 'No Bond Crystals left. Restock at the sanctuary and try again.');
      ensure(typeof rng === 'function', 'A valid random source is required.');
      const roll = rng();
      ensure(Number.isFinite(roll) && roll >= 0 && roll < 1, 'Random values must be between 0 and 1.');
      const weakened = 1 - battle.enemy.hp / battle.enemy.maxHp;
      const chance = Math.min(1, 0.15 + weakened * 0.60 + (battle.scanned ? 0.25 : 0) + battle.bondAttempts * 0.22);
      const actor = trainer(state);
      const target = battler(battle.enemy, 'enemy');
      state.inventory.bondCrystals -= 1;
      battle.bondAttempts += 1;
      if (roll < chance) {
        const recruit = creature(battle.enemy.speciesId, battle.enemy.level, `bond-${battle.enemy.speciesId}`);
        state.party.push(recruit);
        state.dex.species[recruit.speciesId].recruited = true;
        state.flags.recruitedVoltkit = true;
        state.researchPoints += 5;
        addLog(state, events, `${actor.name} offered a Bond Crystal to ${battleName(target)}. Voltkit accepts your Bond Crystal and joins the team! Its health and Focus are restored.`, {
          side: 'player', type: 'bond', actor, target, action: 'Bond accepted',
        });
        awardVictory(state, events, true);
      } else {
        addLog(state, events, `${actor.name} offered a Bond Crystal to ${battleName(target)}. ${battleName(target)} hesitates. Weaken it and scan; each patient bonding attempt also improves trust.`, {
          side: 'player', type: 'bond', actor, target, action: 'Bond attempt',
        });
        enemyTurn(state, events);
      }
      break;
    }
    case 'BATTLE_FLEE': {
      requireBattle(state);
      ensure(state.battle.kind === 'wild', 'Finish the friendly battle with Kai.');
      addLog(state, events, 'You step away safely. The wild encounter can be tried again.', {
        side: 'system', type: 'status', actor: null, target: null, action: 'Escaped',
      });
      state.battle = null;
      break;
    }
    case 'HEAL_PARTY': {
      requirePeace(state);
      ensure(state.map === 'village', 'Visit the Research Sanctuary in Harvest Village to heal.');
      restoreParty(state);
      events.push('The sanctuary restores your team’s HP and Focus.');
      break;
    }
    case 'RESTOCK': {
      requirePeace(state);
      ensure(state.map === 'village', 'Visit the Research Sanctuary in Harvest Village to restock.');
      state.inventory.potions = Math.max(3, state.inventory.potions);
      state.inventory.bondCrystals = Math.max(5, state.inventory.bondCrystals);
      events.push('Lyra replenishes your supplies: at least 3 potions and 5 Bond Crystals.');
      break;
    }
    case 'START_INVESTIGATION': {
      requirePeace(state);
      ensure(state.flags.rivalDefeated, 'Complete your first battle with Kai before taking the forest assignment.');
      ensure(state.map === 'forest', "Meet Professor Inferra in Twin Scholars' Forest to begin the investigation.");
      ensure(state.quests.nocturnal.status === 'locked', 'The investigation has already begun.');
      state.quests.nocturnal.status = 'active';
      advanceConcept(state, 'concept_sampling_bias', 'encountered');
      events.push('Inferra: The ranger only visited at night. Observe all three habitats by day and by night before deciding whether nearly every forest Databeast is nocturnal.');
      break;
    }
    case 'OBSERVE': {
      requirePeace(state);
      const quest = state.quests.nocturnal;
      ensure(['active', 'ready'].includes(quest.status), 'Start the Nocturnal Mystery with Professor Inferra first.');
      ensure(state.map === 'forest', 'Travel to Twin Scholars’ Forest to observe a habitat.');
      const habitat = HABITATS.find(row => row.id === action.habitatId);
      ensure(habitat, 'Choose a known forest habitat.');
      ensure(!quest.observations.some(row => row.habitatId === habitat.id && row.time === state.time), 'This habitat and time have already been recorded. Visit a different habitat or change the time.');
      const rows = clone(habitat.observations[state.time]);
      quest.observations.push({ habitatId: habitat.id, time: state.time, sightings: rows, total: rows.reduce((total, row) => total + row.count, 0) });
      rows.forEach(row => recordDexObservation(state, row.speciesId, `${habitat.title}, ${state.time}: ${row.count} sightings in this observation session.`));
      state.researchPoints += 3;
      advanceConcept(state, 'concept_observation', 'understood');
      events.push(`Recorded ${habitat.title} by ${state.time}: ${rows.map(row => `${row.count} ${SPECIES[row.speciesId].name}`).join(', ')}.`);
      if (quest.observations.length === 6) {
        quest.status = 'ready';
        events.push('All six habitat/time categories are recorded. Return to Inferra and compare the evidence.');
      }
      break;
    }
    case 'SUBMIT_FINDING': {
      requirePeace(state);
      const quest = state.quests.nocturnal;
      ensure(quest.status === 'ready' && quest.observations.length === 6, 'Collect observations from all three habitats during both day and night first.');
      ensure(['biased', 'nocturnal', 'certain'].includes(action.answer), 'Choose a finding from the available evidence.');
      quest.attempts += 1;
      if (action.answer === 'biased') {
        quest.status = 'complete';
        state.flags.compass = true;
        advanceConcept(state, 'concept_sampling_bias', 'understood');
        state.researchPoints += 20;
        state.coins += 40;
        events.push('Inferra: The original night-only sample excluded daytime activity. Your broader observations challenge the claim, but do not prove every creature’s behavior. You earned the Sampling Compass!');
      } else {
        events.push(action.answer === 'nocturnal' ? 'Inferra: Look at the daytime records. Does a night-only sample describe the whole forest? You can revise your finding.' : 'Inferra: These observations give useful evidence, not certainty about every creature or future sighting. You can revise your finding.');
      }
      break;
    }
    case 'REPORT_FINDINGS': {
      requirePeace(state);
      ensure(state.map === 'village', 'Return to Professor Lyra in Harvest Village to deliver your findings.');
      ensure(state.quests.nocturnal.status === 'complete', 'Finish the Nocturnal Mystery with Professor Inferra before reporting your findings.');
      ensure(!state.flags.reportedToLyra, 'You have already reported your findings to Professor Lyra.');
      state.flags.reportedToLyra = true;
      events.push('Lyra: Your forest records show why we must check who and what our observations leave out. We will compare local rain measurements with the Oracle forecast and collect evidence across places and times.');
      events.push('Field report delivered. Harvest Village has a plan, and your Stage 1 main story is complete. Optional recruitment and DataDex reflection remain available.');
      break;
    }
    case 'REQUEST_HINT': {
      requirePeace(state);
      const quest = state.quests.nocturnal;
      ensure(['active', 'ready'].includes(quest.status), 'Begin the investigation before requesting a hint.');
      quest.hints += 1;
      const missing = HABITATS.flatMap(habitat => ['day', 'night'].filter(time => !quest.observations.some(row => row.habitatId === habitat.id && row.time === time)).map(time => `${habitat.title} (${time})`));
      events.push(missing.length ? `Inferra: Check the categories missing from your sample: ${missing.join(', ')}.` : 'Inferra: The ranger recorded only at night. Compare those records with what you saw during the day. Which activities were excluded?');
      break;
    }
    case 'MASTER_CONCEPT': {
      requirePeace(state);
      ensure(state.quests.nocturnal.status === 'complete', 'Finish the Nocturnal Mystery before the optional DataDex reflection.');
      if (state.dex.concepts.concept_sampling_bias === 'mastered') {
        events.push('You have already mastered this concept. Keep collecting representative observations.');
        break;
      }
      ensure(typeof action.answer === 'string' && action.answer.length <= 80, 'Choose a valid reflection answer.');
      if (action.answer === 'representative') {
        advanceConcept(state, 'concept_sampling_bias', 'mastered');
        advanceConcept(state, 'concept_observation', 'mastered');
        state.researchPoints += 10;
        events.push('DataDex mastery: A representative sample includes the relevant habitats and times. More observations help, but where and when you collect them matters too.');
      } else events.push('DataDex: Collect evidence across the relevant habitats and times. A large night-only sample can still miss daytime creatures. Try again.');
      break;
    }
    default: fail(`Unknown game action: ${action.type}.`);
  }
  validateGame(state);
  const battle = state.battle || previousBattle;
  return battle ? { state, events, battleEvents: clone(battle.log) } : { state, events };
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const textValue = (value, max = 500) => typeof value === 'string' && value.length <= max;
function keysExactly(value, keys) { return isObject(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function validateCreature(value) {
  ensure(keysExactly(value, ['uid', 'speciesId', 'hp', 'maxHp', 'focus', 'level', 'xp']), 'Invalid creature record.');
  ensure(textValue(value.uid, 80) && value.uid.length > 0 && Object.hasOwn(SPECIES, value.speciesId), 'Invalid creature identity.');
  ensure(integer(value.level, 1, 50) && value.maxHp === SPECIES[value.speciesId].baseHp + value.level * 3, 'Invalid creature level or maximum HP.');
  ensure(integer(value.hp, 0, value.maxHp) && integer(value.focus, 0, 8) && integer(value.xp, 0, 100000), 'Invalid creature health, Focus, or XP.');
}
function validateParticipant(value, state) {
  ensure(isObject(value) && (keysExactly(value, ['name', 'side']) || keysExactly(value, ['name', 'speciesId', 'side'])), 'Invalid battle participant.');
  ensure(['player', 'enemy'].includes(value.side) && textValue(value.name, 80) && value.name.trim().length > 0, 'Invalid battle participant.');
  if (Object.hasOwn(value, 'speciesId')) {
    ensure(Object.hasOwn(SPECIES, value.speciesId) && value.name === SPECIES[value.speciesId].name, 'Invalid battle participant species.');
  } else {
    ensure(value.side === 'player' && value.name === state.player.name, 'Invalid battle trainer.');
  }
}
function validateBattleLogRow(row, state) {
  // Original v1 saves stored plain strings. They remain readable beside new events.
  if (typeof row === 'string') {
    ensure(textValue(row, 2000), 'Invalid battle log.');
    return;
  }
  const required = ['text', 'turn', 'side', 'type', 'actor', 'target', 'action'];
  const optional = ['amount', 'focus', 'guarded'];
  ensure(isObject(row) && required.every(key => Object.hasOwn(row, key)) && Object.keys(row).every(key => required.includes(key) || optional.includes(key)), 'Invalid battle log fields.');
  ensure(textValue(row.text, 2000) && row.text.trim().length > 0 && textValue(row.action, 80) && row.action.trim().length > 0 && integer(row.turn, 1, state.battle.turn), 'Invalid battle log text or turn.');
  ensure(['player', 'enemy', 'system'].includes(row.side) && ['damage', 'heal', 'status', 'scan', 'switch', 'bond', 'faint', 'intro'].includes(row.type), 'Invalid battle log category.');
  if (row.actor !== null) validateParticipant(row.actor, state);
  if (row.target !== null) validateParticipant(row.target, state);
  ensure(row.side === 'system' ? row.actor === null : row.actor !== null && row.actor.side === row.side, 'Invalid battle log actor side.');
  ensure(row.side !== 'system' || ['intro', 'status'].includes(row.type), 'Invalid system battle event.');
  ensure(row.side === 'system' || row.target !== null, 'Battle action is missing its target.');
  if (row.type === 'intro') ensure(row.side === 'system' && row.target?.side === 'enemy' && row.target.speciesId, 'Invalid battle introduction.');
  if (['damage', 'heal'].includes(row.type)) {
    ensure(row.actor && row.target?.speciesId && integer(row.amount, 0, SPECIES[row.target.speciesId].baseHp + 150), 'Invalid battle health change.');
    if (row.type === 'damage') ensure(row.actor.speciesId && row.actor.side !== row.target.side, 'Invalid damage participants.');
    if (row.type === 'heal') ensure(row.side === 'player' && row.target.side === 'player', 'Invalid healing participants.');
  } else ensure(!Object.hasOwn(row, 'amount'), 'Unexpected battle health change.');
  if (Object.hasOwn(row, 'focus')) ensure(row.type === 'status' && row.actor?.speciesId && integer(row.focus, 0, 8), 'Invalid battle Focus change.');
  if (Object.hasOwn(row, 'guarded')) ensure(['damage', 'status'].includes(row.type) && typeof row.guarded === 'boolean', 'Invalid battle guard status.');
  if (['scan', 'bond'].includes(row.type)) ensure(row.side === 'player' && row.target?.side === 'enemy' && row.target.speciesId, 'Invalid enemy interaction.');
  if (row.type === 'switch') ensure(row.side === 'player' && row.actor?.speciesId && row.target?.side === 'player' && row.target.speciesId, 'Invalid battle switch.');
  if (row.type === 'faint') ensure(row.actor?.speciesId && JSON.stringify(row.actor) === JSON.stringify(row.target), 'Invalid fainted participant.');
}
function validateGame(state) {
  ensure(keysExactly(state, ['schemaVersion', 'player', 'map', 'time', 'starter', 'party', 'inventory', 'dex', 'quests', 'battle', 'flags', 'coins', 'researchPoints']), 'Invalid save: game fields are missing or unexpected.');
  ensure(state.schemaVersion === SCHEMA_VERSION, 'This save version is not supported.');
  ensure(keysExactly(state.player, ['name', 'x', 'y', 'facing']) && textValue(state.player.name, 24) && state.player.name.trim().length > 0, 'Invalid player record.');
  ensure(integer(state.player.x, 0, 31) && integer(state.player.y, 0, 21) && DIRECTIONS.includes(state.player.facing), 'Invalid player position.');
  ensure(['village', 'forest'].includes(state.map) && ['day', 'night'].includes(state.time), 'Invalid map or time.');
  ensure(state.starter === null || STARTERS.includes(state.starter), 'Invalid starter.');
  ensure(Array.isArray(state.party) && state.party.length <= 4, 'Invalid party.');
  state.party.forEach(validateCreature);
  ensure(new Set(state.party.map(member => member.uid)).size === state.party.length, 'Duplicate party member.');
  ensure(state.starter === null ? state.party.length === 0 : state.party.length > 0 && state.party[0].speciesId === state.starter, 'Starter and party do not match.');
  ensure(keysExactly(state.inventory, ['potions', 'bondCrystals']) && Object.values(state.inventory).every(value => integer(value, 0, 999)), 'Invalid inventory.');
  ensure(integer(state.coins, 0, 1000000) && integer(state.researchPoints, 0, 1000000), 'Invalid rewards.');
  ensure(keysExactly(state.dex, ['species', 'concepts']) && keysExactly(state.dex.species, Object.keys(SPECIES)) && keysExactly(state.dex.concepts, CONCEPTS), 'Invalid DataDex.');
  Object.entries(state.dex.species).forEach(([id, entry]) => {
    ensure(keysExactly(entry, ['seen', 'recruited', 'scans', 'observations']) && typeof entry.seen === 'boolean' && typeof entry.recruited === 'boolean' && integer(entry.scans, 0, 100000), 'Invalid DataDex species entry.');
    ensure(Array.isArray(entry.observations) && entry.observations.length <= 32 && entry.observations.every(row => textValue(row, 1500)), 'Invalid DataDex observations.');
    ensure(!entry.recruited || entry.seen, 'Recruited Databeasts must be seen.');
    ensure(!state.party.some(member => member.speciesId === id) || entry.recruited, 'Party member missing from DataDex.');
  });
  ensure(Object.values(state.dex.concepts).every(value => ['unknown', 'encountered', 'understood', 'mastered'].includes(value)), 'Invalid concept status.');
  ensure(keysExactly(state.flags, GAME_FLAGS) && Object.values(state.flags).every(value => typeof value === 'boolean'), 'Invalid game flags.');
  ensure(state.map !== 'forest' || state.flags.rivalDefeated, 'The forest has not been unlocked.');
  ensure(state.flags.recruitedVoltkit === state.party.some(member => member.speciesId === 'creature_voltkit'), 'Voltkit recruitment records do not match.');
  ensure(keysExactly(state.quests, ['firstBond', 'nocturnal']) && keysExactly(state.quests.firstBond, ['status']) && keysExactly(state.quests.nocturnal, ['status', 'observations', 'attempts', 'hints']), 'Invalid quest records.');
  ensure(['locked', 'active', 'complete'].includes(state.quests.firstBond.status), 'Invalid First Bond status.');
  ensure((state.quests.firstBond.status === 'locked') === (state.starter === null) && (state.quests.firstBond.status === 'complete') === state.flags.rivalDefeated, 'First Bond progression does not match.');
  const quest = state.quests.nocturnal;
  ensure(['locked', 'active', 'ready', 'complete'].includes(quest.status) && integer(quest.attempts, 0, 100000) && integer(quest.hints, 0, 100000), 'Invalid investigation status.');
  ensure(Array.isArray(quest.observations) && quest.observations.length <= 6, 'Invalid investigation observations.');
  const observed = new Set();
  quest.observations.forEach(row => {
    ensure(keysExactly(row, ['habitatId', 'time', 'sightings', 'total']), 'Invalid habitat observation.');
    const habitat = HABITATS.find(habitat => habitat.id === row.habitatId);
    ensure(habitat && ['day', 'night'].includes(row.time), 'Unknown observation category.');
    const expected = habitat.observations[row.time];
    ensure(JSON.stringify(row.sightings) === JSON.stringify(expected) && row.total === expected.reduce((sum, sighting) => sum + sighting.count, 0), 'Observation counts do not match the field record.');
    const key = `${row.habitatId}:${row.time}`;
    ensure(!observed.has(key), 'Duplicate habitat/time observation.');
    observed.add(key);
  });
  ensure(quest.status !== 'locked' || quest.observations.length === 0 && quest.attempts === 0 && quest.hints === 0, 'Locked investigation has progress.');
  ensure(!['ready', 'complete'].includes(quest.status) || quest.observations.length === 6, 'Investigation is missing observation categories.');
  ensure(quest.status !== 'active' || quest.observations.length < 6, 'Completed observations must be ready for review.');
  ensure(quest.status === 'locked' || state.flags.rivalDefeated, 'Investigation has not been unlocked.');
  ensure(state.flags.compass === (quest.status === 'complete'), 'Sampling Compass and investigation status do not match.');
  ensure(!state.flags.reportedToLyra || quest.status === 'complete', 'Findings cannot be reported before the investigation is complete.');
  if (state.battle !== null) {
    const battle = state.battle;
    ensure(keysExactly(battle, ['kind', 'enemy', 'activeIndex', 'turn', 'scanned', 'log', 'enemyHistory', 'guarded', 'enemyGuarded', 'bondAttempts']), 'Invalid battle record.');
    ensure(['rival', 'wild'].includes(battle.kind) && state.starter !== null, 'Invalid encounter type.');
    validateCreature(battle.enemy);
    ensure(battle.enemy.hp > 0 && integer(battle.activeIndex, 0, state.party.length - 1) && state.party[battle.activeIndex].hp > 0, 'Invalid active battler.');
    ensure(battle.kind !== 'wild' || battle.enemy.speciesId === 'creature_voltkit' && state.flags.rivalDefeated && !state.flags.recruitedVoltkit, 'Invalid wild encounter.');
    ensure(battle.kind !== 'rival' || battle.enemy.speciesId === STARTERS[(STARTERS.indexOf(state.starter) + 1) % STARTERS.length], 'Invalid rival partner.');
    ensure(integer(battle.turn, 1, 100000) && integer(battle.bondAttempts, 0, 100000) && ['scanned', 'guarded', 'enemyGuarded'].every(key => typeof battle[key] === 'boolean'), 'Invalid battle progress.');
    ensure(Array.isArray(battle.log) && battle.log.length <= 50, 'Invalid battle log.');
    let previousLogTurn = 1;
    battle.log.forEach(row => {
      validateBattleLogRow(row, state);
      if (typeof row !== 'string') {
        ensure(row.turn >= previousLogTurn, 'Battle events are out of order.');
        previousLogTurn = row.turn;
      }
    });
    ensure(Array.isArray(battle.enemyHistory) && battle.enemyHistory.length <= 30, 'Invalid enemy history.');
    battle.enemyHistory.forEach(row => ensure(keysExactly(row, ['turn', 'moveId', 'name']) && integer(row.turn, 1, battle.turn - 1) && SPECIES[battle.enemy.speciesId].moves.some(move => move.id === row.moveId && move.name === row.name), 'Invalid observed enemy action.'));
  }
}

export function serializeGame(state) {
  validateGame(state);
  const json = JSON.stringify(state);
  ensure(json.length <= SAVE_LIMIT, 'Save is too large.');
  return json;
}
export function parseGame(json) {
  ensure(typeof json === 'string' && json.length <= SAVE_LIMIT, 'Save must be text smaller than 128 KB.');
  let state;
  try { state = JSON.parse(json); } catch { fail('The save file is not valid JSON.'); }
  // Preserve existing v1 saves while accepting only the exact original flag schema.
  if (isObject(state) && state.schemaVersion === SCHEMA_VERSION && keysExactly(state.flags, LEGACY_FLAGS)) {
    state = { ...state, flags: { ...state.flags, reportedToLyra: false } };
  }
  validateGame(state);
  return state;
}
export function saveGame(state, storage = globalThis.localStorage) {
  ensure(storage && typeof storage.setItem === 'function', 'Save storage is unavailable.');
  storage.setItem(SAVE_KEY, serializeGame(state));
  return true;
}
export function loadGame(storage = globalThis.localStorage) {
  // Missing, corrupt, or inaccessible local saves never prevent starting the game.
  try {
    if (!storage || typeof storage.getItem !== 'function') return null;
    const json = storage.getItem(SAVE_KEY);
    return json === null ? null : parseGame(json);
  } catch { return null; }
}
