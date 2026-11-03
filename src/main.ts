import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { StageScene } from './game/scenes/StageScene';
import { LevelUpScene } from './game/scenes/LevelUpScene';
import { PauseScene } from './game/scenes/PauseScene';
import { ResultScene } from './game/scenes/ResultScene';
import { ShopScene } from './game/scenes/ShopScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { CharacterScene } from './game/scenes/CharacterScene';
import { CutsceneScene } from './game/scenes/CutsceneScene';
import { SuperScene } from './game/scenes/SuperScene';

/**
 * Internal resolution 640x360 (16px tiles), scaled to the window with nearest
 * filtering: exactly 3x at 1920x1080.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0b0b14',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false, tileBias: 20 } },
  fps: { target: 60 },
  input: { mouse: { preventDefaultWheel: true } },
  scene: [BootScene, MenuScene, StageScene, LevelUpScene, PauseScene, ResultScene, ShopScene, SettingsScene, CharacterScene, CutsceneScene, SuperScene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
