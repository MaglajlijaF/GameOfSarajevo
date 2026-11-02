import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, text } from '../ui/ui';
import { upgradeCost, starterCost } from '../../core/economy';
import { buyStarter, buyUpgrade, selectStarter } from '../../core/save';
import { audio } from '../../audio/audio';

/** Permanent upgrades bought with KM, plus starting-weapon options. */
export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create(): void {
    this.add.image(0, 0, 'ui_map').setOrigin(0).setAlpha(0.3);
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.5).setOrigin(0);
    const { save, data } = G;
    text(this, 16, 12, G.t('shop.title'), { scale: 2, color: COLORS.gold });
    panel(this, 520, 10, 110, 20);
    this.add.image(530, 20, 'ui_coin');
    text(this, 622, 15, G.t('menu.km', { km: save.km }), { origin: [1, 0], color: COLORS.km });

    // Upgrades
    panel(this, 12, 40, 360, 270);
    text(this, 22, 48, G.t('shop.upgrades'), { color: COLORS.dim });
    data.shop.upgrades.forEach((u, i) => {
      const y = 64 + i * 60;
      const lv = save.upgrades[u.id] ?? 0;
      const pct = u.id === 'health' ? u.perLevel : Math.round(u.perLevel * 100);
      text(this, 24, y + 4, G.t(`upgrade.${u.id}`), { color: COLORS.text });
      text(this, 24, y + 18, G.t(`upgrade.${u.id}.desc`, { v: pct }), { color: COLORS.dim });
      const g = this.add.graphics();
      for (let k = 0; k < u.maxLevel; k++) {
        g.fillStyle(0x1a1420).fillRect(24 + k * 14, y + 32, 12, 8);
        g.fillStyle(k < lv ? 0xf2d64b : 0x3a3448).fillRect(25 + k * 14, y + 33, 10, 6);
      }
      const maxed = lv >= u.maxLevel;
      const cost = upgradeCost(u, lv);
      new Button(this, 310, y + 20, maxed ? G.t('shop.max') : `${G.t('shop.buy')} ${cost} KM`, () => {
        const r = buyUpgrade(G.save, G.ctx, u.id);
        if (r.ok) { G.update(r.save); audio.play('coin'); this.scene.restart(); } else audio.play('deny');
      }, { w: 104, h: 20, disabled: maxed || save.km < cost, sound: false, fill: 0x3a6a3a });
    });

    // Starting weapons
    panel(this, 384, 40, 244, 270);
    text(this, 394, 48, G.t('shop.starters'), { color: COLORS.dim });
    const starters = [data.shop.defaultStartWeapon, ...Object.values(data.weapons).filter((w) => w.starter).map((w) => w.id)];
    starters.forEach((id, i) => {
      const y = 64 + i * 56;
      this.add.image(406, y + 16, `icon_${id}`).setScale(2);
      text(this, 428, y + 4, G.t(`weapon.${id}.noun`));
      text(this, 428, y + 16, G.t(`weapon.${id}.desc`), { color: COLORS.dim, maxWidth: 190 });
      const owned = save.ownedStarters.includes(id);
      const selected = save.selectedStarter === id;
      const cost = starterCost(data.weapons[id]);
      if (selected) new Button(this, 572, y + 40, G.t('shop.selected'), () => {}, { w: 96, h: 16, disabled: true });
      else if (owned) new Button(this, 572, y + 40, G.t('shop.select'), () => { G.update(selectStarter(G.save, id)); this.scene.restart(); }, { w: 96, h: 16 });
      else new Button(this, 572, y + 40, `${G.t('shop.buy')} ${cost} KM`, () => {
        const r = buyStarter(G.save, G.ctx, id);
        if (r.ok) { G.update(r.save); audio.play('coin'); this.scene.restart(); } else audio.play('deny');
      }, { w: 96, h: 16, disabled: save.km < cost, sound: false, fill: 0x3a6a3a });
    });

    new Button(this, 70, 336, G.t('menu.back'), () => this.scene.start('Menu'), { w: 100 });
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Menu'));
  }
}
