import { describe, expect, it } from 'vitest';
import { CUSTOM_OPTIONS, NAME_MAX, customRecipe, cycleCustom, defaultCustom, sanitizeCustom, sanitizeName } from '../src/core/custom';
import { SUPER_CHARGE, addCharge, canUseSuper, offerSupers, superDue } from '../src/core/supers';
import { ACTIONS, DEFAULT_KEYBINDS, bindsForAimMode, sanitizeKeybinds } from '../src/core/input';
import { createDefaultSave, parseSave, serializeSave, validateSave, applyStageResult } from '../src/core/save';
import { TUTORIAL_GATES, TUTORIAL_PASS, TUTORIAL_STEPS, tutorialPlan } from '../src/core/tutorial';
import { CELL } from '../src/core/level';
import { Rng } from '../src/core/rng';
import { ctx, data } from './helpers';
import bs from '../src/data/lang/bs.json';
import en from '../src/data/lang/en.json';

describe('character creator', () => {
  it('cleans names to the letters the pixel font has', () => {
    expect(sanitizeName('faris')).toBe('FARIS');
    expect(sanitizeName('  Đulić 99!')).toBe('ĐULIĆ 99');
    expect(sanitizeName('a'.repeat(30))).toHaveLength(NAME_MAX);
    expect(sanitizeName(42)).toBe('');
  });

  it('only accepts listed options from a save file', () => {
    const c = sanitizeCustom({ name: 'Lejla', hair: 'neon-green', shirt: 'teal', pants: 123, hairStyle: 'bun' });
    expect(c).toEqual({ ...defaultCustom(), name: 'LEJLA', shirt: 'teal', hairStyle: 'bun' });
  });

  it('cycles every field through all options and back', () => {
    for (const f of Object.keys(CUSTOM_OPTIONS) as (keyof typeof CUSTOM_OPTIONS)[]) {
      let c = defaultCustom();
      const seen = new Set<string>();
      for (let i = 0; i < CUSTOM_OPTIONS[f].length; i++) { seen.add(c[f]); c = cycleCustom(c, f, 1); }
      expect(seen.size).toBe(CUSTOM_OPTIONS[f].length);
      expect(c[f]).toBe(defaultCustom()[f]);
      expect(cycleCustom(cycleCustom(c, f, 1), f, -1)[f]).toBe(c[f]);
    }
  });

  it('builds a recipe with the chosen colours', () => {
    const r = customRecipe({ ...defaultCustom(), shirt: 'green', pants: 'olive', hair: 'hairRed', hairStyle: 'long' });
    expect(r).toMatchObject({ shirt: 'green', pants: 'olive', hair: 'hairRed', hairStyle: 'long' });
  });

  it('every option has a label in both languages', () => {
    for (const [f, opts] of Object.entries(CUSTOM_OPTIONS)) for (const o of opts) {
      expect((bs as Record<string, string>)[`creator.${f}.${o}`], `bs creator.${f}.${o}`).toBeTruthy();
      expect((en as Record<string, string>)[`creator.${f}.${o}`], `en creator.${f}.${o}`).toBeTruthy();
    }
  });
});

describe('super abilities', () => {
  it('offers three different weapons', () => {
    const ids = Object.keys(data.weapons);
    for (let seed = 1; seed < 30; seed++) {
      const o = offerSupers(ids, new Rng(seed));
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
      o.forEach((id) => expect(ids).toContain(id));
    }
  });

  it('is offered once per stage, from level 3', () => {
    expect(superDue(2, null)).toBe(false);
    expect(superDue(3, null)).toBe(true);
    expect(superDue(5, null)).toBe(true);
    expect(superDue(4, 'golub')).toBe(false);
  });

  it('charge is capped and must be full to use', () => {
    let m = { charge: 0 };
    for (let i = 0; i < SUPER_CHARGE - 1; i++) m = addCharge(m, 1);
    expect(canUseSuper(m)).toBe(false);
    m = addCharge(m, 50);
    expect(m.charge).toBe(SUPER_CHARGE);
    expect(canUseSuper(m)).toBe(true);
  });

  it('every weapon has a super name and description in both languages', () => {
    for (const id of Object.keys(data.weapons)) for (const k of [`super.${id}`, `super.${id}.desc`]) {
      expect((bs as Record<string, string>)[k], k).toBeTruthy();
      expect((en as Record<string, string>)[k], k).toBeTruthy();
    }
  });
});

describe('controls: super key and keyboard-only mode', () => {
  it('adds a super action without wiping an old custom layout', () => {
    const old = { left: 'J', right: 'L', up: 'I', down: 'K', jump: 'Q', dash: 'SHIFT', attack: 'MOUSE_LEFT', pause: 'ESC' };
    const b = sanitizeKeybinds(old);
    expect(b.left).toBe('J');
    expect(b.jump).toBe('Q');
    expect(b.super).not.toBe('Q');
    expect(new Set(ACTIONS.map((a) => b[a])).size).toBe(ACTIONS.length);
  });

  it('keyboard mode moves attack and super off the mouse', () => {
    const k = bindsForAimMode({ ...DEFAULT_KEYBINDS, super: 'MOUSE_RIGHT' }, 'keyboard');
    expect(ACTIONS.some((a) => k[a].startsWith('MOUSE_'))).toBe(false);
    expect(k.attack).toBe('J');
    expect(new Set(ACTIONS.map((a) => k[a])).size).toBe(ACTIONS.length);
    const m = bindsForAimMode(k, 'mouse');
    expect(m.attack).toBe('MOUSE_LEFT');
  });
});

describe('save: new fields', () => {
  it('round-trips aim mode, custom character and story flags', () => {
    let s = createDefaultSave(ctx);
    s = { ...s, selectedCharacter: 'custom', custom: { ...s.custom, name: 'FARIS', shirt: 'navy' }, seenIntro: true, tutorialDone: true, settings: { ...s.settings, aimMode: 'keyboard' } };
    expect(parseSave(serializeSave(s), ctx)).toEqual(s);
  });

  it('old saves get safe defaults', () => {
    const s = validateSave({ km: 10, cleared: ['kovaci'] }, ctx);
    expect(s.settings.aimMode).toBe('mouse');
    expect(s.seenIntro).toBe(false);
    expect(s.custom).toEqual(defaultCustom());
  });

  it('the ending can only be marked seen after the whole campaign', () => {
    expect(validateSave({ seenEnding: true, cleared: ['kovaci'] }, ctx).seenEnding).toBe(false);
    let s = createDefaultSave(ctx);
    for (const id of ctx.stageOrder) s = applyStageResult(s, ctx, id, 'victory').save;
    expect(validateSave({ ...s, seenEnding: true }, ctx).seenEnding).toBe(true);
  });
});

describe('tutorial course', () => {
  const plan = tutorialPlan();
  it('has every step and a closed course', () => {
    expect(TUTORIAL_STEPS).toEqual(['move', 'jump', 'double', 'dash', 'ladder', 'drop', 'attack', 'steam', 'info']);
    for (let y = 0; y < plan.height; y++) { expect(plan.cells[y][0]).toBe(CELL.SOLID); expect(plan.cells[y][plan.width - 1]).toBe(CELL.SOLID); }
  });

  it('places gates and checkpoints in order along the course', () => {
    const xs = TUTORIAL_STEPS.map((s) => TUTORIAL_GATES[s] ?? TUTORIAL_PASS[s]).filter((x): x is number => x !== undefined);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(Math.max(...xs)).toBeLessThan(plan.width - 1);
  });

  it('has a ladder, a wooden platform and sewer grates', () => {
    const flat = plan.cells.flat();
    expect(flat).toContain(CELL.LADDER);
    expect(flat).toContain(CELL.ONEWAY);
    expect(flat.filter((c) => c === CELL.HAZARD).length).toBe(6);
  });

  it('every tutorial and story text exists in both languages', () => {
    const keys = Object.keys(bs).filter((k) => k.startsWith('tutorial.') || k.startsWith('story.'));
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect((en as Record<string, string>)[k], k).toBeTruthy();
  });
});
