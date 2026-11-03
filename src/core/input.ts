/** Keyboard action model. Keys are Phaser key-code names (e.g. 'A', 'SPACE', 'SHIFT'). */
export const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'dash', 'attack', 'super', 'pause'] as const;
export type Action = (typeof ACTIONS)[number];
export type Keybinds = Record<Action, string>;

/** 'MOUSE_LEFT' is a pseudo key for the left mouse button. */
export const DEFAULT_KEYBINDS: Keybinds = {
  left: 'A',
  right: 'D',
  up: 'W',
  down: 'S',
  jump: 'SPACE',
  dash: 'SHIFT',
  attack: 'MOUSE_LEFT',
  super: 'Q',
  pause: 'ESC',
};

/** Keyboard-only layout: attack and super move from the mouse to J / K. */
export const KEYBOARD_ATTACK = 'J';
export const KEYBOARD_SUPER = 'K';
const SPARE_KEYS = ['Q', 'E', 'R', 'F', 'J', 'K', 'L', 'I', 'O', 'P', 'Z', 'X', 'C', 'V'];

const VALID_KEY = /^(MOUSE_LEFT|MOUSE_RIGHT|[A-Z0-9_]{1,16})$/;

export function isValidKey(key: unknown): key is string {
  return typeof key === 'string' && VALID_KEY.test(key);
}

/**
 * Binds `key` to `action`. If another action already uses that key, the two
 * actions swap keys so no binding is ever lost or duplicated.
 */
export function rebind(binds: Keybinds, action: Action, key: string): Keybinds {
  if (!isValidKey(key)) return { ...binds };
  const next = { ...binds };
  const clash = ACTIONS.find((a) => a !== action && next[a] === key);
  if (clash) next[clash] = binds[action];
  next[action] = key;
  return next;
}

export function sanitizeKeybinds(raw: unknown): Keybinds {
  const out: Keybinds = { ...DEFAULT_KEYBINDS };
  if (raw && typeof raw === 'object') {
    for (const a of ACTIONS) {
      const v = (raw as Record<string, unknown>)[a];
      if (isValidKey(v)) out[a] = v;
    }
  }
  // Resolve duplicates: fall back to the default key, or the first free spare key
  // (so adding a new action never wipes a player's custom layout).
  const seen = new Set<string>();
  for (const a of ACTIONS) {
    if (seen.has(out[a])) out[a] = DEFAULT_KEYBINDS[a];
    if (seen.has(out[a])) out[a] = SPARE_KEYS.find((k) => !seen.has(k) && !ACTIONS.some((b) => out[b] === k)) ?? out[a];
    seen.add(out[a]);
  }
  const unique = new Set(ACTIONS.map((a) => out[a]));
  return unique.size === ACTIONS.length ? out : { ...DEFAULT_KEYBINDS };
}

/** Switches attack/super between mouse buttons and keyboard keys for the chosen aim mode. */
export function bindsForAimMode(binds: Keybinds, mode: 'mouse' | 'keyboard'): Keybinds {
  let b = { ...binds };
  const isMouse = (k: string) => k.startsWith('MOUSE_');
  if (mode === 'keyboard') {
    if (isMouse(b.attack)) b = rebind(b, 'attack', KEYBOARD_ATTACK);
    if (isMouse(b.super)) b = rebind(b, 'super', KEYBOARD_SUPER);
    for (const a of ACTIONS) if (isMouse(b[a])) b = rebind(b, a, SPARE_KEYS.find((k) => !ACTIONS.some((x) => b[x] === k))!);
  } else if (!isMouse(b.attack)) b = rebind(b, 'attack', 'MOUSE_LEFT');
  return b;
}
