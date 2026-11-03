import Phaser from 'phaser';
import { COLORS, keyLabel, panel, setText, text } from './ui/ui';
import { G } from './services';

/** Screen-space HUD for a stage run. Pure view: StageScene pushes values in. */
export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.BitmapText;
  private lvText: Phaser.GameObjects.BitmapText;
  private waveText: Phaser.GameObjects.BitmapText;
  private enemiesText: Phaser.GameObjects.BitmapText;
  private weaponIcon: Phaser.GameObjects.Image;
  private weaponName: Phaser.GameObjects.BitmapText;
  private bossName: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private arrow: Phaser.GameObjects.Container;
  bossVisible = false;
  private nameText: Phaser.GameObjects.BitmapText;
  private superBox: Phaser.GameObjects.Container;
  private superIcon: Phaser.GameObjects.Image;
  private superName: Phaser.GameObjects.BitmapText;
  private superKey: Phaser.GameObjects.BitmapText;
  private hasSuper = false;

  constructor(private scene: Phaser.Scene) {
    const fix = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => { o.setScrollFactor(0); o.setDepth(100); return o; };
    fix(panel(scene, 4, 4, 140, 34, COLORS.panel, 0.75));
    fix(panel(scene, 426, 4, 210, 34, COLORS.panel, 0.75));
    this.g = fix(scene.add.graphics());
    fix(scene.add.image(13, 13, 'ui_heart'));
    this.hpText = fix(text(scene, 136, 9, '', { origin: [1, 0] }));
    this.lvText = fix(text(scene, 136, 24, '', { origin: [1, 0], color: COLORS.gold }));
    this.waveText = fix(text(scene, 320, 6, '', { origin: [0.5, 0], scale: 1, color: COLORS.gold }));
    this.enemiesText = fix(text(scene, 320, 18, '', { origin: [0.5, 0], color: COLORS.dim }));
    this.weaponIcon = fix(scene.add.image(444, 21, 'icon_rucka'));
    this.weaponName = fix(text(scene, 462, 9, '', { maxWidth: 170 }));
    this.bossName = fix(text(scene, 320, 330, '', { origin: [0.5, 1], color: COLORS.red }));
    this.banner = fix(text(scene, 320, 120, '', { origin: [0.5, 0.5], scale: 3, color: COLORS.gold }));
    this.sub = fix(text(scene, 320, 148, '', { origin: [0.5, 0.5], scale: 1 }));
    this.arrow = scene.add.container(600, 180).setScrollFactor(0).setDepth(100);
    this.arrow.add([scene.add.image(0, 0, 'ui_arrow').setScale(2), text(scene, -14, 0, G.t('hud.go'), { origin: [1, 0.5], color: COLORS.gold })]);
    this.arrow.setVisible(false);
    this.nameText = fix(text(scene, 8, 41, '', { color: COLORS.dim }));
    this.superBox = scene.add.container(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    this.superIcon = scene.add.image(438, 50, 'icon_rucka');
    this.superName = text(scene, 450, 45, '', { color: COLORS.gold });
    this.superKey = text(scene, 630, 45, '', { origin: [1, 0], color: COLORS.dim });
    this.superBox.add([panel(scene, 426, 41, 210, 18, COLORS.panel, 0.75), this.superIcon, this.superName, this.superKey]);
    scene.tweens.add({ targets: this.arrow, x: 610, duration: 400, yoyo: true, repeat: -1 });
  }

  update(s: { hp: number; maxHp: number; xpFrac: number; level: number; dashFrac: number; bossFrac: number; phase: number; superFrac?: number }): void {
    const g = this.g;
    g.clear();
    // HP
    g.fillStyle(0x1a1420).fillRect(22, 9, 74, 9);
    g.fillStyle(0x8a2028).fillRect(23, 10, 72, 7);
    g.fillStyle(0xe8483a).fillRect(23, 10, Math.round(72 * Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1)), 7);
    g.fillStyle(0xffffff, 0.3).fillRect(23, 10, Math.round(72 * Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1)), 2);
    // XP
    g.fillStyle(0x1a1420).fillRect(8, 26, 88, 6);
    g.fillStyle(0x2a3a6a).fillRect(9, 27, 86, 4);
    g.fillStyle(0x6ab0f0).fillRect(9, 27, Math.round(86 * s.xpFrac), 4);
    // Dash cooldown pip under weapon
    g.fillStyle(0x1a1420).fillRect(434, 32, 20, 4);
    g.fillStyle(s.dashFrac >= 1 ? 0x5ad05a : 0x6a6a78).fillRect(435, 33, Math.round(18 * s.dashFrac), 2);
    // Super meter
    if (this.hasSuper) {
      const f = Phaser.Math.Clamp(s.superFrac ?? 0, 0, 1);
      const full = f >= 1;
      const blink = full && Math.floor(this.scene.time.now / 200) % 2 === 0;
      g.fillStyle(0x1a1420).fillRect(540, 47, 66, 6);
      g.fillStyle(0x3a3448).fillRect(541, 48, 64, 4);
      g.fillStyle(full ? (blink ? 0xfff0a0 : 0xf2d64b) : 0xe0802a).fillRect(541, 48, Math.round(64 * f), 4);
      this.superKey.setTint(full ? COLORS.gold : COLORS.dim);
    }
    setText(this.hpText, `${Math.ceil(s.hp)}/${s.maxHp}`);
    setText(this.lvText, G.t('hud.level', { lv: s.level }));
    // Boss bar
    if (this.bossVisible) {
      g.fillStyle(0x1a1420).fillRect(168, 334, 304, 12);
      g.fillStyle(0x4a1018).fillRect(170, 336, 300, 8);
      g.fillStyle(s.phase > 0 ? 0xff7a2a : 0xd83a3a).fillRect(170, 336, Math.round(300 * Phaser.Math.Clamp(s.bossFrac, 0, 1)), 8);
      g.fillStyle(0xffffff, 0.3).fillRect(170, 336, Math.round(300 * Phaser.Math.Clamp(s.bossFrac, 0, 1)), 2);
      g.fillStyle(0xffffff, 0.6).fillRect(170 + 150, 334, 1, 12);
    }
  }

  setName(name: string): void { setText(this.nameText, name); }

  setSuper(weaponId: string, name: string): void {
    this.hasSuper = true;
    this.superBox.setVisible(true);
    this.superIcon.setTexture(`icon_${weaponId}`);
    setText(this.superName, name);
    setText(this.superKey, keyLabel(G.save.settings.keybinds.super, G.t));
  }

  setWave(label: string, enemies: string): void { setText(this.waveText, label); setText(this.enemiesText, enemies); }
  setWeapon(texKey: string, name: string): void { this.weaponIcon.setTexture(texKey); setText(this.weaponName, name); }
  setBoss(name: string | null): void { this.bossVisible = !!name; setText(this.bossName, name ?? ''); }
  showArrow(v: boolean): void { this.arrow.setVisible(v); }

  flash(title: string, subtitle = '', ms = 1400, color: number = COLORS.gold): void {
    setText(this.banner, title);
    setText(this.sub, subtitle);
    this.banner.setTint(color).setAlpha(1).setScale(0.6);
    this.sub.setAlpha(1);
    this.scene.tweens.killTweensOf([this.banner, this.sub]);
    this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: [this.banner, this.sub], alpha: 0, delay: ms, duration: 300 });
  }
}
