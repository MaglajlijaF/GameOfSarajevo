import type { Rng } from './rng';
import type { WeaponDef, WeaponKind } from './types';

/**
 * The player holds exactly one composite weapon. It is a list of parts; the
 * first part is the base. Merging a new weapon appends its behavior; merging a
 * weapon that is already a part raises that part's tier instead.
 */
export interface WeaponPart { id: string; tier: number }
export interface CompositeWeapon { parts: WeaponPart[] }

export interface ResolvedBehavior {
  id: string;
  kind: WeaponKind;
  tier: number;
  cooldown: number;
  damage: number;
  color: string;
  params: Record<string, number>;
}

export interface HitModifiers {
  slow?: { factor: number; duration: number };
  burn?: { dps: number; duration: number };
  chain?: { jumps: number; range: number; damageFrac: number };
}

export const MOD_KINDS: readonly WeaponKind[] = ['mod_slow', 'mod_burn', 'mod_chain'];

export function createWeapon(baseId: string): CompositeWeapon {
  return { parts: [{ id: baseId, tier: 1 }] };
}

export function canMerge(w: CompositeWeapon, id: string, defs: Record<string, WeaponDef>): boolean {
  const def = defs[id];
  if (!def) return false;
  const part = w.parts.find((p) => p.id === id);
  return !part || part.tier < def.maxTier;
}

export function mergeWeapon(w: CompositeWeapon, id: string, defs: Record<string, WeaponDef>): CompositeWeapon {
  if (!canMerge(w, id, defs)) return { parts: w.parts.map((p) => ({ ...p })) };
  const exists = w.parts.some((p) => p.id === id);
  const parts = exists
    ? w.parts.map((p) => (p.id === id ? { ...p, tier: p.tier + 1 } : { ...p }))
    : [...w.parts.map((p) => ({ ...p })), { id, tier: 1 }];
  return { parts };
}

/** Picks up to `count` distinct weapon ids that can still be merged. New behaviors are favoured. */
export function offerWeapons(w: CompositeWeapon, defs: Record<string, WeaponDef>, rng: Rng, count = 3): string[] {
  const owned = new Set(w.parts.map((p) => p.id));
  const fresh = Object.keys(defs).filter((id) => !owned.has(id));
  const upgrades = Object.keys(defs).filter((id) => owned.has(id) && canMerge(w, id, defs));
  rng.shuffle(fresh);
  rng.shuffle(upgrades);
  const out: string[] = [];
  // Mostly new behaviors, with one upgrade slot when available.
  const wantUpgrade = upgrades.length > 0 && (fresh.length < count || rng.chance(0.45));
  if (wantUpgrade) out.push(upgrades.shift()!);
  while (out.length < count && fresh.length) out.push(fresh.shift()!);
  while (out.length < count && upgrades.length) out.push(upgrades.shift()!);
  return out;
}

export function resolveBehaviors(w: CompositeWeapon, defs: Record<string, WeaponDef>): ResolvedBehavior[] {
  return w.parts.flatMap((p) => {
    const def = defs[p.id];
    if (!def) return [];
    const extra = p.tier - 1;
    const params: Record<string, number> = { ...def.params };
    for (const [k, v] of Object.entries(def.perTier)) {
      if (k === 'damage' || k === 'cooldownPct') continue;
      params[k] = (params[k] ?? 0) + v * extra;
    }
    const cdPct = def.perTier.cooldownPct ?? 0;
    return [{
      id: p.id,
      kind: def.kind,
      tier: p.tier,
      cooldown: Math.max(0.08, def.cooldown * (1 - cdPct * extra)),
      damage: def.damage + (def.perTier.damage ?? 0) * extra,
      color: def.color,
      params,
    }];
  });
}

/** Status modifiers apply to every hit dealt by every behavior of the weapon. */
export function hitModifiers(behaviors: ResolvedBehavior[]): HitModifiers {
  const m: HitModifiers = {};
  for (const b of behaviors) {
    if (b.kind === 'mod_slow') m.slow = { factor: b.params.factor, duration: b.params.duration };
    if (b.kind === 'mod_burn') m.burn = { dps: b.params.dps, duration: b.params.duration };
    if (b.kind === 'mod_chain') m.chain = { jumps: Math.round(b.params.jumps), range: b.params.range, damageFrac: b.params.damageFrac };
  }
  return m;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

/**
 * Generated name: up to two adjectives from the most recently merged parts,
 * then the base noun. Long builds get a roman numeral for their part count.
 * `t` resolves language keys; Bosnian adjectives agree with the base noun gender.
 */
export function weaponName(w: CompositeWeapon, defs: Record<string, WeaponDef>, t: (key: string) => string | undefined): string {
  const base = w.parts[0];
  const baseDef = defs[base.id];
  const noun = t(`weapon.${base.id}.noun`) ?? base.id;
  const gender = baseDef?.gender ?? 'm';
  const adjs = w.parts.slice(1).reverse().slice(0, 2).map((p) => t(`weapon.${p.id}.adj_${gender}`) ?? t(`weapon.${p.id}.adj`) ?? p.id);
  let name = [...adjs, noun].join(' ');
  if (w.parts.length > 3) name += ` ${ROMAN[Math.min(w.parts.length, ROMAN.length - 1)]}`;
  const bonus = w.parts.reduce((s, p) => s + p.tier - 1, 0);
  if (bonus > 0) name += ` +${bonus}`;
  return name;
}

/** Everything a renderer needs to draw the composite weapon. */
export interface WeaponLook {
  base: string;
  attachments: { id: string; tier: number }[];
  colors: string[];
  glow: string;
  /** Changes whenever the weapon changes; use it as a texture cache key. */
  signature: string;
}

export function weaponLook(w: CompositeWeapon, defs: Record<string, WeaponDef>): WeaponLook {
  const colors = w.parts.map((p) => defs[p.id]?.color ?? '#ffffff');
  return {
    base: w.parts[0].id,
    attachments: w.parts.slice(1).map((p) => ({ id: p.id, tier: p.tier })),
    colors,
    glow: colors[colors.length - 1],
    signature: w.parts.map((p) => `${p.id}${p.tier}`).join('_'),
  };
}
