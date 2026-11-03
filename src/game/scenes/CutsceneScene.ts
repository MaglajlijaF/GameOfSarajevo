import Phaser from 'phaser';
import { G } from '../services';
import { COLORS, panel, setText, text } from '../ui/ui';
import { audio } from '../../audio/audio';
import { normalizeText } from '../../art/font';
import { playerName, playerSprite } from '../sprites';
import type { MusicDef } from '../../core/types';

type Kind = 'intro' | 'ending';

const STORY_MUSIC: MusicDef = { seed: 1462, tempo: 92, scale: 'hijaz', root: 57, lead: 'triangle', drums: 'halftime', style: 'sevdah' };
const ENDING_MUSIC: MusicDef = { seed: 2025, tempo: 132, scale: 'major', root: 60, lead: 'square', drums: 'dance', style: 'anthem' };
/** y of the street surface in cutscenes. */
const FLOOR = 262;
const CONFETTI = [0xe8483a, 0xf2d64b, 0x5ad05a, 0x6ab0f0, 0xf59ac8, 0xffffff, 0xe0802a, 0xb48ae0];

interface Beat { text: string; enter: () => void; hold?: boolean }

/**
 * Story cutscenes. The intro sets up the goal (beat the boss of every
 * neighbourhood and make Sarajevo a Šeher again); the ending plays once the
 * last boss falls, with confetti and the closing title.
 * Enter/Space/click: finish the line or go to the next beat. Esc: skip.
 */
export class CutsceneScene extends Phaser.Scene {
  private kind: Kind = 'intro';
  private beats: Beat[] = [];
  private idx = -1;
  private line!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private full = '';
  private shown = 0;
  private typeT = 0;
  private autoT = 0;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private actors: Phaser.GameObjects.Sprite[] = [];
  private hero!: Phaser.GameObjects.Sprite;
  private stage!: Phaser.GameObjects.Container;
  private confetti: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private done = false;

  constructor() { super('Cutscene'); }

  create(d: { kind: Kind }): void {
    this.kind = d.kind ?? 'intro';
    this.idx = -1; this.layers = []; this.actors = []; this.confetti = null; this.done = false;
    const theme = this.kind === 'intro' ? 'kovaci' : 'dobrinja';
    for (const [layer, f] of [['sky', 0], ['far', 1], ['mid', 2]] as const) {
      const t = this.add.tileSprite(0, 0, 640, 360, `bg_${theme}_${layer}`).setOrigin(0).setDepth(f);
      this.layers.push(t);
    }
    // Street level sits just above the text box so nobody stands behind it.
    this.add.tileSprite(0, FLOOR, 640, 360 - FLOOR, `tiles_${theme}`, 1).setOrigin(0).setDepth(3);
    this.add.tileSprite(0, FLOOR, 640, 16, `tiles_${theme}`, 0).setOrigin(0).setDepth(3);
    this.stage = this.add.container(0, 0).setDepth(5);
    this.hero = this.add.sprite(-40, FLOOR, playerSprite(this)).setOrigin(0.5, 1).setScale(3).setDepth(8);

    panel(this, 20, 282, 600, 66, COLORS.panel, 0.92).setDepth(50);
    this.line = text(this, 32, 292, '', { maxWidth: 576 }).setDepth(51);
    this.hint = text(this, 610, 340, '', { origin: [1, 1], color: COLORS.dim }).setDepth(51);
    text(this, 630, 8, G.t('story.skip'), { origin: [1, 0], color: COLORS.dim }).setDepth(51);

    this.beats = this.kind === 'intro' ? this.introBeats() : this.endingBeats();
    audio.playMusic(this.kind === 'intro' ? STORY_MUSIC : ENDING_MUSIC);
    this.input.keyboard?.on('keydown-ENTER', this.advance, this);
    this.input.keyboard?.on('keydown-SPACE', this.advance, this);
    this.input.keyboard?.on('keydown-ESC', this.finish, this);
    this.input.on('pointerdown', () => { audio.unlock(); this.advance(); });
    this.cameras.main.fadeIn(500);
    this.next();
  }

  // ---------- beats ----------
  private introBeats(): Beat[] {
    const name = playerName();
    return [
      { text: G.t('story.intro1'), enter: () => { this.walkHero(false); } },
      { text: G.t('story.intro2'), enter: () => this.bossesArrive() },
      { text: G.t('story.intro3', { name }), enter: () => this.heroSteps() },
      { text: G.t('story.intro4'), enter: () => this.showMap() },
      { text: G.t('story.intro5'), enter: () => this.titleCard(G.t('game.title'), G.t('story.tagline')), hold: true },
    ];
  }

  private endingBeats(): Beat[] {
    const name = playerName();
    return [
      { text: G.t('story.end1'), enter: () => this.dawn() },
      { text: G.t('story.end2'), enter: () => this.bossesCelebrate() },
      { text: G.t('story.end3', { name }), enter: () => this.celebrate(), hold: true },
    ];
  }

  private walkHero(stop: boolean) {
    this.hero.setVisible(true).setFlipX(false).play(`${this.hero.texture.key}_run`, true);
    this.tweens.add({ targets: this.hero, x: stop ? 320 : 150, duration: 1800, onComplete: () => this.hero.play(`${this.hero.texture.key}_idle`) });
  }

  private bossesArrive() {
    this.tweens.addCounter({ from: 255, to: 120, duration: 1200, onUpdate: (tw) => { const v = Math.round(tw.getValue() ?? 0); this.layers.forEach((l) => l.setTint(Phaser.Display.Color.GetColor(v, Math.round(v * 0.85), Math.round(v * 1.1)))); } });
    this.tweens.add({ targets: this.hero, x: 60, duration: 400 });
    this.hero.setFlipX(true).play(`${this.hero.texture.key}_hurt`);
    G.data.stageOrder.forEach((id, i) => {
      const def = G.data.bosses[G.data.stages[id].boss];
      const x = 96 + i * 42, y = FLOOR - 6 + (i % 2) * 4;
      const s = this.add.sprite(x, -60, def.sprite).setOrigin(0.5, 1).play(`${def.sprite}_idle`).setFlipX(true);
      this.stage.add(s);
      this.actors.push(s);
      this.tweens.add({ targets: s, y, delay: 150 + i * 160, duration: 380, ease: 'Bounce.Out', onStart: () => { if (i % 3 === 0) audio.play('slam'); } });
    });
    this.time.delayedCall(150 + 13 * 160, () => this.cameras.main.shake(300, 0.006));
  }

  private heroSteps() {
    this.hero.setFlipX(false).play(`${this.hero.texture.key}_run`, true);
    this.actors.forEach((a) => this.tweens.add({ targets: a, alpha: 0.35, duration: 500 }));
    this.tweens.add({
      targets: this.hero, x: 320, duration: 1200,
      onComplete: () => {
        this.hero.play(`${this.hero.texture.key}_attack`);
        const icon = this.add.image(320, FLOOR - 92, 'icon_rucka').setScale(3).setDepth(9);
        this.tweens.add({ targets: icon, y: FLOOR - 104, angle: 360, duration: 900, ease: 'Back.Out' });
        audio.play('levelup');
      },
    });
  }

  private showMap() {
    this.actors.forEach((a) => a.destroy());
    this.actors = [];
    this.hero.setVisible(false);
    this.children.list.filter((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === 'icon_rucka').forEach((o) => o.destroy());
    const map = this.add.image(0, 0, 'ui_map').setOrigin(0).setDepth(20).setAlpha(0);
    this.tweens.add({ targets: map, alpha: 1, duration: 400 });
    const g = this.add.graphics().setDepth(21);
    const order = G.data.stageOrder;
    order.forEach((id, i) => this.time.delayedCall(500 + i * 230, () => {
      const st = G.data.stages[id];
      if (i > 0) {
        const a = G.data.stages[order[i - 1]].map;
        g.lineStyle(2, 0xf2d64b, 1).lineBetween(a.x, a.y, st.map.x, st.map.y);
      }
      g.fillStyle(0x1a1420, 1).fillCircle(st.map.x, st.map.y, 7);
      g.fillStyle(0xe8483a, 1).fillCircle(st.map.x, st.map.y, 5);
      text(this, st.map.x, st.map.y + 9, st.name, { origin: [0.5, 0] }).setDepth(22);
      audio.play('click');
    }));
  }

  private titleCard(title: string, sub: string) {
    const shade = this.add.rectangle(0, 0, 640, 282, 0x0b0b14, 0.65).setOrigin(0).setDepth(40).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 400 });
    const t = text(this, 320, 110, title, { scale: 4, origin: [0.5, 0.5], color: COLORS.gold }).setDepth(41).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 600, ease: 'Back.Out' });
    const s = text(this, 320, 160, sub, { scale: 2, origin: [0.5, 0.5] }).setDepth(41).setAlpha(0);
    this.tweens.add({ targets: s, alpha: 1, delay: 500, duration: 400 });
    audio.play('victory');
  }

  private dawn() {
    this.layers.forEach((l) => l.setTint(0x303048));
    this.tweens.addCounter({ from: 0, to: 1, duration: 3500, onUpdate: (tw) => {
      const k = tw.getValue() ?? 0;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x303048), Phaser.Display.Color.ValueToColor(0xffffff), 1, k);
      this.layers.forEach((l) => l.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)));
    } });
    this.walkHero(true);
  }

  private bossesCelebrate() {
    G.data.stageOrder.forEach((id, i) => {
      const def = G.data.bosses[G.data.stages[id].boss];
      const left = i < 7;
      const x = left ? 40 + i * 36 : 380 + (i - 7) * 40;
      const s = this.add.sprite(left ? -60 : 700, FLOOR - 4, def.sprite).setOrigin(0.5, 1).play(`${def.sprite}_run`).setFlipX(!left);
      this.stage.add(s);
      this.actors.push(s);
      this.tweens.add({
        targets: s, x, delay: i * 120, duration: 900,
        onComplete: () => {
          s.play(`${def.sprite}_idle`).setFlipX(x > 320);
          this.tweens.add({ targets: s, y: FLOOR - 16, duration: 260, yoyo: true, repeat: -1, delay: (i % 4) * 130, ease: 'Sine.Out' });
        },
      });
    });
  }

  private celebrate() {
    this.confetti = this.add.particles(0, 0, 'fx_confetti', {
      x: { min: 0, max: 640 }, y: -10, lifespan: 5200, speedY: { min: 40, max: 110 }, speedX: { min: -30, max: 30 },
      rotate: { start: 0, end: 720 }, scaleX: { start: 1, end: 0.3 }, tint: CONFETTI, quantity: 3, frequency: 40, gravityY: 20,
    }).setDepth(45);
    const fireworks = () => {
      if (!this.scene.isActive()) return;
      const x = Phaser.Math.Between(80, 560), y = Phaser.Math.Between(40, 150);
      const col = Phaser.Utils.Array.GetRandom(CONFETTI);
      const r = this.add.image(x, y, 'fx_ring').setTint(col).setDepth(44).setScale(0.2);
      this.tweens.add({ targets: r, scale: 2.4, alpha: 0, duration: 700, onComplete: () => r.destroy() });
      this.add.particles(x, y, 'fx_px', { speed: { min: 40, max: 140 }, lifespan: 700, tint: col, quantity: 18, emitting: false, gravityY: 120 }).setDepth(44).explode(18);
      audio.play('firework');
      this.time.delayedCall(Phaser.Math.Between(350, 800), fireworks);
    };
    fireworks();
    this.hero.play(`${this.hero.texture.key}_attack`);
    this.tweens.add({ targets: this.hero, y: FLOOR - 20, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.Out' });
    const title = normalizeText(G.t('story.finale'));
    const t = text(this, 320, 92, title, { scale: 3, origin: [0.5, 0.5], color: COLORS.gold }).setDepth(46).setScale(0.1);
    this.tweens.add({ targets: t, scale: 1, duration: 800, ease: 'Elastic.Out' });
    this.time.delayedCall(800, () => this.tweens.add({ targets: t, angle: { from: -2, to: 2 }, duration: 700, yoyo: true, repeat: -1 }));
    const st = G.save.stats;
    text(this, 320, 128, G.t('story.stats', { wins: st.wins, kills: st.kills }), { origin: [0.5, 0.5], color: COLORS.text }).setDepth(46);
    audio.play('victory');
  }

  // ---------- flow ----------
  private next() {
    this.idx++;
    if (this.idx >= this.beats.length) { this.finish(); return; }
    const b = this.beats[this.idx];
    this.full = normalizeText(b.text);
    this.shown = 0;
    this.typeT = 0;
    this.autoT = 0;
    setText(this.line, '');
    setText(this.hint, '');
    b.enter();
  }

  private advance() {
    if (this.done) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.line.setText(this.full); return; }
    audio.play('click');
    this.next();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const first = this.kind === 'intro' && !G.save.seenIntro;
    if (this.kind === 'intro') G.update({ ...G.save, seenIntro: true });
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      audio.stopMusic();
      if (first && !G.save.tutorialDone) this.scene.start('Stage', { stageId: G.data.stageOrder[0], tutorial: true });
      else this.scene.start('Menu');
    });
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.layers[1]?.setTilePosition(this.layers[1].tilePositionX + dt * 6);
    this.layers[2]?.setTilePosition(this.layers[2].tilePositionX + dt * 14);
    if (this.done || this.idx < 0) return;
    if (this.shown < this.full.length) {
      this.typeT += dt;
      const n = Math.min(this.full.length, Math.floor(this.typeT * 45));
      if (n > this.shown) {
        if (Math.floor(n / 3) !== Math.floor(this.shown / 3)) audio.play('type');
        this.shown = n;
        this.line.setText(this.full.slice(0, n));
      }
    } else {
      this.autoT += dt;
      const last = this.idx === this.beats.length - 1;
      setText(this.hint, G.t(last ? 'story.continue' : 'story.next'));
      this.hint.setAlpha(0.6 + Math.sin(this.autoT * 6) * 0.4);
      // Beats move on by themselves after a pause; the last one waits for the player.
      if (!this.beats[this.idx].hold && this.autoT > 3.2) this.next();
    }
  }
}
