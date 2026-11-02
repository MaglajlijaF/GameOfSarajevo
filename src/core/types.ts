// Shared data types. Everything in src/core is pure TypeScript (no Phaser),
// so it can be unit-tested and reused by any renderer.

export type Lang = 'bs' | 'en';

export interface MapPos { x: number; y: number }

export interface WaveSpawn { enemy: string; count: number }

export interface WaveDef {
  /** Arena layout id from layouts.json */
  layout: string;
  spawns: WaveSpawn[];
  /** Max enemies alive at once in this wave */
  maxAlive: number;
  /** Seconds between spawns */
  interval: number;
}

export interface MusicDef {
  seed: number; tempo: number; scale: string; root: number;
  /** Lead instrument: square | pulse | saw | triangle */
  lead?: string;
  /** Drum pattern: march | dance | shuffle | halftime | gallop | breakbeat | waltz */
  drums?: string;
  /** Composition style: sevdah | waltz | arcade | funk | anthem | drive | polka | hiphop */
  style?: string;
  /** Optional imported song (src/data/music/<track>.json, made by scripts/import-midi.mjs) */
  track?: string;
}

export interface StageDef {
  id: string;
  /** Display name (proper noun, same in every language) */
  name: string;
  map: MapPos;
  theme: string;
  reward: number;
  /** Fraction of reward paid when replaying an already-cleared stage */
  replayFactor: number;
  enemies: string[];
  boss: string;
  bossLayout: string;
  hazard: string;
  /** Global multiplier on enemy hp/damage for this stage */
  difficulty: number;
  music: MusicDef;
  waves: WaveDef[];
}

export interface StagesFile {
  /** Order controls unlocking; reorder this array to reorder the campaign. */
  order: string[];
  stages: Record<string, Omit<StageDef, 'id'>>;
}

export type EnemyBehavior =
  | 'walker' | 'charger' | 'thrower' | 'jumper' | 'shooter' | 'bomber' | 'dasher'
  | 'shielder' | 'summoner' | 'sniper' | 'roller' | 'buffer' | 'dropper' | 'spinner';

export interface EnemyDef {
  id: string;
  sprite: string;
  behavior: EnemyBehavior;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  /** Behavior-specific tuning */
  params: Record<string, number>;
  projectile?: string;
}

export type BossAttack =
  | 'slam' | 'charge' | 'volley' | 'rain' | 'shockwave' | 'summon' | 'leap'
  | 'barrage' | 'spiral' | 'laser' | 'teleport' | 'zigzag' | 'trap' | 'roll' | 'pull' | 'meteor' | 'shield';

export interface BossPhase {
  /** Phase is active while hp fraction is <= this value */
  hpBelow: number;
  attacks: BossAttack[];
  /** Seconds idle between attacks */
  pause: number;
  speed: number;
}

export interface BossDef {
  id: string;
  sprite: string;
  hp: number;
  damage: number;
  xp: number;
  projectile: string;
  summon?: string;
  /** Tint used for this boss's beams, traps and rings */
  color?: string;
  phases: BossPhase[];
}

export type WeaponKind =
  | 'swing' | 'projectile' | 'spread' | 'boomerang' | 'orbit'
  | 'shockwave' | 'homing' | 'pulse' | 'bouncer'
  | 'mod_slow' | 'mod_burn' | 'mod_chain';

export interface WeaponDef {
  id: string;
  kind: WeaponKind;
  /** Gender of the noun, used for Bosnian adjective agreement */
  gender: 'm' | 'f' | 'n';
  color: string;
  /** Seconds between activations of this behavior */
  cooldown: number;
  damage: number;
  /** Behavior-specific numbers. Values in perTier are added per tier above 1. */
  params: Record<string, number>;
  perTier: Record<string, number>;
  maxTier: number;
  /** Can be bought in the shop as a starting weapon */
  starter?: boolean;
  starterCost?: number;
}

export interface BuffDef {
  id: 'strength' | 'speed' | 'durability';
  color: string;
  /** Added per pick */
  damageMult?: number;
  speedMult?: number;
  attackSpeedMult?: number;
  maxHp?: number;
  heal?: number;
}

export interface ShopUpgradeDef {
  id: 'health' | 'damage' | 'speed' | 'xp';
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  /** Effect per level */
  perLevel: number;
}

export interface ShopFile { upgrades: ShopUpgradeDef[]; defaultStartWeapon: string }

export interface CharacterRecipe {
  skin: string; hair: string; hairStyle: string; shirt: string; shirt2: string;
  pants: string; shoes: string; accessory?: string; accessoryColor?: string; eyes?: string;
  /** Held or worn item drawn from PROPS in art/props.ts */
  prop?: string;
}

export interface CharacterDef {
  id: string;
  gender: 'm' | 'f';
  sprite: string;
  recipe: CharacterRecipe;
}

export interface ThemeDef {
  sky: [string, string];
  far: string; farDetail: string;
  mid: string; midDetail: string; roof: string;
  groundTop: string; ground: string; groundDark: string;
  platform: string; platformDark: string;
  /** coals | water | sparks | thorns | cement | paint | ice | tar | jet */
  hazardStyle: string;
  /** oldtown | hillside | modern | blocks | industrial | brick | stadium | airport | plaza */
  backdrop: string;
  /** cobble | stone | concrete | asphalt | grass | brick | ice | track | tarmac */
  groundStyle?: string;
  /** wood | metal | concrete | awning | brick */
  platformStyle?: string;
  accent?: string;
  night?: boolean;
  snow?: boolean;
  /** Hazard contact damage (default 16) and slow while standing in it */
  hazardDamage?: number;
}

export interface GameData {
  stageOrder: string[];
  stages: Record<string, StageDef>;
  enemies: Record<string, EnemyDef>;
  bosses: Record<string, BossDef>;
  weapons: Record<string, WeaponDef>;
  buffs: Record<string, BuffDef>;
  shop: ShopFile;
  characters: CharacterDef[];
  themes: Record<string, ThemeDef>;
  layouts: Record<string, string[]>;
}
