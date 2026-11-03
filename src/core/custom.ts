import type { CharacterRecipe } from './types';

/**
 * Player-made character. Every field is picked from a fixed option list, so a
 * hand-edited save can never produce an invalid recipe.
 */
export interface CustomCharacter {
  name: string;
  skin: string;
  hairStyle: string;
  hair: string;
  shirt: string;
  pants: string;
}

export const CUSTOM_ID = 'custom';
export const CUSTOM_SPRITE = 'player_custom';
export const NAME_MAX = 12;

export const CUSTOM_OPTIONS = {
  skin: ['skin1', 'skin2', 'skin3', 'skin4'],
  hairStyle: ['short', 'curly', 'long', 'bob', 'ponytail', 'bun', 'cap', 'beanie', 'bald'],
  hair: ['hairBlack', 'hairBrown', 'hairBlond', 'hairRed', 'hairAuburn', 'hairGrey', 'pink', 'blue'],
  shirt: ['red', 'blue', 'green', 'yellow', 'purple', 'teal', 'orange', 'pink', 'white', 'black', 'grey', 'navy'],
  pants: ['denim', 'black', 'khaki', 'navy', 'grey', 'brown', 'olive', 'red', 'white'],
} as const;

export type CustomField = keyof typeof CUSTOM_OPTIONS;
export const CUSTOM_FIELDS = Object.keys(CUSTOM_OPTIONS) as CustomField[];

/** Letters the pixel font can draw (Bosnian alphabet plus digits, space and '-'). */
const NAME_CHARS = /[A-Z0-9ČĆŠĐŽ \-]/;

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return [...raw.toUpperCase()].filter((c) => NAME_CHARS.test(c)).join('').replace(/\s+/g, ' ').trimStart().slice(0, NAME_MAX);
}

export function defaultCustom(): CustomCharacter {
  return { name: '', skin: 'skin2', hairStyle: 'short', hair: 'hairBrown', shirt: 'red', pants: 'denim' };
}

export function sanitizeCustom(raw: unknown): CustomCharacter {
  const d = defaultCustom();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const out = { ...d, name: sanitizeName(r.name).trim() };
  for (const f of CUSTOM_FIELDS) {
    const v = r[f];
    if (typeof v === 'string' && (CUSTOM_OPTIONS[f] as readonly string[]).includes(v)) out[f] = v;
  }
  return out;
}

/** Cycles one field to the next (or previous) option. */
export function cycleCustom(c: CustomCharacter, field: CustomField, step: 1 | -1): CustomCharacter {
  const opts = CUSTOM_OPTIONS[field] as readonly string[];
  const i = opts.indexOf(c[field]);
  return { ...c, [field]: opts[(i + step + opts.length) % opts.length] };
}

const DARKER: Record<string, string> = {
  red: 'redDark', blue: 'blueDark', green: 'greenDark', purple: 'purpleDark', teal: 'tealDark', yellow: 'orange',
};

export function customRecipe(c: CustomCharacter): CharacterRecipe {
  const capColor = c.hairStyle === 'cap' || c.hairStyle === 'beanie' ? c.shirt : undefined;
  return {
    skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, shirt: c.shirt, shirt2: DARKER[c.shirt] ?? c.shirt,
    pants: c.pants, shoes: c.pants === 'white' ? 'black' : 'white', accessoryColor: capColor,
  };
}
