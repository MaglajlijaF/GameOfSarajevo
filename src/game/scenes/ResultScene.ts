import Phaser from 'phaser';
import { G, type RunSummary } from '../services';
import { Button, COLORS, panel, text } from '../ui/ui';
import { audio } from '../../audio/audio';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(d: { summary: RunSummary; reward: number; unlocked: string | null }): void {
    const win = d.summary.outcome === 'victory';
    this.add.image(0, 0, 'ui_map').setOrigin(0).setAlpha(0.35);
    panel(this, 160, 70, 320, 220);
    text(this, 320, 84, G.t(win ? 'result.victory' : 'result.defeat'), { scale: 3, origin: [0.5, 0], color: win ? COLORS.gold : COLORS.red });
    text(this, 320, 120, G.data.stages[d.summary.stageId].name, { scale: 2, origin: [0.5, 0] });
    let y = 152;
    const line = (s: string, c: number = COLORS.text) => { text(this, 320, y, s, { origin: [0.5, 0], color: c }); y += 16; };
    line(d.reward > 0 ? G.t('result.reward', { km: d.reward }) : G.t('result.noReward'), d.reward > 0 ? COLORS.km : COLORS.dim);
    line(G.t('result.kills', { n: d.summary.kills }));
    line(G.t('result.level', { lv: d.summary.level }));
    if (d.unlocked) line(G.t('result.unlocked', { stage: G.data.stages[d.unlocked].name }), COLORS.green);
    if (d.reward > 0) this.time.delayedCall(300, () => audio.play('coin'));
    new Button(this, 320, 264, G.t('result.continue'), () => this.scene.start('Menu'), { w: 160, h: 22 });
    this.cameras.main.fadeIn(250);
  }
}
