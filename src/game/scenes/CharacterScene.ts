import Phaser from 'phaser';
import { G } from '../services';
import { Button, COLORS, panel, setText, text } from '../ui/ui';
import { nav } from '../ui/nav';
import { customSprite } from '../sprites';
import { CUSTOM_FIELDS, CUSTOM_ID, NAME_MAX, cycleCustom, sanitizeName, type CustomCharacter, type CustomField } from '../../core/custom';
import { audio } from '../../audio/audio';
import { color, hexToInt } from '../../art/palette';

/** Character select: six preset Sarajevans, plus a character creator with a name. */
export class CharacterScene extends Phaser.Scene {
  private draft!: CustomCharacter;
  private preview!: Phaser.GameObjects.Sprite;
  private values = new Map<CustomField, Phaser.GameObjects.BitmapText>();
  private swatches = new Map<CustomField, Phaser.GameObjects.Rectangle>();
  private nameText!: Phaser.GameObjects.BitmapText;
  private nameBox!: Phaser.GameObjects.Graphics;
  private typing = false;

  constructor() { super('Character'); }

  create(): void {
    this.draft = { ...G.save.custom };
    this.values = new Map(); this.swatches = new Map(); this.typing = false;
    this.add.image(0, 0, 'ui_map').setOrigin(0).setAlpha(0.3);
    this.add.rectangle(0, 0, 640, 360, 0x0b0b14, 0.5).setOrigin(0);
    text(this, 16, 10, G.t('character.title'), { scale: 2, color: COLORS.gold });

    // Presets
    G.data.characters.forEach((c, i) => {
      const x = 58 + i * 88, y = 34;
      const sel = G.save.selectedCharacter === c.id;
      panel(this, x - 40, y, 80, 104, sel ? 0x3a5a3a : 0x2e2846);
      const s = this.add.sprite(x, y + 40, c.sprite).setScale(3).play(`${c.sprite}_idle`);
      text(this, x, y + 78, G.t(`character.${c.id}`), { origin: [0.5, 0], color: sel ? COLORS.gold : COLORS.text });
      text(this, x, y + 90, G.t(c.gender === 'm' ? 'character.male' : 'character.female'), { origin: [0.5, 0], color: COLORS.dim });
      const z = this.add.zone(x - 40, y, 80, 104).setOrigin(0).setInteractive({ useHandCursor: true });
      const pick = () => { audio.play('click'); G.update({ ...G.save, selectedCharacter: c.id }); this.scene.restart(); };
      z.on('pointerover', () => s.play(`${c.sprite}_run`, true));
      z.on('pointerout', () => s.play(`${c.sprite}_idle`, true));
      z.on('pointerdown', pick);
      nav(this).add(z, pick, sel);
    });

    // Creator
    const sel = G.save.selectedCharacter === CUSTOM_ID;
    panel(this, 18, 146, 604, 176, sel ? 0x2e3e2e : COLORS.panel);
    text(this, 28, 152, G.t('creator.title'), { color: COLORS.gold, scale: 2 });
    if (sel) text(this, 612, 154, G.t('creator.selected'), { origin: [1, 0], color: COLORS.green });
    panel(this, 30, 172, 120, 140, 0x1a1626);
    this.preview = this.add.sprite(90, 248, customSprite(this, this.draft)).setScale(5).play(`${customSprite(this, this.draft)}_idle`);
    this.add.zone(30, 172, 120, 140).setOrigin(0).setInteractive().on('pointerdown', () => this.preview.play(`${this.preview.texture.key}_attack`).once('animationcomplete', () => this.preview.play(`${this.preview.texture.key}_idle`)));

    // Name
    text(this, 166, 178, G.t('creator.name'));
    this.nameBox = this.add.graphics();
    this.nameText = text(this, 262, 178, '');
    const nameZone = this.add.zone(256, 172, 180, 18).setOrigin(0).setInteractive({ useHandCursor: true });
    nameZone.on('pointerdown', () => this.startTyping());
    nav(this).add(nameZone, () => this.startTyping());

    // Option rows
    CUSTOM_FIELDS.forEach((f, i) => {
      const y = 206 + i * 20;
      text(this, 166, y - 3, G.t(`creator.${f}`));
      new Button(this, 270, y, '<', () => this.change(f, -1), { w: 18, h: 16 });
      if (f !== 'hairStyle') this.swatches.set(f, this.add.rectangle(296, y, 12, 12, 0xffffff).setStrokeStyle(1, 0x1a1420));
      this.values.set(f, text(this, 310, y, '', { origin: [0, 0.5] }));
      new Button(this, 426, y, '>', () => this.change(f, 1), { w: 18, h: 16 });
    });

    new Button(this, 532, 214, G.t('creator.random'), () => this.randomize(), { w: 140, h: 20 });
    new Button(this, 532, 290, G.t('creator.use'), () => this.useCustom(), { w: 140, h: 22, fill: 0x3a7a3a, primary: true });
    new Button(this, 70, 340, G.t('menu.back'), () => this.leave(), { w: 100 });
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.refresh();
  }

  private change(f: CustomField, step: 1 | -1) {
    this.draft = cycleCustom(this.draft, f, step);
    this.refresh();
  }

  private randomize() {
    for (const f of CUSTOM_FIELDS) {
      const n = Phaser.Math.Between(0, 11);
      for (let i = 0; i < n; i++) this.draft = cycleCustom(this.draft, f, 1);
    }
    this.refresh();
  }

  private refresh() {
    const key = customSprite(this, this.draft);
    if (this.preview.texture.key !== key) this.preview.setTexture(key).play(`${key}_idle`);
    for (const f of CUSTOM_FIELDS) {
      setText(this.values.get(f)!, G.t(`creator.${f}.${this.draft[f]}`));
      this.swatches.get(f)?.setFillStyle(hexToInt(color(this.draft[f])));
    }
    const caret = this.typing && Math.floor(this.time.now / 400) % 2 === 0 ? '_' : '';
    setText(this.nameText, (this.draft.name || (this.typing ? '' : G.t('creator.namePlaceholder'))) + caret);
    this.nameText.setTint(this.draft.name || this.typing ? COLORS.text : COLORS.dim);
    this.nameBox.clear();
    this.nameBox.fillStyle(this.typing ? 0x3a3458 : 0x231e36, 1).fillRect(256, 172, 180, 18);
    this.nameBox.lineStyle(1, this.typing ? COLORS.gold : 0x4a4466, 1).strokeRect(256.5, 172.5, 179, 17);
  }

  private startTyping() {
    if (this.typing) { this.stopTyping(); return; }
    this.typing = true;
    nav(this).enabled = false;
    audio.play('click');
    this.refresh();
  }

  private stopTyping() {
    this.typing = false;
    this.draft = { ...this.draft, name: this.draft.name.trim() };
    // Re-enable on the next tick so the Enter that ended typing doesn't also press a button.
    this.time.delayedCall(0, () => { nav(this).enabled = true; });
    this.refresh();
  }

  private onKey(ev: KeyboardEvent) {
    if (!this.typing) { if (ev.key === 'Escape') this.leave(); return; }
    if (ev.key === 'Enter' || ev.key === 'Escape') { this.stopTyping(); return; }
    if (ev.key === 'Backspace') { this.draft = { ...this.draft, name: this.draft.name.slice(0, -1) }; audio.play('type'); this.refresh(); return; }
    if (ev.key.length === 1 && this.draft.name.length < NAME_MAX) {
      const next = sanitizeName(this.draft.name + ev.key);
      if (next !== this.draft.name) { this.draft = { ...this.draft, name: next }; audio.play('type'); }
      this.refresh();
    }
  }

  private useCustom() {
    if (this.typing) this.stopTyping();
    G.update({ ...G.save, custom: { ...this.draft, name: this.draft.name.trim() }, selectedCharacter: CUSTOM_ID });
    audio.play('pickup');
    this.scene.restart();
  }

  private leave() {
    // Keep edits to the custom character even if it isn't selected.
    G.update({ ...G.save, custom: { ...this.draft, name: this.draft.name.trim() } });
    this.scene.start('Menu');
  }

  override update(): void { if (this.typing) this.refresh(); }
}
