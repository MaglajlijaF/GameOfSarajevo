import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, text } from '../ui/ui';

/** Character select. Milestone 1 ships one design; more are added via characters.json. */
export class CharacterScene extends Phaser.Scene {
  constructor() { super('Character'); }

  create(): void {
    this.add.image(0, 0, 'ui_map').setOrigin(0).setAlpha(0.3);
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.5).setOrigin(0);
    text(this, 16, 12, G.t('character.title'), { scale: 2, color: COLORS.gold });
    const chars = G.data.characters;
    chars.forEach((c, i) => {
      const x = 80 + (i % 6) * 96, y = 60 + Math.floor(i / 6) * 140;
      const sel = G.save.selectedCharacter === c.id;
      panel(this, x - 40, y, 80, 120, sel ? 0x3a5a3a : 0x2e2846);
      const s = this.add.sprite(x, y + 50, c.sprite).setScale(3).play(`${c.sprite}_idle`);
      text(this, x, y + 92, G.t(`character.${c.id}`), { origin: [0.5, 0], color: sel ? COLORS.gold : COLORS.text });
      text(this, x, y + 104, G.t(c.gender === 'm' ? 'character.male' : 'character.female'), { origin: [0.5, 0], color: COLORS.dim });
      const z = this.add.zone(x - 40, y, 80, 120).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => s.play(`${c.sprite}_run`, true));
      z.on('pointerout', () => s.play(`${c.sprite}_idle`, true));
      z.on('pointerdown', () => { G.update({ ...G.save, selectedCharacter: c.id }); this.scene.restart(); });
    });
    new Button(this, 70, 336, G.t('menu.back'), () => this.scene.start('Menu'), { w: 100 });
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
