import Phaser from 'phaser';
import { G } from './services';
import { COLORS, keyLabel, panel, setText, text } from './ui/ui';
import { TUTORIAL_DUMMIES, TUTORIAL_GATES, TUTORIAL_INFO_CARDS, TUTORIAL_PASS, TUTORIAL_STEPS, type TutorialStep } from '../core/tutorial';
import { audio } from '../audio/audio';
import type { Controls } from './controls';
import type { Enemy } from './entities/Enemy';
import type { Player } from './entities/Player';
import type { Action } from '../core/input';

const TS = 16;

export interface TutorialHost {
  self: Phaser.Scene;
  player: Player;
  controls: Controls;
  setGate(tileX: number, closed: boolean): void;
  spawnDummy(tileX: number, row: number): Enemy | null;
  end(): void;
}

/** Drives the interactive tutorial: one prompt at a time, gates open as each skill is shown. */
export class Tutorial {
  private step = 0;
  private card = 0;
  private sawLeft = false;
  private sawRight = false;
  private startX = 0;
  private dummies: Enemy[] = [];
  private spawned = new Set<string>();
  private title: Phaser.GameObjects.BitmapText;
  private body: Phaser.GameObjects.BitmapText;
  private counter: Phaser.GameObjects.BitmapText;
  private hint: Phaser.GameObjects.BitmapText;
  private done = false;

  constructor(private h: TutorialHost) {
    const s = h.self;
    const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => { o.setScrollFactor(0); o.setDepth(110); return o; };
    fix(panel(s, 150, 44, 340, 62, COLORS.panel, 0.9));
    this.counter = fix(text(s, 482, 50, '', { origin: [1, 0], color: COLORS.dim }));
    this.title = fix(text(s, 160, 50, '', { color: COLORS.gold, scale: 2 }));
    this.body = fix(text(s, 160, 70, '', { maxWidth: 320 }));
    this.hint = fix(text(s, 482, 98, '', { origin: [1, 1], color: COLORS.green }));
    for (const x of Object.values(TUTORIAL_GATES)) if (x) h.setGate(x, true);
    this.startX = h.player.x;
    this.show();
    s.input.keyboard?.on('keydown-ENTER', this.next, this);
    s.input.on('pointerdown', this.next, this);
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { s.input.keyboard?.off('keydown-ENTER', this.next, this); s.input.off('pointerdown', this.next, this); });
  }

  get current(): TutorialStep { return TUTORIAL_STEPS[this.step]; }

  private key(a: Action): string { return keyLabel(G.save.settings.keybinds[a], G.t); }

  private show() {
    const st = this.current;
    const vars = {
      left: this.key('left'), right: this.key('right'), jump: this.key('jump'), dash: this.key('dash'),
      up: this.key('up'), down: this.key('down'), attack: this.key('attack'), super: this.key('super'),
    };
    setText(this.counter, `${this.step + 1}/${TUTORIAL_STEPS.length}`);
    if (st === 'info') {
      setText(this.title, G.t(`tutorial.info${this.card + 1}.title`));
      setText(this.body, G.t(`tutorial.info${this.card + 1}.body`, vars));
      setText(this.hint, G.t('tutorial.next'));
    } else {
      setText(this.title, G.t(`tutorial.${st}.title`));
      const mode = st === 'attack' ? `_${G.save.settings.aimMode}` : '';
      setText(this.body, G.t(`tutorial.${st}.body${mode}`, vars));
      setText(this.hint, '');
    }
    this.title.setScale(0.6);
    this.h.self.tweens.add({ targets: this.title, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  private complete() {
    const st = this.current;
    const gate = TUTORIAL_GATES[st];
    if (gate) this.h.setGate(gate, false);
    audio.play('pickup');
    this.h.self.cameras.main.flash(80, 120, 255, 120);
    this.step++;
    this.show();
  }

  /** Info cards advance with Enter or a click; the last one ends the tutorial. */
  private next() {
    if (this.current !== 'info' || this.done) return;
    audio.play('click');
    this.card++;
    if (this.card >= TUTORIAL_INFO_CARDS) { this.done = true; this.h.end(); return; }
    this.show();
  }

  update(): void {
    if (this.done) return;
    const p = this.h.player, c = this.h.controls;
    const tx = p.x / TS;
    switch (this.current) {
      case 'move':
        if (c.isDown('left')) this.sawLeft = true;
        if (c.isDown('right')) this.sawRight = true;
        if (this.sawLeft && this.sawRight && Math.abs(p.x - this.startX) > 32) this.complete();
        break;
      case 'jump': case 'double': case 'steam':
        if (this.current === 'steam' && !this.spawned.has('steam') && tx > 77) {
          this.spawned.add('steam');
          for (const x of TUTORIAL_DUMMIES.steam) { const d = this.h.spawnDummy(x, 20); if (d) this.dummies.push(d); }
        }
        if (tx > TUTORIAL_PASS[this.current]!) this.complete();
        break;
      case 'dash':
        if (p.dashing > 0) this.complete();
        break;
      case 'ladder':
        if (!p.climbing && p.onGround && p.body2.bottom <= 12 * TS + 2) this.complete();
        break;
      case 'drop':
        if (p.dropT > 0.15 && !p.climbing) this.complete();
        break;
      case 'attack': {
        if (!this.spawned.has('attack') && tx > 55) {
          this.spawned.add('attack');
          this.dummies = TUTORIAL_DUMMIES.attack.map((x) => this.h.spawnDummy(x, 19)).filter((d): d is Enemy => !!d);
        }
        if (this.spawned.has('attack') && this.dummies.every((d) => !d.alive || d.dying)) this.complete();
        break;
      }
      case 'info':
        if (c.justDown('jump')) this.next();
        break;
    }
  }
}
