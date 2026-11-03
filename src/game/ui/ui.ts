import Phaser from 'phaser';
import { normalizeText } from '../../art/font';
import { audio } from '../../audio/audio';
import { nav } from './nav';

export const FONT = 'pixel';
export const COLORS = {
  text: 0xffffff, dim: 0xa8a8b8, gold: 0xf2d64b, red: 0xe8483a, green: 0x5ad05a, blue: 0x6ab0f0,
  panel: 0x1e1a2e, panelLight: 0x2e2846, border: 0x0b0b14, accent: 0xe0802a, km: 0xf2d64b,
};

export interface TextOpts { scale?: number; color?: number; origin?: [number, number]; maxWidth?: number }

export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.BitmapText {
  // RetroFont reports size = cell width (6px); multiples of 6 keep pixels crisp.
  const t = scene.add.bitmapText(x, y, FONT, normalizeText(str), 6 * (o.scale ?? 1));
  t.setTint(o.color ?? COLORS.text);
  t.setOrigin(...(o.origin ?? [0, 0]));
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  return t;
}

export function setText(t: Phaser.GameObjects.BitmapText, s: string): void { t.setText(normalizeText(s)); }

/** A bordered pixel panel. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = COLORS.panel, alpha = 0.94): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.border, alpha).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(fill, alpha).fillRect(x, y, w, h);
  g.fillStyle(0xffffff, 0.08).fillRect(x, y, w, 1);
  g.fillStyle(0x000000, 0.25).fillRect(x, y + h - 1, w, 1);
  return g;
}

export interface ButtonOpts { w?: number; h?: number; scale?: number; color?: number; fill?: number; disabled?: boolean; sound?: boolean; /** Pressed by Enter when nothing has keyboard focus yet. */ primary?: boolean; nav?: boolean }

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.BitmapText;
  private hovered = false;
  disabled: boolean;
  readonly bw: number;
  readonly bh: number;
  private fill: number;

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, private onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.bw = o.w ?? 120; this.bh = o.h ?? 20;
    this.fill = o.fill ?? COLORS.panelLight;
    this.disabled = !!o.disabled;
    this.bg = scene.add.graphics();
    this.label = text(scene, 0, 0, str, { scale: o.scale ?? 1, color: o.color, origin: [0.5, 0.5] });
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.on('pointerout', () => { this.hovered = false; this.redraw(); });
    this.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      this.press(o.sound !== false);
    });
    this.redraw();
    scene.add.existing(this);
    if (o.nav !== false) nav(scene).add(this, () => this.press(o.sound !== false), !!o.primary);
  }

  press(sound = true): void {
    audio.unlock();
    if (this.disabled) { audio.play('deny'); return; }
    if (sound) audio.play('click');
    this.onClick();
  }

  setDisabled(d: boolean): this { this.disabled = d; this.redraw(); return this; }
  setLabel(s: string): this { setText(this.label, s); return this; }
  setFill(c: number): this { this.fill = c; this.redraw(); return this; }

  private redraw() {
    const g = this.bg;
    const w = this.bw, h = this.bh;
    g.clear();
    const fill = this.disabled ? 0x2a2a34 : this.hovered ? Phaser.Display.Color.IntegerToColor(this.fill).brighten(25).color : this.fill;
    g.fillStyle(COLORS.border, 1).fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    g.fillStyle(fill, 1).fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(0xffffff, this.hovered ? 0.25 : 0.12).fillRect(-w / 2, -h / 2, w, 2);
    g.fillStyle(0x000000, 0.3).fillRect(-w / 2, h / 2 - 2, w, 2);
    this.label.setAlpha(this.disabled ? 0.5 : 1);
  }
}

export function keyLabel(key: string, t: (k: string) => string): string {
  const k = `key.${key}`;
  const s = t(k);
  return s === k ? key : s;
}
