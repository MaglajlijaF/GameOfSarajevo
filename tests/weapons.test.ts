import { describe, expect, it } from 'vitest';
import { canMerge, createWeapon, hitModifiers, mergeWeapon, offerWeapons, resolveBehaviors, weaponLook, weaponName } from '../src/core/weapons';
import { Rng } from '../src/core/rng';
import { I18n } from '../src/core/i18n';
import bs from '../src/data/lang/bs.json';
import en from '../src/data/lang/en.json';
import { data } from './helpers';

const defs = data.weapons;
const i18n = new I18n({ bs, en }, 'bs');
const t = (k: string) => i18n.maybe(k);

describe('weapon merging', () => {
  it('has at least 10 mergeable weapons with names in both languages', () => {
    const ids = Object.keys(defs);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      expect(bs[`weapon.${id}.noun` as keyof typeof bs]).toBeTruthy();
      expect(en[`weapon.${id}.noun` as keyof typeof en]).toBeTruthy();
    }
  });

  it('merging adds a new attack behavior instead of only stats', () => {
    const w = mergeWeapon(createWeapon('rucka'), 'cevapi', defs);
    const kinds = resolveBehaviors(w, defs).map((b) => b.kind);
    expect(kinds).toEqual(['swing', 'projectile']);
  });

  it('merging an owned weapon raises its tier and scales its params', () => {
    let w = mergeWeapon(createWeapon('rucka'), 'cevapi', defs);
    const before = resolveBehaviors(w, defs)[1];
    w = mergeWeapon(w, 'cevapi', defs);
    const after = resolveBehaviors(w, defs)[1];
    expect(w.parts).toHaveLength(2);
    expect(after.tier).toBe(2);
    expect(after.damage).toBeGreaterThan(before.damage);
    expect(after.params.count).toBeGreaterThan(before.params.count);
  });

  it('cannot exceed max tier', () => {
    let w = createWeapon('rucka');
    for (let i = 0; i < 10; i++) w = mergeWeapon(w, 'rucka', defs);
    expect(w.parts[0].tier).toBe(defs.rucka.maxTier);
    expect(canMerge(w, 'rucka', defs)).toBe(false);
  });

  it('does not mutate the input weapon', () => {
    const w = createWeapon('rucka');
    mergeWeapon(w, 'dzezva', defs);
    expect(w.parts).toHaveLength(1);
  });

  it('modifiers apply to every hit', () => {
    let w = createWeapon('rucka');
    w = mergeWeapon(w, 'lokum', defs);
    w = mergeWeapon(w, 'fenjer', defs);
    const m = hitModifiers(resolveBehaviors(w, defs));
    expect(m.slow).toBeDefined();
    expect(m.burn).toBeDefined();
    expect(m.chain).toBeUndefined();
  });

  it('generated name and look change after each merge', () => {
    let w = createWeapon('rucka');
    const names = [weaponName(w, defs, t)];
    const sigs = [weaponLook(w, defs).signature];
    for (const id of ['cevapi', 'dzezva', 'golub', 'cevapi']) {
      w = mergeWeapon(w, id, defs);
      names.push(weaponName(w, defs, t));
      sigs.push(weaponLook(w, defs).signature);
    }
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(sigs).size).toBe(sigs.length);
    expect(names[0]).toBe('Tramvajska ručka');
    expect(names[1]).toBe('Ćevapska Tramvajska ručka');
  });

  it('Bosnian adjectives agree with the base noun gender', () => {
    const w = mergeWeapon(createWeapon('cevapi'), 'dzezva', defs); // ražanj is masculine
    expect(weaponName(w, defs, t)).toBe('Kafeni Ćevap-ražanj');
  });

  it('offers distinct, mergeable weapons', () => {
    const w = createWeapon('rucka');
    for (let seed = 1; seed < 50; seed++) {
      const offer = offerWeapons(w, defs, new Rng(seed));
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      offer.forEach((id) => expect(canMerge(w, id, defs)).toBe(true));
    }
  });

  it('offers nothing once everything is maxed', () => {
    let w = createWeapon('rucka');
    for (const id of Object.keys(defs)) for (let i = 0; i < 5; i++) w = mergeWeapon(w, id, defs);
    expect(offerWeapons(w, defs, new Rng(3))).toEqual([]);
  });
});
