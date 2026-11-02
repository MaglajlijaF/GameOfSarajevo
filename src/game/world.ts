import type { Cell } from '../core/level';
import type { Controls } from './controls';
import type { Player } from './entities/Player';

/** What entities may ask of the stage they live in (keeps entities decoupled from StageScene). */
export interface World {
  controls: Controls;
  player: Player;
  cellAt(px: number, py: number): Cell;
  fireEnemyProjectile(kind: string, x: number, y: number, vx: number, vy: number, gravity: number, damage: number): void;
  spawnEnemy(id: string, x: number, y: number): void;
  shake(intensity: number, ms?: number): void;
  puff(x: number, y: number, n?: number, tint?: number): void;
  groundWave(x: number, y: number, dir: number, speed: number, damage: number, hostile: boolean): void;
  warnMarker(x: number, y: number, ms: number): void;
  arenaBounds(): { left: number; right: number };
}
