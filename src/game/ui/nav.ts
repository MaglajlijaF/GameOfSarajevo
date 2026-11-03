import Phaser from 'phaser';

type Bounded = Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle; visible?: boolean };

interface NavItem { obj: Bounded; activate: () => void; primary: boolean }

/**
 * Keyboard navigation for menus, so the whole game is playable without a mouse.
 * Arrow keys (or W/A/S/D) move a focus frame between buttons and cards; Enter or
 * Space presses the focused one. Every Button registers itself automatically.
 */
export class KeyNav {
  private items: NavItem[] = [];
  private layers: number[] = [];
  private idx = -1;
  private g: Phaser.GameObjects.Graphics;
  enabled = true;
  private born: number;

  constructor(private scene: Phaser.Scene) {
    this.born = performance.now();
    this.g = scene.add.graphics().setDepth(1000).setScrollFactor(0);
    scene.input.keyboard?.on('keydown', this.onKey, this);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.draw, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off('keydown', this.onKey, this);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.draw, this);
      NAVS.delete(scene);
    });
  }

  add(obj: Bounded, activate: () => void, primary = false): void { this.items.push({ obj, activate, primary }); }

  /** Starts a modal layer (e.g. a confirm dialog); only its items are reachable until the returned pop() is called. */
  pushLayer(): () => void {
    this.layers.push(this.items.length);
    const saved = this.idx;
    this.idx = -1;
    return () => { const start = this.layers.pop() ?? 0; this.items.length = Math.min(this.items.length, start); this.idx = saved; };
  }

  private live(): NavItem[] {
    const start = this.layers[this.layers.length - 1] ?? 0;
    return this.items.slice(start).filter((i) => i.obj.active && i.obj.scene && i.obj.visible !== false && isShown(i.obj));
  }

  private onKey(ev: KeyboardEvent) {
    if (!this.enabled || !this.scene.scene.isActive()) return;
    const k = ev.code;
    const dir = k === 'ArrowUp' || k === 'KeyW' ? [0, -1] : k === 'ArrowDown' || k === 'KeyS' ? [0, 1]
      : k === 'ArrowLeft' || k === 'KeyA' ? [-1, 0] : k === 'ArrowRight' || k === 'KeyD' ? [1, 0] : null;
    const items = this.live();
    if (!items.length) return;
    let cur = this.idx >= 0 ? this.items[this.idx] : undefined;
    if (cur && !items.includes(cur)) cur = undefined;
    if (dir) {
      if (!cur) { this.focus(items.find((i) => i.primary) ?? items[0]); return; }
      const a = center(cur.obj);
      let best: NavItem | undefined; let bestScore = Infinity;
      for (const it of items) {
        if (it === cur) continue;
        const b = center(it.obj);
        const dx = b.x - a.x, dy = b.y - a.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 2) continue;
        const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
        const score = along + across * 2.2;
        if (score < bestScore) { bestScore = score; best = it; }
      }
      if (best) this.focus(best);
      ev.preventDefault?.();
    } else if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') {
      // A held jump key (auto-repeat) or a press carried over from gameplay must not pick anything.
      if (ev.repeat || performance.now() - this.born < 300) return;
      const target = cur ?? items.find((i) => i.primary);
      if (target) { ev.preventDefault?.(); target.activate(); }
    }
  }

  private focus(it: NavItem) { this.idx = this.items.indexOf(it); }

  private draw() {
    this.g.clear();
    const it = this.idx >= 0 ? this.items[this.idx] : undefined;
    if (!it || !this.live().includes(it)) return;
    const r = it.obj.getBounds();
    const t = this.scene.time.now / 1000;
    this.g.lineStyle(1, 0xf2d64b, 0.7 + Math.sin(t * 8) * 0.3).strokeRect(Math.round(r.x) - 2.5, Math.round(r.y) - 2.5, Math.round(r.width) + 5, Math.round(r.height) + 5);
  }
}

function center(o: Bounded) { const r = o.getBounds(); return { x: r.centerX, y: r.centerY }; }

/** False if the object or any parent container is hidden. */
function isShown(o: Phaser.GameObjects.GameObject): boolean {
  let c: Phaser.GameObjects.Container | null = o.parentContainer;
  while (c) { if (!c.visible) return false; c = c.parentContainer; }
  return true;
}

const NAVS = new Map<Phaser.Scene, KeyNav>();

export function nav(scene: Phaser.Scene): KeyNav {
  let n = NAVS.get(scene);
  if (!n) { n = new KeyNav(scene); NAVS.set(scene, n); }
  return n;
}
