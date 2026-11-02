import Phaser from 'phaser';
import { ACTIONS, type Action, type Keybinds } from '../core/input';

/** Polls rebindable actions each frame (keyboard keys or mouse buttons). */
export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key>();
  private down = new Set<Action>();
  private prev = new Set<Action>();

  constructor(private scene: Phaser.Scene, private binds: Keybinds) {
    const kb = scene.input.keyboard!;
    for (const a of ACTIONS) {
      const k = binds[a];
      if (k.startsWith('MOUSE_')) continue;
      const code = (Phaser.Input.Keyboard.KeyCodes as Record<string, number>)[k];
      if (code !== undefined) this.keys.set(a, kb.addKey(code, true, false));
    }
  }

  update(): void {
    this.prev = new Set(this.down);
    this.down.clear();
    const p = this.scene.input.activePointer;
    for (const a of ACTIONS) {
      const b = this.binds[a];
      const isDown = b === 'MOUSE_LEFT' ? p.leftButtonDown() : b === 'MOUSE_RIGHT' ? p.rightButtonDown() : !!this.keys.get(a)?.isDown;
      if (isDown) this.down.add(a);
    }
  }

  isDown(a: Action): boolean { return this.down.has(a); }
  justDown(a: Action): boolean { return this.down.has(a) && !this.prev.has(a); }
  justUp(a: Action): boolean { return !this.down.has(a) && this.prev.has(a); }

  /** Clears edge state, e.g. after closing an overlay so a click doesn't leak into the game. */
  flush(): void { this.update(); this.prev = new Set(this.down); }

  destroy(): void { for (const k of this.keys.values()) this.scene.input.keyboard?.removeKey(k); }
}
