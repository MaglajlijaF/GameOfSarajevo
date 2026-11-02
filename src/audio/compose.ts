import { Rng } from '../core/rng';
import type { MusicDef } from '../core/types';

/**
 * Pure, deterministic chiptune composer. Produces a looping Song made of note
 * events on 4 channels (lead, bass, harmony, drums). The same event format is
 * produced by scripts/import-midi.mjs, so imported songs play through the same
 * engine and sound "pixelated" the same way.
 */
export interface NoteEvent {
  /** start, in 16th-note steps */ s: number;
  /** length, in steps */ l: number;
  /** MIDI note (drums: 0 kick, 1 snare, 2 hat) */ n: number;
  /** channel: 0 lead, 1 bass, 2 harmony, 3 drums */ c: number;
}

export interface Song { tempo: number; steps: number; events: NoteEvent[]; lead?: string }

export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  // Phrygian dominant: the scale heard in a lot of Balkan / sevdah melodies.
  hijaz: [0, 1, 4, 5, 7, 8, 10],
};

const PROGRESSIONS: Record<string, number[]> = {
  sevdah: [0, 3, 4, 0, 0, 5, 4, 0],
  waltz: [0, 3, 4, 0, 5, 3, 4, 0],
  arcade: [0, 5, 3, 4, 0, 5, 3, 4],
  funk: [0, 0, 3, 3, 0, 0, 4, 3],
  anthem: [0, 4, 5, 3, 0, 4, 3, 4],
  drive: [0, 5, 6, 4, 0, 5, 6, 4],
  polka: [0, 4, 4, 0, 0, 4, 4, 0],
  hiphop: [0, 0, 5, 5, 3, 3, 4, 4],
};

/** Melody rhythm cells per style: 1 = note start, 0 = hold/rest. */
const RHYTHMS: Record<string, string[]> = {
  sevdah: ['1000101010001000', '1010100010101000', '1000100110001000'],
  waltz: ['100010001000', '100000101000', '101010001000'],
  arcade: ['1010101010101010', '1000101010001010', '1011101010111010'],
  funk: ['1001001010010010', '1000100101001000', '0010100100101001'],
  anthem: ['1000100010001000', '1000101010001000', '1010100010001010'],
  drive: ['1010101010101010', '1011101010111010', '1000101010101010'],
  polka: ['1010101010101010', '1000101010001010', '1010100010101000'],
  hiphop: ['1000001010000010', '1000100000101000', '0010001010000010'],
};

const DRUMS: Record<string, { k: string; s: string; h: string }> = {
  march: { k: '1000100010001000', s: '0000100000001000', h: '1010101010101010' },
  dance: { k: '1000100010001000', s: '0000100000001000', h: '0010001000100010' },
  shuffle: { k: '1000000010000000', s: '0000100000001000', h: '1001001010010010' },
  halftime: { k: '1000000000100000', s: '0000000010000000', h: '1010101010101010' },
  gallop: { k: '1011101110111011', s: '0000100000001000', h: '1111111111111111' },
  breakbeat: { k: '1000001000100000', s: '0000100000001001', h: '1010101010101010' },
  waltz: { k: '100000000000', s: '000010001000', h: '101010101010' },
};

const BASS: Record<string, (bar: number) => [number, number, number][]> = {
  // [step, length, scale-degree offset from chord root (7 = octave)]
  march: () => [[0, 3, 0], [4, 3, 4], [8, 3, 0], [12, 3, 4]],
  waltz: () => [[0, 3, 0], [4, 2, 4], [8, 2, 4]],
  dance: () => [[0, 2, 0], [2, 2, 7], [4, 2, 0], [6, 2, 7], [8, 2, 0], [10, 2, 7], [12, 2, 0], [14, 2, 7]],
  funk: (b) => [[0, 2, 0], [3, 1, 0], [6, 2, 7], [10, 1, 0], [11, 2, b % 2 ? 4 : 5], [14, 2, 0]],
  gallop: () => [[0, 1, 0], [1, 1, 0], [2, 2, 0], [4, 1, 0], [5, 1, 0], [6, 2, 0], [8, 1, 0], [9, 1, 0], [10, 2, 0], [12, 1, 4], [13, 1, 4], [14, 2, 4]],
  hiphop: () => [[0, 4, 0], [6, 2, 0], [10, 4, 4]],
  polka: () => [[0, 2, 0], [4, 2, 4], [8, 2, 0], [12, 2, 4]],
};

const STYLE_BASS: Record<string, string> = { sevdah: 'march', waltz: 'waltz', arcade: 'dance', funk: 'funk', anthem: 'march', drive: 'gallop', polka: 'polka', hiphop: 'hiphop' };

export function compose(def: MusicDef): Song {
  const rng = new Rng(def.seed);
  const style = def.style && PROGRESSIONS[def.style] ? def.style : 'arcade';
  const scale = SCALES[def.scale] ?? SCALES.minor;
  const barLen = style === 'waltz' || def.drums === 'waltz' ? 12 : 16;
  const bars = 8;
  const steps = bars * barLen;
  const prog = PROGRESSIONS[style];
  const deg = (d: number) => { const o = Math.floor(d / scale.length); return scale[((d % scale.length) + scale.length) % scale.length] + 12 * o; };
  const rhythms = RHYTHMS[style].map((r) => r.slice(0, barLen).padEnd(barLen, '0'));
  const events: NoteEvent[] = [];

  // Melody: phrase A (2 bars), A' (varied ending), B (new rhythm, higher), A''.
  const motif: number[] = [];
  let cur = 4;
  for (let i = 0; i < 8; i++) { cur = Math.max(0, Math.min(9, cur + rng.pick([-2, -1, -1, 1, 1, 2, 0]))); motif.push(cur); }
  const phrase = (bar: number, rhythm: string, shift: number, vary: boolean) => {
    const chord = prog[bar % prog.length];
    const starts = [...rhythm].map((c, i) => (c === '1' ? i : -1)).filter((i) => i >= 0);
    starts.forEach((st, k) => {
      const next = starts[k + 1] ?? barLen;
      let d = motif[(k + bar * 3) % motif.length] + shift;
      // strong beats snap to chord tones so melody and harmony agree
      if (st % 4 === 0) { const tones = [chord, chord + 2, chord + 4, chord + 7]; d = tones.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a)); }
      if (vary && k === starts.length - 1) d = chord + 7;
      events.push({ s: bar * barLen + st, l: Math.max(1, next - st - (rng.chance(0.25) ? 1 : 0)), n: def.root + 12 + deg(d), c: 0 });
    });
  };
  for (let bar = 0; bar < bars; bar++) {
    const section = Math.floor(bar / 2);
    const r = section === 2 ? rhythms[2] : section === 3 && bar % 2 ? rhythms[1] : rhythms[bar % 2];
    phrase(bar, r, section === 2 ? 2 : 0, bar % 2 === 1);
  }

  // Bass
  const bassFn = BASS[STYLE_BASS[style]] ?? BASS.march;
  for (let bar = 0; bar < bars; bar++) {
    const chord = prog[bar % prog.length];
    for (const [st, l, off] of bassFn(bar)) if (st < barLen) events.push({ s: bar * barLen + st, l, n: def.root - 12 + deg(chord) + (off === 7 ? 12 : deg(off) - deg(0)), c: 1 });
  }

  // Harmony: short chord stabs on off-beats (third + fifth of the chord)
  for (let bar = 0; bar < bars; bar++) {
    const chord = prog[bar % prog.length];
    for (let st = 2; st < barLen; st += style === 'waltz' ? 4 : 4) {
      events.push({ s: bar * barLen + st, l: 1, n: def.root + deg(chord + 2), c: 2 });
      if (style !== 'hiphop') events.push({ s: bar * barLen + st, l: 1, n: def.root + deg(chord + 4), c: 2 });
    }
  }

  // Drums
  const dp = DRUMS[def.drums ?? 'march'] ?? DRUMS.march;
  for (let bar = 0; bar < bars; bar++) {
    for (let st = 0; st < barLen; st++) {
      const at = bar * barLen + st;
      if (dp.k[st % dp.k.length] === '1') events.push({ s: at, l: 1, n: 0, c: 3 });
      if (dp.s[st % dp.s.length] === '1') events.push({ s: at, l: 1, n: 1, c: 3 });
      if (dp.h[st % dp.h.length] === '1') events.push({ s: at, l: 1, n: 2, c: 3 });
    }
    if (bar === bars - 1) for (let st = barLen - 4; st < barLen; st++) events.push({ s: bar * barLen + st, l: 1, n: 1, c: 3 }); // fill
  }
  return { tempo: def.tempo, steps, events, lead: def.lead };
}

/** Boss variant: same stage DNA, faster and shifted. */
export function bossMusic(def: MusicDef): MusicDef {
  return { ...def, seed: def.seed + 1, tempo: Math.round(def.tempo * 1.18), drums: def.drums === 'waltz' ? 'gallop' : def.drums, style: def.style === 'waltz' ? 'drive' : def.style };
}
