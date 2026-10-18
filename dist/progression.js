// Shared views of the existing progression rules; this module does not mutate saves.
export const MAX_LEVEL = 50;

export function getExpRequired(level) {
  return level * 20;
}

export function getAttackStrength(species, memberOrLevel) {
  const level = typeof memberOrLevel === 'number' ? memberOrLevel : memberOrLevel.level;
  return species.power + Math.floor(level / 3);
}

export function getExpProgress(member) {
  const isMaxLevel = member.level >= MAX_LEVEL;
  const required = isMaxLevel ? 0 : getExpRequired(member.level);
  return {
    level: member.level,
    xp: member.xp,
    required,
    remaining: isMaxLevel ? 0 : Math.max(0, required - member.xp),
    percent: isMaxLevel ? 100 : Math.max(0, Math.min(100, member.xp / required * 100)),
    isMaxLevel,
  };
}
