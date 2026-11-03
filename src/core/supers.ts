import type { Rng } from './rng';

/**
 * Super abilities. One per stage: at the SUPER_LEVEL level-up the player picks
 * one of three supers drawn at random from all weapons. The super charges from
 * kills and boss damage and is fired with the `super` key.
 */
export const SUPER_LEVEL = 3;
/** Charge needed for one use (1 per kill, 1 per 4% of boss health). */
export const SUPER_CHARGE = 14;
export const SUPER_BOSS_STEP = 0.04;

export function offerSupers(weaponIds: string[], rng: Rng, count = 3): string[] {
  const pool = [...weaponIds];
  rng.shuffle(pool);
  return pool.slice(0, Math.min(count, pool.length));
}

/** True when this level-up should offer the stage's single super. */
export function superDue(level: number, picked: string | null): boolean {
  return picked === null && level >= SUPER_LEVEL;
}

export interface SuperMeter { charge: number }

export function addCharge(m: SuperMeter, amount: number): SuperMeter {
  return { charge: Math.min(SUPER_CHARGE, Math.max(0, m.charge + amount)) };
}

export function canUseSuper(m: SuperMeter): boolean { return m.charge >= SUPER_CHARGE; }
