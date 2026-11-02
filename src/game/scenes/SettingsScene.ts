import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, keyLabel, panel, text } from '../ui/ui';
import { ACTIONS, DEFAULT_KEYBINDS, rebind, type Action } from '../../core/input';
import { platform } from '../../platform/storage';
import { audio } from '../../audio/audio';
import type { Settings } from '../../core/save';

/** Language, audio, display, key rebinding and save reset. */
export class SettingsScene extends Phaser.Scene {
  private waiting: Action | null = null;

  constructor() { super('Settings'); }

  create(): void {
    this.waiting = null;
    this.add.image(0, 0, 'ui_map').setOrigin(0).setAlpha(0.3);
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.5).setOrigin(0);
    text(this, 16, 12, G.t('settings.title'), { scale: 2, color: COLORS.gold });
    const s = G.save.settings;
    const set = (patch: Partial<Settings>) => {
      G.update({ ...G.save, settings: { ...G.save.settings, ...patch } });
      G.applySettings();
      this.scene.restart();
    };

    panel(this, 12, 40, 300, 270);
    let y = 56;
    const row = (label: string) => { text(this, 24, y - 4, label); };
    row(G.t('settings.language'));
    new Button(this, 250, y, s.lang === 'bs' ? 'Bosanski' : 'English', () => set({ lang: s.lang === 'bs' ? 'en' : 'bs' }), { w: 100, h: 16 });
    y += 26;
    for (const [k, key] of [['settings.master', 'masterVolume'], ['settings.music', 'musicVolume'], ['settings.sfx', 'sfxVolume']] as const) {
      row(G.t(k));
      const v = s[key];
      new Button(this, 210, y, '-', () => set({ [key]: Math.max(0, Math.round((v - 0.1) * 10) / 10) }), { w: 18, h: 16 });
      text(this, 250, y, `${Math.round(v * 100)}%`, { origin: [0.5, 0.5] });
      new Button(this, 290, y, '+', () => set({ [key]: Math.min(1, Math.round((v + 0.1) * 10) / 10) }), { w: 18, h: 16 });
      y += 26;
    }
    row(G.t('settings.fullscreen'));
    new Button(this, 250, y, s.fullscreen ? G.t('settings.on') : G.t('settings.off'), () => {
      const on = !s.fullscreen;
      void platform.setFullscreen(on);
      set({ fullscreen: on });
    }, { w: 100, h: 16 });
    y += 40;
    new Button(this, 162, y, G.t('settings.resetSave'), () => this.confirmReset(), { w: 200, h: 20, fill: 0x7a2a2a });

    // Controls
    panel(this, 324, 40, 304, 270);
    text(this, 334, 48, G.t('settings.controls'), { color: COLORS.dim });
    ACTIONS.forEach((a, i) => {
      const yy = 72 + i * 24;
      text(this, 336, yy - 4, G.t(`action.${a}`));
      new Button(this, 560, yy, keyLabel(s.keybinds[a], G.t), () => this.beginRebind(a), { w: 110, h: 18 });
    });
    new Button(this, 476, 290, G.t('settings.resetKeys'), () => set({ keybinds: { ...DEFAULT_KEYBINDS } }), { w: 160, h: 18 });

    new Button(this, 70, 336, G.t('menu.back'), () => this.scene.start('Menu'), { w: 100 });
    this.input.keyboard?.on('keydown-ESC', () => { if (!this.waiting) this.scene.start('Menu'); });
  }

  private beginRebind(action: Action) {
    this.waiting = action;
    const shade = this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.85).setOrigin(0).setInteractive().setDepth(50);
    const msg = text(this, 320, 170, G.t('settings.pressKey'), { origin: [0.5, 0.5], scale: 1, color: COLORS.gold }).setDepth(51);
    const label = text(this, 320, 150, G.t(`action.${action}`), { origin: [0.5, 0.5], scale: 2 }).setDepth(51);
    const finish = (key: string | null) => {
      this.input.keyboard?.off('keydown', onKey);
      shade.destroy(); msg.destroy(); label.destroy();
      this.time.delayedCall(50, () => { this.waiting = null; });
      if (key) {
        G.update({ ...G.save, settings: { ...G.save.settings, keybinds: rebind(G.save.settings.keybinds, action, key) } });
        audio.play('click');
        this.scene.restart();
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && action !== 'pause') { finish(null); return; }
      const name = Object.entries(Phaser.Input.Keyboard.KeyCodes).find(([, code]) => code === ev.keyCode)?.[0];
      finish(name ?? null);
    };
    this.time.delayedCall(80, () => {
      this.input.keyboard?.on('keydown', onKey);
      shade.once('pointerdown', (p: Phaser.Input.Pointer) => finish(p.rightButtonDown() ? 'MOUSE_RIGHT' : 'MOUSE_LEFT'));
    });
  }

  private confirmReset() {
    const layer = this.add.container(0, 0).setDepth(60);
    layer.add(this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.85).setOrigin(0).setInteractive());
    layer.add(panel(this, 180, 130, 280, 100));
    layer.add(text(this, 320, 148, G.t('settings.confirmReset'), { origin: [0.5, 0], color: COLORS.red, maxWidth: 260 }));
    layer.add(new Button(this, 270, 200, G.t('settings.yes'), async () => { await G.reset(); this.scene.start('Menu'); }, { w: 80, fill: 0x7a2a2a }));
    layer.add(new Button(this, 370, 200, G.t('settings.no'), () => layer.destroy(), { w: 80 }));
  }
}
