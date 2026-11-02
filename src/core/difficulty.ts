import type { StageDef } from './types';

/**
 * Converts a stage's `difficulty` number into the multipliers applied to every
 * enemy and boss in it. `difficulty` is set per stage in stages.json and rises
 * along the campaign order.
 *  - hp:    enemy/boss health multiplier
 *  - dmg:   enemy/boss damage multiplier (grows at about a third of the hp rate,
 *           because late enemies already have higher base damage)
 *  - aggro: attack cadence multiplier (shorter cooldowns, capped)
 */
export function stageScale(stage: Pick<StageDef, 'difficulty'>): { hp: number; dmg: number; aggro: number } {
  const d = Math.max(0.5, stage.difficulty);
  return {
    hp: d,
    dmg: 1 + (d - 1) * 0.32,
    aggro: Math.min(1.7, 1 + (d - 1) * 0.16),
  };
}
