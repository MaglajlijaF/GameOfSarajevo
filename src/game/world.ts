import type { Cell } from '../core/level';
import type { Controls } from './controls';
import type { Player } from './entities/Player';
import type { Enemy } from './entities/Enemy';
import type { ProjConfig } from './combat/Projectile';

/** What entities may ask of the stage they live in (keeps entities decoupled from StageScene). */
export interface World {
  controls: Controls;
  player: Player;
  cellAt(px: number, py: number): Cell;
  fireEnemyProjectile(kind: string, x: number, y: number, vx: number, vy: number, gravity: number, damage: number): void;
  fireHostile(cfg: ProjConfig): void;
  spawnEnemy(id: string, x: number, y: number): Enemy | null;
  shake(intensity: number, ms?: number): void;
  puff(x: number, y: number, n?: number, tint?: number): void;
  ring(x: number, y: number, radius: number, color: number): void;
  groundWave(x: number, y: number, dir: number, speed: number, damage: number, hostile: boolean): void;
  warnMarker(x: number, y: number, ms: number): void;
  /** Hostile area damage (e.g. a landed bomb). */
  explode(x: number, y: number, radius: number, damage: number, tint?: number): void;
  /** A temporary damaging patch on the ground. */
  trap(x: number, y: number, ms: number, damage: number, tint?: number): void;
  /** Telegraphed horizontal beam across the arena at height y. */
  laser(y: number, telegraphMs: number, activeMs: number, damage: number, tint?: number): void;
  /** Telegraphed sniper line from (x,y) toward angle; fires a fast shot when done. */
  aimLine(x: number, y: number, angle: number, ms: number, tint?: number): void;
  enemiesNear(x: number, y: number, r: number): Enemy[];
  arenaBounds(): { left: number; right: number };
  groundY(): number;
}
