import { describe, expect, it } from 'vitest';
import { addXp, consumeLevelUp, createXpState, xpProgress, xpToNext } from '../src/core/xp';

describe('xp', () => {
  it('xp requirement grows with level', () => {
    for (let l = 1; l < 30; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('levels up when the threshold is reached and keeps the remainder', () => {
    const need = xpToNext(1);
    const r = addXp(createXpState(), need + 2);
    expect(r.gained).toBe(1);
    expect(r.state.level).toBe(2);
    expect(r.state.xp).toBe(2);
    expect(r.state.pendingLevelUps).toBe(1);
  });

  it('can gain several levels at once', () => {
    const big = xpToNext(1) + xpToNext(2) + xpToNext(3);
    const r = addXp(createXpState(), big);
    expect(r.gained).toBe(3);
    expect(r.state.level).toBe(4);
    expect(r.state.pendingLevelUps).toBe(3);
  });

  it('applies the xp multiplier', () => {
    const r = addXp(createXpState(), xpToNext(1) / 2, 2);
    expect(r.state.level).toBe(2);
  });

  it('rejects non-positive and NaN amounts', () => {
    expect(addXp(createXpState(), -5).gained).toBe(0);
    expect(addXp(createXpState(), NaN).state.xp).toBe(0);
  });

  it('consumes pending level-ups without going negative', () => {
    let s = addXp(createXpState(), xpToNext(1)).state;
    s = consumeLevelUp(s);
    expect(s.pendingLevelUps).toBe(0);
    expect(consumeLevelUp(s).pendingLevelUps).toBe(0);
  });

  it('progress is a 0..1 fraction', () => {
    const s = addXp(createXpState(), xpToNext(1) / 2).state;
    expect(xpProgress(s)).toBeCloseTo(0.5);
  });
});
