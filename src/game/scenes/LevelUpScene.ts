import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, text, setText } from '../ui/ui';
import { mergeWeapon, weaponName, type CompositeWeapon } from '../../core/weapons';
import { weaponTexture } from '../combat/WeaponSystem';
import { audio } from '../../audio/audio';
import { hexToInt } from '../../art/palette';

interface LevelUpData {
  level: number;
  weapon: CompositeWeapon;
  offers: string[];
  onPick: (weaponId: string | null, buffId: string) => void;
}

const BUFFS = ['strength', 'speed', 'durability'];

/** Pauses the stage and offers 1 of 3 weapons to merge + 1 of 3 buffs. */
export class LevelUpScene extends Phaser.Scene {
  private pickW: string | null = null;
  private pickB: string | null = null;
  private wCards: Phaser.GameObjects.Graphics[] = [];
  private bCards: Phaser.GameObjects.Graphics[] = [];
  private confirm!: Button;
  private preview!: Phaser.GameObjects.Image;
  private previewName!: Phaser.GameObjects.BitmapText;

  constructor() { super('LevelUp'); }

  create(d: LevelUpData): void {
    this.pickW = null; this.pickB = null; this.wCards = []; this.bCards = [];
    const t = (k: string) => G.i18n.maybe(k);
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.75).setOrigin(0);
    text(this, 320, 14, `${G.t('levelup.title')}  ${G.t('hud.level', { lv: d.level })}`, { scale: 2, origin: [0.5, 0], color: COLORS.gold });

    text(this, 320, 40, G.t('levelup.pickWeapon'), { origin: [0.5, 0], color: COLORS.dim });
    const cw = 190, ch = 104;
    d.offers.forEach((id, i) => {
      const x = 320 + (i - 1) * (cw + 12) - cw / 2, y = 54;
      const g = panel(this, x, y, cw, ch, COLORS.panelLight);
      this.wCards.push(g);
      const part = d.weapon.parts.find((p) => p.id === id);
      const def = G.data.weapons[id];
      this.add.image(x + 20, y + 22, `icon_${id}`).setScale(2);
      text(this, x + 40, y + 10, G.t(`weapon.${id}.noun`), { color: hexToInt(def.color) | 0x404040, maxWidth: cw - 46 });
      text(this, x + 40, y + 24, part ? G.t('levelup.upgradePart', { tier: part.tier + 1 }) : G.t('levelup.newPart'), { color: part ? COLORS.blue : COLORS.green, maxWidth: cw - 46 });
      text(this, x + 8, y + 46, G.t(`weapon.${id}.desc`), { maxWidth: cw - 16 });
      const zone = this.add.zone(x, y, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { audio.play('click'); this.pickW = id; this.refresh(d); });
    });

    const by = 172;
    text(this, 320, by - 12, G.t('levelup.pickBuff'), { origin: [0.5, 0], color: COLORS.dim });
    BUFFS.forEach((id, i) => {
      const x = 320 + (i - 1) * (cw + 12) - cw / 2;
      const g = panel(this, x, by, cw, 46, COLORS.panelLight);
      this.bCards.push(g);
      const col = hexToInt(G.data.buffs[id].color);
      this.add.rectangle(x + 14, by + 23, 12, 12, col).setStrokeStyle(1, 0x1a1420);
      text(this, x + 28, by + 9, G.t(`buff.${id}`), { color: col });
      text(this, x + 28, by + 23, G.t(`buff.${id}.desc`), { maxWidth: cw - 34, color: COLORS.dim });
      const zone = this.add.zone(x, by, cw, 46).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { audio.play('click'); this.pickB = id; this.refresh(d); });
    });

    panel(this, 120, 232, 400, 60);
    this.preview = this.add.image(152, 262, weaponTexture(this, d.weapon, G.data.weapons)).setScale(2);
    this.previewName = text(this, 186, 250, weaponName(d.weapon, G.data.weapons, t), { maxWidth: 326, color: COLORS.gold });

    this.confirm = new Button(this, 320, 314, G.t('levelup.confirm'), () => {
      if (!this.pickB || (d.offers.length && !this.pickW)) return;
      audio.play('pickup');
      d.onPick(this.pickW, this.pickB);
      this.scene.stop();
      this.scene.resume('Stage');
    }, { w: 140, h: 22, fill: 0x3a7a3a });
    this.refresh(d);
  }

  private refresh(d: LevelUpData) {
    const sel = (gs: Phaser.GameObjects.Graphics[], idx: number) => gs.forEach((g, i) => g.setAlpha(idx < 0 || i === idx ? 1 : 0.55));
    sel(this.wCards, this.pickW ? d.offers.indexOf(this.pickW) : -1);
    sel(this.bCards, this.pickB ? BUFFS.indexOf(this.pickB) : -1);
    const merged = this.pickW ? mergeWeapon(d.weapon, this.pickW, G.data.weapons) : d.weapon;
    this.preview.setTexture(weaponTexture(this, merged, G.data.weapons));
    setText(this.previewName, (this.pickW ? '→ ' : '') + weaponName(merged, G.data.weapons, (k) => G.i18n.maybe(k)));
    this.confirm.setDisabled(!this.pickB || (d.offers.length > 0 && !this.pickW));
  }
}
