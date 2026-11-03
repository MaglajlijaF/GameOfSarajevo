import { DEFAULT_KEYBINDS, sanitizeKeybinds, type Keybinds } from './input';
import { computeUnlocked, nextStage, validateCleared, type StageOutcome } from './progression';
import { canAfford, stageReward, starterCost, upgradeCost } from './economy';
import type { Lang, ShopUpgradeDef, StageDef, WeaponDef } from './types';
import { CUSTOM_ID, defaultCustom, sanitizeCustom, type CustomCharacter } from './custom';

export type AimMode = 'mouse' | 'keyboard';

export const SAVE_VERSION = 1;

export interface Settings {
  lang: Lang;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  fullscreen: boolean;
  /** mouse: attack toward the cursor. keyboard: attack where the character faces. */
  aimMode: AimMode;
  keybinds: Keybinds;
}

export interface SaveData {
  version: number;
  km: number;
  upgrades: Record<string, number>;
  /** Derived from `cleared` on load; stored for readability of the JSON file. */
  unlocked: string[];
  cleared: string[];
  ownedStarters: string[];
  selectedStarter: string;
  selectedCharacter: string;
  /** The player-made character ('custom' in selectedCharacter). */
  custom: CustomCharacter;
  /** Story flags: intro cutscene + tutorial shown, ending seen. */
  seenIntro: boolean;
  tutorialDone: boolean;
  seenEnding: boolean;
  settings: Settings;
  stats: { runs: number; wins: number; kills: number };
}

/** The parts of the game data a save needs to be validated against. */
export interface SaveContext {
  stageOrder: string[];
  stages: Record<string, Pick<StageDef, 'reward' | 'replayFactor'>>;
  upgrades: ShopUpgradeDef[];
  weapons: Record<string, WeaponDef>;
  defaultStarter: string;
  characters: string[];
}

export function defaultSettings(): Settings {
  return { lang: 'bs', masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.8, fullscreen: false, aimMode: 'mouse', keybinds: { ...DEFAULT_KEYBINDS } };
}

export function createDefaultSave(ctx: SaveContext): SaveData {
  return {
    version: SAVE_VERSION,
    km: 0,
    upgrades: Object.fromEntries(ctx.upgrades.map((u) => [u.id, 0])),
    unlocked: computeUnlocked(ctx.stageOrder, []),
    cleared: [],
    ownedStarters: [ctx.defaultStarter],
    selectedStarter: ctx.defaultStarter,
    selectedCharacter: ctx.characters[0],
    custom: defaultCustom(),
    seenIntro: false,
    tutorialDone: false,
    seenEnding: false,
    settings: defaultSettings(),
    stats: { runs: 0, wins: 0, kills: 0 },
  };
}

const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
const nonNegInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Turns anything (corrupt JSON, old versions, hand-edited files) into a valid save.
 * Unlock progress is never trusted: it is recomputed from the clear chain.
 */
export function validateSave(raw: unknown, ctx: SaveContext): SaveData {
  const base = createDefaultSave(ctx);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;

  const cleared = validateCleared(ctx.stageOrder, strArr(r.cleared).filter((id) => ctx.stageOrder.includes(id)));

  const upgrades: Record<string, number> = {};
  const ru = (r.upgrades && typeof r.upgrades === 'object' ? r.upgrades : {}) as Record<string, unknown>;
  for (const u of ctx.upgrades) upgrades[u.id] = Math.min(u.maxLevel, nonNegInt(ru[u.id]));

  const isStarter = (id: string) => id === ctx.defaultStarter || !!ctx.weapons[id]?.starter;
  const owned = Array.from(new Set([ctx.defaultStarter, ...strArr(r.ownedStarters).filter(isStarter)]));
  const selectedStarter = typeof r.selectedStarter === 'string' && owned.includes(r.selectedStarter) ? r.selectedStarter : ctx.defaultStarter;
  const selectedCharacter = typeof r.selectedCharacter === 'string' && (ctx.characters.includes(r.selectedCharacter) || r.selectedCharacter === CUSTOM_ID)
    ? r.selectedCharacter : ctx.characters[0];

  const rs = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const d = defaultSettings();
  const settings: Settings = {
    lang: rs.lang === 'en' || rs.lang === 'bs' ? rs.lang : d.lang,
    masterVolume: clamp01(rs.masterVolume, d.masterVolume),
    musicVolume: clamp01(rs.musicVolume, d.musicVolume),
    sfxVolume: clamp01(rs.sfxVolume, d.sfxVolume),
    fullscreen: typeof rs.fullscreen === 'boolean' ? rs.fullscreen : d.fullscreen,
    aimMode: rs.aimMode === 'keyboard' ? 'keyboard' : 'mouse',
    keybinds: sanitizeKeybinds(rs.keybinds),
  };

  const st = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;

  return {
    version: SAVE_VERSION,
    km: nonNegInt(r.km),
    upgrades,
    cleared,
    unlocked: computeUnlocked(ctx.stageOrder, cleared),
    ownedStarters: owned,
    selectedStarter,
    selectedCharacter,
    custom: sanitizeCustom(r.custom),
    seenIntro: r.seenIntro === true,
    tutorialDone: r.tutorialDone === true,
    // The ending can only have been seen if the whole campaign is cleared.
    seenEnding: r.seenEnding === true && cleared.length === ctx.stageOrder.length,
    settings,
    stats: { runs: nonNegInt(st.runs), wins: nonNegInt(st.wins), kills: nonNegInt(st.kills) },
  };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save, null, 2);
}

export function parseSave(json: string | null | undefined, ctx: SaveContext): SaveData {
  if (!json) return createDefaultSave(ctx);
  try { return validateSave(JSON.parse(json), ctx); } catch { return createDefaultSave(ctx); }
}

export interface StageResult {
  save: SaveData;
  reward: number;
  unlockedStage: string | null;
  firstClear: boolean;
}

/**
 * Applies the end of a stage run. Only a victory on an unlocked stage pays KM
 * and can unlock the next stage. All other outcomes only bump statistics.
 */
export function applyStageResult(save: SaveData, ctx: SaveContext, stageId: string, outcome: StageOutcome, kills = 0): StageResult {
  const next: SaveData = { ...save, stats: { ...save.stats, runs: save.stats.runs + 1, kills: save.stats.kills + nonNegInt(kills) } };
  const unlockedNow = computeUnlocked(ctx.stageOrder, save.cleared);
  const stage = ctx.stages[stageId];
  if (outcome !== 'victory' || !stage || !unlockedNow.includes(stageId)) {
    return { save: next, reward: 0, unlockedStage: null, firstClear: false };
  }
  const already = save.cleared.includes(stageId);
  const reward = stageReward(stage, already);
  const cleared = validateCleared(ctx.stageOrder, [...save.cleared, stageId]);
  const unlocked = computeUnlocked(ctx.stageOrder, cleared);
  const nxt = nextStage(ctx.stageOrder, stageId);
  const unlockedStage = nxt && !unlockedNow.includes(nxt) && unlocked.includes(nxt) ? nxt : null;
  return {
    save: { ...next, km: next.km + reward, cleared, unlocked, stats: { ...next.stats, wins: next.stats.wins + 1 } },
    reward,
    unlockedStage,
    firstClear: !already,
  };
}

export function buyUpgrade(save: SaveData, ctx: SaveContext, upgradeId: string): { save: SaveData; ok: boolean } {
  const def = ctx.upgrades.find((u) => u.id === upgradeId);
  if (!def) return { save, ok: false };
  const level = save.upgrades[upgradeId] ?? 0;
  if (level >= def.maxLevel) return { save, ok: false };
  const cost = upgradeCost(def, level);
  if (!canAfford(save.km, cost)) return { save, ok: false };
  return { save: { ...save, km: save.km - cost, upgrades: { ...save.upgrades, [upgradeId]: level + 1 } }, ok: true };
}

export function buyStarter(save: SaveData, ctx: SaveContext, weaponId: string): { save: SaveData; ok: boolean } {
  const def = ctx.weapons[weaponId];
  if (!def?.starter || save.ownedStarters.includes(weaponId)) return { save, ok: false };
  const cost = starterCost(def);
  if (!canAfford(save.km, cost)) return { save, ok: false };
  return { save: { ...save, km: save.km - cost, ownedStarters: [...save.ownedStarters, weaponId], selectedStarter: weaponId }, ok: true };
}

export function selectStarter(save: SaveData, weaponId: string): SaveData {
  return save.ownedStarters.includes(weaponId) ? { ...save, selectedStarter: weaponId } : save;
}
