import type { ShopUpgradeDef, StageDef, WeaponDef } from './types';

/** KM paid for clearing a stage. Replays pay a reduced fraction. */
export function stageReward(stage: Pick<StageDef, 'reward' | 'replayFactor'>, alreadyCleared: boolean): number {
  const base = Math.max(0, Math.floor(stage.reward));
  return alreadyCleared ? Math.floor(base * Math.min(1, Math.max(0, stage.replayFactor))) : base;
}

/** Cost of buying the next level when the upgrade is currently at `level`. */
export function upgradeCost(def: ShopUpgradeDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

export function canAfford(km: number, cost: number): boolean { return km >= cost; }

export function starterCost(def: WeaponDef): number { return Math.max(0, def.starterCost ?? 0); }
