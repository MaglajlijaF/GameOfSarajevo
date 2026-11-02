export interface XpState { level: number; xp: number; pendingLevelUps: number }

export function createXpState(): XpState { return { level: 1, xp: 0, pendingLevelUps: 0 }; }

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(8 + (level - 1) * 6 + Math.pow(level - 1, 1.6) * 2);
}

/**
 * Adds XP (after multiplier), rolling over into as many level-ups as earned.
 * Returns a new state and how many levels were gained by this call.
 */
export function addXp(state: XpState, amount: number, multiplier = 1): { state: XpState; gained: number } {
  if (!(amount > 0) || !(multiplier > 0)) return { state: { ...state }, gained: 0 };
  let xp = state.xp + amount * multiplier;
  let level = state.level;
  let gained = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    gained++;
  }
  return { state: { level, xp, pendingLevelUps: state.pendingLevelUps + gained }, gained };
}

export function consumeLevelUp(state: XpState): XpState {
  return { ...state, pendingLevelUps: Math.max(0, state.pendingLevelUps - 1) };
}

export function xpProgress(state: XpState): number {
  return Math.min(1, state.xp / xpToNext(state.level));
}
