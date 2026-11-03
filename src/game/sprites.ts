import Phaser from 'phaser';
import { framesToCanvas } from '../art/pixel';
import { ANIMS, FRAME, humanoidFrames } from '../art/characters';
import { CUSTOM_ID, CUSTOM_SPRITE, customRecipe, type CustomCharacter } from '../core/custom';
import { hashString } from '../core/rng';
import { G } from './services';

/** Registers the shared 14-frame animation set for a character sheet. */
export function registerCharacterAnims(scene: Phaser.Scene, key: string): void {
  const mk = (name: string, frames: readonly number[], rate: number, repeat: number) => {
    if (scene.anims.exists(`${key}_${name}`)) return;
    scene.anims.create({ key: `${key}_${name}`, frames: frames.map((f) => ({ key, frame: f })), frameRate: rate, repeat });
  };
  mk('idle', ANIMS.idle, 3, -1);
  mk('run', ANIMS.run, 10, -1);
  mk('jump', ANIMS.jump, 1, 0);
  mk('fall', ANIMS.fall, 1, 0);
  mk('attack', ANIMS.attack, 14, 0);
  mk('hurt', ANIMS.hurt, 1, 0);
  mk('defeat', ANIMS.defeat, 4, 0);
}

/**
 * Builds (once per look) the sprite sheet for a player-made character and
 * returns its texture key. Each look gets its own key, so animations never
 * point at a replaced texture.
 */
export function customSprite(scene: Phaser.Scene, c: CustomCharacter): string {
  const r = customRecipe(c);
  const key = `${CUSTOM_SPRITE}_${(hashString(JSON.stringify(r)) >>> 0).toString(36)}`;
  if (!scene.textures.exists(key)) {
    const frames = humanoidFrames(r);
    const tex = scene.textures.addCanvas(key, framesToCanvas(frames))!;
    frames.forEach((_, i) => tex.add(i, 0, i * FRAME, 0, FRAME, FRAME));
    registerCharacterAnims(scene, key);
  }
  return key;
}

/** Sprite key of the currently selected character (preset or custom). */
export function playerSprite(scene: Phaser.Scene): string {
  if (G.save.selectedCharacter === CUSTOM_ID) return customSprite(scene, G.save.custom);
  const ch = G.data.characters.find((c) => c.id === G.save.selectedCharacter) ?? G.data.characters[0];
  return ch.sprite;
}

/** Display name of the player: the custom name, or the preset character's name. */
export function playerName(): string {
  if (G.save.selectedCharacter === CUSTOM_ID) return G.save.custom.name || G.t('creator.defaultName');
  return G.t(`character.${G.save.selectedCharacter}`);
}
