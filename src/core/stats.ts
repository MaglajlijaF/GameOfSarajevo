import type { BuffDef, ShopUpgradeDef } from './types';

export interface PlayerStats {
  maxHp: number;
  damageMult: number;
  speedMult: number;
  attackSpeedMult: number;
  xpMult: number;
}

export const BASE_STATS: PlayerStats = { maxHp: 100, damageMult: 1, speedMult: 1, attackSpeedMult: 1, xpMult: 1 };

/** Permanent stats from shop upgrade levels. */
export function statsFromUpgrades(levels: Record<string, number>, defs: ShopUpgradeDef[]): PlayerStats {
  const s = { ...BASE_STATS };
  for (const d of defs) {
    const lv = Math.min(d.maxLevel, Math.max(0, levels[d.id] ?? 0));
    if (d.id === 'health') s.maxHp += d.perLevel * lv;
    if (d.id === 'damage') s.damageMult += d.perLevel * lv;
    if (d.id === 'speed') s.speedMult += d.perLevel * lv;
    if (d.id === 'xp') s.xpMult += d.perLevel * lv;
  }
  return s;
}

/** Applies one in-run buff pick on top of current stats. */
export function applyBuff(s: PlayerStats, buff: BuffDef): PlayerStats {
  return {
    maxHp: s.maxHp + (buff.maxHp ?? 0),
    damageMult: s.damageMult + (buff.damageMult ?? 0),
    speedMult: s.speedMult + (buff.speedMult ?? 0),
    attackSpeedMult: s.attackSpeedMult + (buff.attackSpeedMult ?? 0),
    xpMult: s.xpMult,
  };
}
