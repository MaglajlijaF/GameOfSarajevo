import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, text } from '../ui/ui';
import type { StageScene } from './StageScene';

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  create(): void {
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.7).setOrigin(0);
    panel(this, 200, 110, 240, 140);
    text(this, 320, 122, G.t('pause.title'), { scale: 2, origin: [0.5, 0], color: COLORS.gold });
    const resume = () => { this.scene.stop(); this.scene.resume('Stage'); };
    new Button(this, 320, 168, G.t('pause.resume'), resume, { w: 160, primary: true });
    new Button(this, 320, 196, G.t('pause.quit'), () => {
      this.scene.stop();
      const st = this.scene.get('Stage') as StageScene;
      this.scene.resume('Stage');
      st.quit();
    }, { w: 160, fill: 0x7a2a2a });
    text(this, 320, 222, G.t('pause.quitWarn'), { origin: [0.5, 0], color: COLORS.dim, maxWidth: 220 });
    this.input.keyboard?.on('keydown-ESC', resume);
  }
}
