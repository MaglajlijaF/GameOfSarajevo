import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, text, setText } from '../ui/ui';
import { computeUnlocked } from '../../core/progression';
import { stageReward } from '../../core/economy';
import { audio, MENU_MUSIC } from '../../audio/audio';
import { platform } from '../../platform/storage';

/** Main menu: Sarajevo map with stage nodes, plus navigation to shop/character/settings. */
export class MenuScene extends Phaser.Scene {
  private selected: string | null = null;
  private info!: Phaser.GameObjects.Container;

  constructor() { super('Menu'); }

  create(): void {
    const { data, save } = G;
    this.add.image(0, 0, 'ui_map').setOrigin(0);
    audio.playMusic(MENU_MUSIC);
    this.input.once('pointerdown', () => audio.unlock());

    panel(this, 6, 6, 250, 34);
    text(this, 12, 10, G.t('game.title'), { scale: 2, color: COLORS.gold });
    text(this, 12, 29, G.t('game.subtitle'), { color: COLORS.dim });

    panel(this, 534, 6, 100, 20);
    this.add.image(544, 16, 'ui_coin');
    text(this, 626, 11, G.t('menu.km', { km: save.km }), { color: COLORS.km, origin: [1, 0] });

    const unlocked = computeUnlocked(data.stageOrder, save.cleared);
    // Route between consecutive stages
    const g = this.add.graphics();
    for (let i = 1; i < data.stageOrder.length; i++) {
      const a = data.stages[data.stageOrder[i - 1]].map;
      const b = data.stages[data.stageOrder[i]].map;
      const done = save.cleared.includes(data.stageOrder[i - 1]);
      const steps = Math.ceil(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 6);
      for (let s = 0; s < steps; s += 2) {
        const t = s / steps;
        g.fillStyle(done ? 0xf2d64b : 0x2a2a34, done ? 1 : 0.6).fillRect(Math.round(a.x + (b.x - a.x) * t) - 1, Math.round(a.y + (b.y - a.y) * t) - 1, 2, 2);
      }
    }

    data.stageOrder.forEach((id, i) => {
      const st = data.stages[id];
      const isUnlocked = unlocked.includes(id);
      const cleared = save.cleared.includes(id);
      const node = this.add.container(st.map.x, st.map.y);
      const ring = this.add.graphics();
      const col = cleared ? 0x5ad05a : isUnlocked ? 0xf2d64b : 0x6a6a78;
      ring.fillStyle(0x1a1420, 1).fillCircle(0, 0, 9);
      ring.fillStyle(col, 1).fillCircle(0, 0, 7);
      ring.fillStyle(0xffffff, 0.35).fillCircle(-2, -2, 2);
      node.add(ring);
      if (!isUnlocked) node.add(this.add.image(0, 0, 'ui_lock'));
      else if (cleared) node.add(this.add.image(0, 0, 'ui_check'));
      else node.add(text(this, 0, 0, String(i + 1), { origin: [0.5, 0.5], color: 0x1a1420 }));
      const label = text(this, 0, 12, st.name, { origin: [0.5, 0], color: isUnlocked ? COLORS.text : COLORS.dim });
      node.add(label);
      if (isUnlocked && !cleared) this.tweens.add({ targets: ring, scale: 1.15, duration: 600, yoyo: true, repeat: -1 });
      node.setSize(24, 24).setInteractive({ useHandCursor: true });
      node.on('pointerdown', () => { audio.unlock(); audio.play(isUnlocked ? 'click' : 'deny'); this.select(id); });
      node.on('pointerover', () => label.setTint(COLORS.gold));
      node.on('pointerout', () => label.setTint(isUnlocked ? COLORS.text : COLORS.dim));
    });

    const bx = 576;
    const items: [string, () => void][] = [
      ['menu.shop', () => this.scene.start('Shop')],
      ['menu.character', () => this.scene.start('Character')],
      ['menu.settings', () => this.scene.start('Settings')],
    ];
    if (platform.isElectron) items.push(['menu.quit', () => platform.quit()]);
    items.forEach(([k, fn], i) => new Button(this, bx, 270 + i * 24, G.t(k), fn, { w: 104 }));

    this.info = this.add.container(0, 0);
    const firstOpen = data.stageOrder.find((id) => unlocked.includes(id) && !save.cleared.includes(id)) ?? data.stageOrder[0];
    this.select(this.selected && unlocked.includes(this.selected) ? this.selected : firstOpen);

  }

  private select(id: string): void {
    this.selected = id;
    const { data, save } = G;
    const st = data.stages[id];
    const idx = data.stageOrder.indexOf(id);
    const unlocked = computeUnlocked(data.stageOrder, save.cleared).includes(id);
    const cleared = save.cleared.includes(id);
    this.info.removeAll(true);
    const x = 8, y = 262, w = 250, h = 92;
    this.info.add(panel(this, x, y, w, h));
    this.info.add(text(this, x + 8, y + 6, `${idx + 1}. ${st.name}`, { scale: 2, color: COLORS.gold }));
    const status = !unlocked ? G.t('menu.locked') : cleared ? G.t('menu.cleared') : G.t('menu.new');
    const statusT = text(this, x + w - 8, y + 10, status, { origin: [1, 0], color: !unlocked ? COLORS.red : cleared ? COLORS.green : COLORS.blue });
    this.info.add(statusT);
    if (!unlocked) {
      const prev = data.stages[data.stageOrder[idx - 1]];
      this.info.add(text(this, x + 8, y + 32, G.t('menu.lockedHint', { prev: prev?.name ?? '' }), { color: COLORS.dim, maxWidth: w - 16 }));
    } else {
      const km = stageReward(st, cleared);
      this.info.add(text(this, x + 8, y + 30, G.t(cleared ? 'menu.replayReward' : 'menu.reward', { km }), { color: COLORS.km }));
      const wName = G.t(`weapon.${save.selectedStarter}.noun`);
      this.info.add(text(this, x + 8, y + 42, G.t('menu.weapon', { name: wName }), { color: COLORS.dim }));
      if (st.placeholder) this.info.add(text(this, x + 8, y + 54, G.t('menu.preview'), { color: COLORS.accent }));
      const play = new Button(this, x + w - 52, y + h - 16, G.t('menu.play'), () => this.startStage(id), { w: 88, h: 20, fill: 0x3a7a3a });
      this.info.add(play);
    }
    setText(statusT, status.toUpperCase());
  }

  private startStage(id: string): void {
    // Entry is re-validated: locked stages can never be started.
    if (!computeUnlocked(G.data.stageOrder, G.save.cleared).includes(id)) { audio.play('deny'); return; }
    audio.stopMusic();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Stage', { stageId: id }));
  }
}
