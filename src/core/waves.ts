import { Rng } from './rng';
import type { WaveDef } from './types';

/**
 * Renderer-independent wave director. Feed it the alive count each frame;
 * it tells you which enemy ids to spawn and when the wave is cleared.
 */
export class WaveDirector {
  private queue: string[];
  private timer = 0.4;
  private spawned = 0;
  readonly total: number;

  constructor(private readonly def: WaveDef, seed: number) {
    const list: string[] = [];
    for (const s of def.spawns) for (let i = 0; i < s.count; i++) list.push(s.enemy);
    this.queue = new Rng(seed).shuffle(list);
    this.total = list.length;
  }

  update(dt: number, alive: number): string[] {
    const out: string[] = [];
    this.timer -= dt;
    while (this.timer <= 0 && this.queue.length && alive + out.length < this.def.maxAlive) {
      out.push(this.queue.shift()!);
      this.timer += this.def.interval;
    }
    if (this.timer < 0) this.timer = 0;
    this.spawned += out.length;
    return out;
  }

  get remainingToSpawn(): number { return this.queue.length; }
  get spawnedCount(): number { return this.spawned; }
  isCleared(alive: number): boolean { return this.queue.length === 0 && alive === 0; }
}
