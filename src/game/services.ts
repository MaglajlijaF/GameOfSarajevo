import { buildGameData, saveContextFrom } from '../core/data';
import { I18n } from '../core/i18n';
import { createDefaultSave, parseSave, serializeSave, type SaveData } from '../core/save';
import { platform } from '../platform/storage';
import { audio } from '../audio/audio';
import bs from '../data/lang/bs.json';
import en from '../data/lang/en.json';

/** Process-wide services shared by all scenes (data, language, save file). */
const data = buildGameData();
const ctx = saveContextFrom(data);
const i18n = new I18n({ bs, en }, 'bs');

export const G = {
  data,
  ctx,
  i18n,
  save: createDefaultSave(ctx) as SaveData,
  t: (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars),

  async load(): Promise<void> {
    G.save = parseSave(await platform.readSave(), ctx);
    G.applySettings();
    // Write back immediately so a repaired/validated save replaces a bad file.
    await G.persist();
  },

  async persist(): Promise<void> { await platform.writeSave(serializeSave(G.save)); },

  update(next: SaveData): void { G.save = next; void G.persist(); },

  applySettings(): void {
    const s = G.save.settings;
    i18n.lang = s.lang;
    audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
  },

  async reset(): Promise<void> {
    const keepSettings = G.save.settings;
    G.save = { ...createDefaultSave(ctx), settings: keepSettings };
    await G.persist();
  },
};

/** Run configuration passed from the menu into a stage. */
export interface RunConfig { stageId: string }

export interface RunSummary {
  stageId: string;
  outcome: 'victory' | 'defeat' | 'quit';
  kills: number;
  level: number;
}
