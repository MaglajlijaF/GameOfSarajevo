import { describe, expect, it } from 'vitest';
import { createDefaultSave, parseSave, serializeSave, validateSave, applyStageResult } from '../src/core/save';
import { DEFAULT_KEYBINDS, rebind } from '../src/core/input';
import { ctx } from './helpers';

describe('save data', () => {
  it('round-trips through JSON', () => {
    let s = applyStageResult(createDefaultSave(ctx), ctx, 'kovaci', 'victory').save;
    s = { ...s, upgrades: { ...s.upgrades, damage: 3 }, settings: { ...s.settings, lang: 'en', fullscreen: true } };
    expect(parseSave(serializeSave(s), ctx)).toEqual(s);
  });

  it('falls back to a fresh save on corrupt or missing data', () => {
    const fresh = createDefaultSave(ctx);
    expect(parseSave('{not json', ctx)).toEqual(fresh);
    expect(parseSave(null, ctx)).toEqual(fresh);
    expect(validateSave(42, ctx)).toEqual(fresh);
  });

  it('recomputes unlocks instead of trusting the file', () => {
    const tampered = { ...createDefaultSave(ctx), unlocked: ['kovaci', 'bistrik', 'dobrinja'], cleared: [] };
    const s = validateSave(tampered, ctx);
    expect(s.unlocked).toEqual(['kovaci']);
  });

  it('drops clears that skip the chain', () => {
    const s = validateSave({ cleared: ['kovaci', 'skenderija', 'nope'] }, ctx);
    expect(s.cleared).toEqual(['kovaci']);
    expect(s.unlocked).toEqual(['kovaci', 'bistrik']);
  });

  it('clamps money, upgrade levels and volumes', () => {
    const s = validateSave({ km: -50, upgrades: { health: 999, damage: -3, bogus: 4 }, settings: { masterVolume: 7, sfxVolume: 'x' } }, ctx);
    expect(s.km).toBe(0);
    expect(s.upgrades.health).toBe(10);
    expect(s.upgrades.damage).toBe(0);
    expect('bogus' in s.upgrades).toBe(false);
    expect(s.settings.masterVolume).toBe(1);
    expect(s.settings.sfxVolume).toBe(0.8);
  });

  it('rejects unknown starter weapons and characters', () => {
    const s = validateSave({ ownedStarters: ['golub', 'cevapi'], selectedStarter: 'golub', selectedCharacter: 'nobody' }, ctx);
    expect(s.ownedStarters).toEqual(['rucka', 'cevapi']);
    expect(s.selectedStarter).toBe('rucka');
    expect(s.selectedCharacter).toBe(ctx.characters[0]);
  });

  it('repairs duplicate or invalid keybinds', () => {
    const s = validateSave({ settings: { keybinds: { left: 'D', right: 'D', jump: 'not a key!' } } }, ctx);
    const keys = Object.values(s.settings.keybinds);
    expect(new Set(keys).size).toBe(keys.length);
    expect(s.settings.keybinds.jump).toBe('SPACE');
  });

  it('rebinding swaps on conflict', () => {
    const b = rebind(DEFAULT_KEYBINDS, 'jump', 'W');
    expect(b.jump).toBe('W');
    expect(b.up).toBe('SPACE');
  });
});
