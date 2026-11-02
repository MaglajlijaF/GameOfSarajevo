import { describe, expect, it } from 'vitest';
import { bossMusic, compose } from '../src/audio/compose';
import { data } from './helpers';

describe('music', () => {
  const songs = data.stageOrder.map((id) => compose(data.stages[id].music));

  it('composes a valid loop for every stage', () => {
    for (const s of songs) {
      expect(s.events.length).toBeGreaterThan(50);
      for (const e of s.events) {
        expect(e.s).toBeGreaterThanOrEqual(0);
        expect(e.s).toBeLessThan(s.steps);
        expect(e.l).toBeGreaterThan(0);
      }
      expect(s.events.some((e) => e.c === 0)).toBe(true);
      expect(s.events.some((e) => e.c === 1)).toBe(true);
      expect(s.events.some((e) => e.c === 3)).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(compose(data.stages.bistrik.music)).toEqual(compose(data.stages.bistrik.music));
  });

  it('every stage has a different melody', () => {
    const melodies = songs.map((s) => s.events.filter((e) => e.c === 0).map((e) => `${e.s}:${e.n}`).join(','));
    expect(new Set(melodies).size).toBe(songs.length);
  });

  it('boss music is a faster variant', () => {
    const m = data.stages.kovaci.music;
    expect(compose(bossMusic(m)).tempo).toBeGreaterThan(compose(m).tempo);
  });
});
