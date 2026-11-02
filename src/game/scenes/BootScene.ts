import Phaser from 'phaser';
import { buildManifest } from '../../art/manifest';
import { framesToCanvas } from '../../art/pixel';
import { buildFontCanvas, FONT_CELL_H, FONT_CELL_W, FONT_CHARS, FONT_PER_ROW } from '../../art/font';
import { ANIMS } from '../../art/characters';
import { G } from '../services';
import { FONT } from '../ui/ui';

/** Builds every texture from the manifest, registers animations and loads the save. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    const manifest = buildManifest(G.data);
    for (const [key, e] of Object.entries(manifest)) {
      if (e.kind !== 'image') continue;
      if (e.frameWidth) this.load.spritesheet(key, e.url, { frameWidth: e.frameWidth, frameHeight: e.frameHeight ?? e.frameWidth });
      else this.load.image(key, e.url);
    }
  }

  async create(): Promise<void> {
    const manifest = buildManifest(G.data);
    for (const [key, e] of Object.entries(manifest)) {
      if (e.kind !== 'generated' || this.textures.exists(key)) continue;
      const frames = e.build();
      const tex = this.textures.addCanvas(key, framesToCanvas(frames))!;
      frames.forEach((_, i) => tex.add(i, 0, i * e.frameWidth, 0, e.frameWidth, e.frameHeight));
    }
    // Pixel font
    this.textures.addCanvas('font_pixel', buildFontCanvas());
    const fontData = Phaser.GameObjects.RetroFont.Parse(this, {
      image: 'font_pixel', width: FONT_CELL_W, height: FONT_CELL_H, chars: FONT_CHARS,
      charsPerRow: FONT_PER_ROW, 'spacing.x': 0, 'spacing.y': 0, 'offset.x': 0, 'offset.y': 0, lineSpacing: 2,
    } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig);
    // In Phaser 3.90 Parse returns the full cache entry ({ data, texture, frame }).
    this.cache.bitmapFont.add(FONT, fontData);

    // Character animations (same frame layout for players, enemies and bosses)
    const sheetKeys = [
      ...G.data.characters.map((c) => c.sprite),
      ...Object.values(G.data.enemies).map((e) => e.sprite),
      ...Object.values(G.data.bosses).map((b) => b.sprite),
    ];
    for (const key of sheetKeys) {
      if (!this.textures.exists(key)) continue;
      const mk = (name: string, frames: readonly number[], rate: number, repeat: number) =>
        this.anims.create({ key: `${key}_${name}`, frames: frames.map((f) => ({ key, frame: f })), frameRate: rate, repeat });
      mk('idle', ANIMS.idle, 3, -1);
      mk('run', ANIMS.run, 10, -1);
      mk('jump', ANIMS.jump, 1, 0);
      mk('fall', ANIMS.fall, 1, 0);
      mk('attack', ANIMS.attack, 14, 0);
      mk('hurt', ANIMS.hurt, 1, 0);
      mk('defeat', ANIMS.defeat, 4, 0);
    }

    await G.load();
    this.game.canvas.oncontextmenu = (e) => e.preventDefault();
    this.scene.start('Menu');
  }
}
