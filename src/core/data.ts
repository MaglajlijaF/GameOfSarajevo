import stagesFile from '../data/stages.json';
import enemiesFile from '../data/enemies.json';
import bossesFile from '../data/bosses.json';
import weaponsFile from '../data/weapons.json';
import buffsFile from '../data/buffs.json';
import shopFile from '../data/shop.json';
import charactersFile from '../data/characters.json';
import themesFile from '../data/themes.json';
import layoutsFile from '../data/layouts.json';
import type { BossDef, BuffDef, CharacterDef, EnemyDef, GameData, ShopFile, StagesFile, StageDef, ThemeDef, WeaponDef } from './types';
import type { SaveContext } from './save';

function withIds<T>(rec: Record<string, unknown>): Record<string, T> {
  return Object.fromEntries(Object.entries(rec).map(([id, v]) => [id, { id, ...(v as object) } as T]));
}

export function buildGameData(): GameData {
  const sf = stagesFile as unknown as StagesFile;
  const data: GameData = {
    stageOrder: [...sf.order],
    stages: withIds<StageDef>(sf.stages),
    enemies: withIds<EnemyDef>(enemiesFile),
    bosses: withIds<BossDef>(bossesFile),
    weapons: withIds<WeaponDef>(weaponsFile),
    buffs: withIds<BuffDef>(buffsFile),
    shop: shopFile as ShopFile,
    characters: charactersFile as CharacterDef[],
    themes: themesFile as Record<string, ThemeDef>,
    layouts: layoutsFile as Record<string, string[]>,
  };
  const problems = validateGameData(data);
  if (problems.length) throw new Error('Invalid game data:\n' + problems.join('\n'));
  return data;
}

/** Cross-reference checks so a bad edit to a data file fails loudly at boot and in tests. */
export function validateGameData(d: GameData): string[] {
  const p: string[] = [];
  if (new Set(d.stageOrder).size !== d.stageOrder.length) p.push('stage order has duplicates');
  for (const id of d.stageOrder) {
    const s = d.stages[id];
    if (!s) { p.push(`stage order references unknown stage ${id}`); continue; }
    if (s.waves.length !== 5) p.push(`${id}: expected 5 waves, got ${s.waves.length}`);
    if (!d.bosses[s.boss]) p.push(`${id}: unknown boss ${s.boss}`);
    if (!d.themes[s.theme]) p.push(`${id}: unknown theme ${s.theme}`);
    if (!d.layouts[s.bossLayout]) p.push(`${id}: unknown boss layout ${s.bossLayout}`);
    for (const e of s.enemies) if (!d.enemies[e]) p.push(`${id}: unknown enemy ${e}`);
    s.waves.forEach((w, i) => {
      if (!d.layouts[w.layout]) p.push(`${id} wave ${i + 1}: unknown layout ${w.layout}`);
      for (const sp of w.spawns) if (!d.enemies[sp.enemy]) p.push(`${id} wave ${i + 1}: unknown enemy ${sp.enemy}`);
    });
  }
  for (const [id, rows] of Object.entries(d.layouts)) {
    if (rows.length !== 23 || rows.some((r) => r.length !== 40)) p.push(`layout ${id} must be 40x23`);
  }
  for (const b of Object.values(d.bosses)) {
    if (b.phases.length < 2) p.push(`boss ${b.id}: needs at least 2 phases`);
    if (b.summon && !d.enemies[b.summon]) p.push(`boss ${b.id}: unknown summon ${b.summon}`);
  }
  if (!d.weapons[d.shop.defaultStartWeapon]) p.push('shop: unknown default start weapon');
  if (Object.keys(d.weapons).length < 10) p.push('need at least 10 weapons');
  if (!d.characters.length) p.push('need at least one character');
  return p;
}

export function saveContextFrom(d: GameData): SaveContext {
  return {
    stageOrder: d.stageOrder,
    stages: d.stages,
    upgrades: d.shop.upgrades,
    weapons: d.weapons,
    defaultStarter: d.shop.defaultStartWeapon,
    characters: d.characters.map((c) => c.id),
  };
}
