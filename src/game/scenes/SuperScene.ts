import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, keyLabel, panel, text } from '../ui/ui';
import { nav } from '../ui/nav';
import { audio } from '../../audio/audio';
import { hexToInt } from '../../art/palette';

interface SuperData {
  offers: string[];
  onPick: (id: string) => void;
  /** The normal level-up that follows this pick. */
  next: unknown;
}

/** Once per stage: choose one of three super abilities (random weapons). Then the normal level-up opens. */
export class SuperScene extends Phaser.Scene {
  private pick: string | null = null;
  private cards: Phaser.GameObjects.Graphics[] = [];
  private confirm!: Button;

  constructor() { super('Super'); }

  create(d: SuperData): void {
    this.pick = null; this.cards = [];
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.8).setOrigin(0);
    const title = text(this, 320, 16, G.t('super.title'), { scale: 3, origin: [0.5, 0], color: COLORS.gold });
    this.tweens.add({ targets: title, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
    text(this, 320, 44, G.t('super.subtitle', { key: keyLabel(G.save.settings.keybinds.super, G.t) }), { origin: [0.5, 0], color: COLORS.dim, maxWidth: 560 });
    const cw = 180, ch = 196;
    d.offers.forEach((id, i) => {
      const x = 320 + (i - 1) * (cw + 14) - cw / 2, y = 66;
      const g = panel(this, x, y, cw, ch, COLORS.panelLight);
      this.cards.push(g);
      const col = hexToInt(G.data.weapons[id].color) | 0x404040;
      const icon = this.add.image(x + cw / 2, y + 36, `icon_${id}`).setScale(3);
      this.tweens.add({ targets: icon, y: y + 32, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      text(this, x + cw / 2, y + 70, G.t(`super.${id}`), { origin: [0.5, 0], color: col, maxWidth: cw - 12 });
      text(this, x + cw / 2, y + 86, G.t(`weapon.${id}.noun`), { origin: [0.5, 0], color: COLORS.dim, maxWidth: cw - 12 });
      text(this, x + 10, y + 106, G.t(`super.${id}.desc`), { maxWidth: cw - 20 });
      const zone = this.add.zone(x, y, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      const choose = () => { audio.play('click'); this.pick = id; this.refresh(d); };
      zone.on('pointerdown', choose);
      nav(this).add(zone, choose, i === 1);
    });
    this.confirm = new Button(this, 320, 290, G.t('levelup.confirm'), () => {
      if (!this.pick) return;
      audio.play('super');
      d.onPick(this.pick);
      this.scene.stop();
      this.scene.launch('LevelUp', d.next as object);
    }, { w: 140, h: 22, fill: 0x3a7a3a });
    text(this, 320, 310, G.t('super.once'), { origin: [0.5, 0], color: COLORS.dim });
    this.refresh(d);
  }

  private refresh(d: SuperData) {
    const idx = this.pick ? d.offers.indexOf(this.pick) : -1;
    this.cards.forEach((g, i) => g.setAlpha(idx < 0 || i === idx ? 1 : 0.5));
    this.confirm.setDisabled(!this.pick);
  }
}
