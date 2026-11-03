import Phaser from 'phaser';
import { CELL, type Cell } from '../../core/level';
import { TILE } from '../../art/tiles';
import { audio } from '../../audio/audio';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';

const TS = 16;
/** Seconds per state. Idle time is randomised per vent so they don't all fire together. */
export const STEAM = { idleMin: 2.2, idleMax: 3.8, warn: 0.9, burst: 1.1, height: 54 };

type VentState = 'idle' | 'warn' | 'burst';

interface Vent {
  x0: number; x1: number; // pixel span of the grate run
  top: number;            // pixel y of the grate surface
  tiles: Phaser.Tilemaps.Tile[];
  clouds: Phaser.GameObjects.Image[];
  state: VentState;
  t: number;
  puffT: number;
}

export interface SteamHost {
  player: Player;
  targets(): Enemy[];
  /** Steam damage to an enemy (the host handles numbers, kills and XP). */
  steamEnemy(e: Enemy, damage: number): void;
  puff(x: number, y: number, n?: number, tint?: number): void;
  /** Only vents near the camera are simulated with effects. */
  view(): Phaser.Geom.Rectangle;
}

/**
 * Sewer grates. You can walk on them, but they cycle idle → warning (grate glows,
 * hissing) → burst (a steam column that hurts the player and enemies alike).
 * Luring enemies onto a grate before it bursts is a valid tactic.
 */
export class SteamVents {
  private vents: Vent[] = [];

  constructor(private scene: Phaser.Scene, layer: Phaser.Tilemaps.TilemapLayer, cells: Cell[][], private host: SteamHost, private playerDamage: number) {
    for (let y = 0; y < cells.length; y++) {
      let x = 0;
      while (x < cells[y].length) {
        if (cells[y][x] !== CELL.HAZARD) { x++; continue; }
        const start = x;
        while (x < cells[y].length && cells[y][x] === CELL.HAZARD) x++;
        const tiles: Phaser.Tilemaps.Tile[] = [];
        const clouds: Phaser.GameObjects.Image[] = [];
        for (let c = start; c < x; c++) {
          const tile = layer.getTileAt(c, y);
          if (tile) tiles.push(tile);
          clouds.push(scene.add.image(c * TS + 8, y * TS + 2, 'fx_steam', 0).setOrigin(0.5, 1).setDepth(23).setAlpha(0).setVisible(false));
        }
        this.vents.push({ x0: start * TS, x1: x * TS, top: y * TS, tiles, clouds, state: 'idle', t: Phaser.Math.FloatBetween(0.6, STEAM.idleMax), puffT: 0 });
      }
    }
  }

  get count(): number { return this.vents.length; }

  update(dt: number): void {
    const view = this.host.view();
    for (const v of this.vents) {
      v.t -= dt;
      const near = v.x1 > view.x - 32 && v.x0 < view.right + 32;
      if (v.t <= 0) this.advance(v, near);
      if (v.state === 'warn') {
        v.puffT -= dt;
        if (v.puffT <= 0 && near) { v.puffT = 0.14; this.host.puff(Phaser.Math.Between(v.x0 + 2, v.x1 - 2), v.top, 1, 0xe8e8f0); }
      } else if (v.state === 'burst') {
        const k = 1 - v.t / STEAM.burst;
        const frame = Math.floor(this.scene.time.now / 80) % 3;
        for (const c of v.clouds) c.setFrame(frame).setScale(1, Math.min(1, 0.3 + k * 4)).setAlpha(v.t < 0.25 ? v.t / 0.25 * 0.85 : 0.85);
        this.damage(v);
      }
    }
  }

  private advance(v: Vent, near: boolean) {
    if (v.state === 'idle') {
      v.state = 'warn'; v.t = STEAM.warn; v.puffT = 0;
      for (const tile of v.tiles) tile.index = TILE.HAZARD_B;
      if (near) audio.play('hiss');
    } else if (v.state === 'warn') {
      v.state = 'burst'; v.t = STEAM.burst;
      for (const c of v.clouds) c.setVisible(true).setAlpha(0.85).setScale(1, 0.3);
      if (near) audio.play('steam');
    } else {
      v.state = 'idle'; v.t = Phaser.Math.FloatBetween(STEAM.idleMin, STEAM.idleMax);
      for (const tile of v.tiles) tile.index = TILE.HAZARD_A;
      for (const c of v.clouds) c.setVisible(false);
    }
  }

  private inColumn(v: Vent, x: number, bottom: number, halfW: number): boolean {
    return x + halfW > v.x0 + 2 && x - halfW < v.x1 - 2 && bottom > v.top - STEAM.height && bottom <= v.top + 4;
  }

  private damage(v: Vent) {
    const p = this.host.player;
    if (!p.dead && this.inColumn(v, p.x, p.body2.bottom, 4)) p.hurt(this.playerDamage, (v.x0 + v.x1) / 2, true);
    for (const e of this.host.targets()) {
      const key = 7000;
      if (e.hitTimers.has(key)) continue;
      if (this.inColumn(v, e.x, e.body2.bottom, e.isBoss ? 10 : 4)) {
        e.hitTimers.set(key, 0.5);
        this.host.steamEnemy(e, Math.max(4, Math.round(e.maxHp * (e.isBoss ? 0.03 : 0.25))));
      }
    }
  }

  /** For tests/tutorial: forces every vent into its warning state now. */
  triggerAll(): void { for (const v of this.vents) { v.state = 'idle'; v.t = 0; } }

  isBursting(x: number): boolean { return this.vents.some((v) => v.state === 'burst' && x >= v.x0 && x < v.x1); }

  destroy(): void { for (const v of this.vents) v.clouds.forEach((c) => c.destroy()); this.vents = []; }
}
