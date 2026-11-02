/** Master palette. Sprite data refers to these names / single-char codes. */
export const PAL: Record<string, string> = {
  outline: '#1a1420', white: '#f4f4f4', black: '#101018',
  skin1: '#f6d2b0', skin2: '#e8b48a', skin3: '#c48a5e', skin4: '#9a6440',
  hairBlack: '#231c22', hairBrown: '#6a3e22', hairBlond: '#e0b45a', hairRed: '#b8502a', hairGrey: '#a8a8b0', hairAuburn: '#8a3a2a',
  blue: '#3a6ad8', blueDark: '#26448a', red: '#d83a3a', redDark: '#8a2028', green: '#4aa04a', greenDark: '#2a6a2e',
  yellow: '#f2d64b', orange: '#e0802a', purple: '#8a4ab8', purpleDark: '#5a2a7a', teal: '#2aa8a0', tealDark: '#1a6a66',
  pink: '#f08ab8', brown: '#8a5a2e', brownDark: '#5a3418', tan: '#d8b888', cream: '#f0e2c4', grey: '#8a8f9c', greyDark: '#4a4e5a',
  denim: '#3a4e7a', khaki: '#9a8a5a', copper: '#c87a3a', copperDark: '#8a4a1e', navy: '#1e2a4a', olive: '#6a7a3a',
};

/** Single-character codes used in string sprite data. '.' is transparent. */
export const CODE: Record<string, string> = {
  k: '#1a1420', w: '#f4f4f4', g: '#c0c4cc', G: '#7a7f8c', b: '#8a5a2e', B: '#5a3418', o: '#e0802a', y: '#f2d64b',
  r: '#d83a3a', R: '#8a2028', p: '#f59ac8', P: '#c0507a', u: '#4aa3df', U: '#2a5a9a', c: '#c87a3a', C: '#8a4a1e',
  e: '#5ad05a', E: '#2a7a2e', s: '#f0c098', m: '#9a4a2a', M: '#6a2a1a', f: '#ff7a2a', l: '#fff0a0', n: '#1e2a4a',
  t: '#e8c27a', T: '#b08a4a', v: '#b48ae0', h: '#3a2418',
};

export function color(nameOrHex: string | undefined, fallback = '#ff00ff'): string {
  if (!nameOrHex) return fallback;
  if (nameOrHex.startsWith('#')) return nameOrHex;
  return PAL[nameOrHex] ?? fallback;
}

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1);
}

/** amt > 0 lightens, amt < 0 darkens (-1..1). */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function hexToInt(hex: string): number { return parseInt(hex.slice(1), 16); }
