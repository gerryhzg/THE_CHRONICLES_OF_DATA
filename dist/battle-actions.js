import { SPECIES } from './engine.js';

const TURN = '1 turn · enemy replies unless battle ends';
const FREE = 'Free · no turn consumed';

function descriptor(fields, unavailableReason = '') {
  return { ...fields, unavailableReason, available: unavailableReason === '' };
}

// A read-only description of engine actions. Selecting a card never performs it.
export function getBattleActions(state) {
  if (!state?.battle) return [];
  const battle = state.battle;
  const member = state.party[battle.activeIndex];
  const species = SPECIES[member.speciesId];
  const enemyName = SPECIES[battle.enemy.speciesId].name;
  const missingHp = member.maxHp - member.hp;
  const moves = species.moves.map(move => {
    const healing = Math.min(move.power, missingHp);
    const focus = Math.min(move.power, 8 - member.focus + move.cost);
    let effect;
    let limitation;
    if (move.kind === 'attack') {
      effect = `Power ${move.power} attack against enemy ${enemyName}.`;
      limitation = battle.enemyGuarded
        ? `Enemy ${enemyName} is guarding, reducing the next hit.`
        : 'HP loss depends on Databeast stats and the target’s guard.';
    } else if (move.kind === 'heal') {
      effect = `Restore ${healing} HP to your ${species.name} (up to ${move.power} HP).`;
      limitation = missingHp === 0
        ? `${species.name} already has full HP. This move will restore 0 HP.`
        : `Healing stops at ${member.maxHp} HP.`;
    } else {
      effect = `Recover ${focus} Focus for your ${species.name}. Guard for this turn.`;
      limitation = 'Focus caps at 8. Guard reduces damage and expires after the enemy reply, even if the enemy supports.';
    }
    return descriptor({
      key: `move:${move.id}`, group: 'skills', label: move.name,
      category: move.kind === 'attack' ? 'Attack' : move.kind === 'heal' ? 'Healing' : 'Support',
      description: move.description, effect,
      cost: move.cost ? `${move.cost} Focus` : 'No Focus cost',
      turn: TURN, limitation,
      action: { type: 'BATTLE_MOVE', moveId: move.id },
    }, member.focus < move.cost ? `Needs ${move.cost} Focus; ${species.name} has ${member.focus}.` : '');
  });

  const commands = [
    descriptor({
      key: 'guard', group: 'commands', label: 'Guard', category: 'Guard',
      description: 'Brace your active Databeast and recover Focus.',
      effect: `Your ${species.name} recovers ${Math.min(3, 8 - member.focus)} Focus and guards for this turn.`,
      cost: 'No item or Focus cost', turn: TURN,
      limitation: 'Focus caps at 8. Guard expires after the next enemy action, including a support move.',
      action: { type: 'BATTLE_GUARD' },
    }),
    descriptor({
      key: 'scan', group: 'commands', label: 'DataDex Scan', category: 'Scan',
      description: 'Record the enemy’s observed actions and learn about this encounter.',
      effect: `Scan enemy ${enemyName}; a scanned wild Databeast is easier to bond with.`,
      cost: 'No item or Focus cost', turn: FREE,
      limitation: 'Once per encounter. Observed actions do not guarantee the next move.',
      action: { type: 'BATTLE_SCAN' },
    }, battle.scanned ? 'This encounter has already been scanned.' : ''),
    descriptor({
      key: 'potion', group: 'commands', label: 'Potion', category: 'Item',
      description: 'Use a potion on your active Databeast.',
      effect: `Restore ${Math.min(30, missingHp)} HP to your ${species.name} (up to 30 HP).`,
      cost: `1 Potion · ${state.inventory.potions} left`, turn: TURN,
      limitation: `Healing stops at ${member.maxHp} HP. Visit the sanctuary to restock.`,
      action: { type: 'BATTLE_POTION' },
    }, state.inventory.potions === 0
      ? 'No potions left. Restock at the sanctuary.'
      : missingHp === 0 ? `${species.name} already has full HP.` : ''),
    descriptor({
      key: 'bond', group: 'commands', label: 'Bond Crystal', category: 'Bond',
      description: 'Offer a crystal to invite a wild Databeast onto your team.',
      effect: `Try to bond with enemy ${enemyName}. Acceptance ends the battle and restores your new partner.`,
      cost: `1 Bond Crystal · ${state.inventory.bondCrystals} left`, turn: TURN,
      limitation: 'Wild encounters only. Weaken and scan the target to improve trust; patient repeat attempts help too. A failed attempt still uses a crystal and allows an enemy reply. Party limit: 4.',
      action: { type: 'BATTLE_BOND' },
    }, battle.kind !== 'wild'
      ? 'Kai’s partner cannot be recruited. Bonding is for wild encounters.'
      : state.party.length >= 4 ? 'Your party is full (4 Databeasts).'
        : state.inventory.bondCrystals === 0 ? 'No Bond Crystals left. Restock at the sanctuary.' : ''),
    descriptor({
      key: 'flee', group: 'commands', label: 'Leave Battle', category: 'Leave',
      description: 'Step away safely from a wild encounter.',
      effect: `Leave enemy ${enemyName} without an enemy reply. You can try the encounter again.`,
      cost: 'No item or Focus cost', turn: 'Free · ends encounter',
      limitation: 'Wild encounters only. Finish the friendly battle with Kai.',
      action: { type: 'BATTLE_FLEE' },
    }, battle.kind !== 'wild' ? 'Finish the friendly battle with Kai. Leaving is for wild encounters.' : ''),
  ];

  const party = state.party.map((candidate, index) => {
    const name = SPECIES[candidate.speciesId].name;
    const alone = state.party.length === 1;
    const reason = candidate.hp === 0 ? `${name} has fainted and cannot take the field.`
      : index === battle.activeIndex ? `${name} is already active.${alone ? ' You need another healthy Databeast to switch.' : ''}` : '';
    return descriptor({
      key: `switch:${index}`, group: 'party', label: `Switch to ${name}`, category: 'Switch',
      description: `Level ${candidate.level} · ${candidate.hp}/${candidate.maxHp} HP · ${candidate.focus}/8 Focus`,
      effect: `Your ${name} takes the field and receives the enemy’s next action.`,
      cost: 'No item or Focus cost', turn: TURN,
      limitation: alone ? 'You need another healthy Databeast to switch.' : 'Choose a healthy party member who is not already active.',
      action: { type: 'BATTLE_SWITCH', index },
    }, reason);
  });
  return [...moves, ...commands, ...party];
}
