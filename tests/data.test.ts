import { describe, expect, it } from 'vitest';
import { validateGameData } from '../src/core/data';
import { WaveDirector } from '../src/core/waves';
import { data } from './helpers';

describe('game data', () => {
  it('passes cross-reference validation', () => {
    expect(validateGameData(data)).toEqual([]);
  });

  it('kovači has 5 waves of increasing size and at least 3 enemy types incl. ranged', () => {
    const st = data.stages.kovaci;
    const sizes = st.waves.map((w) => w.spawns.reduce((s, x) => s + x.count, 0));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    expect(st.enemies.length).toBeGreaterThanOrEqual(3);
    const behaviors = st.enemies.map((e) => data.enemies[e].behavior);
    expect(behaviors).toContain('thrower');
    expect(behaviors).toContain('walker');
  });
});

describe('wave director', () => {
  it('spawns everything respecting maxAlive and reports clear', () => {
    const def = { layout: 'x', spawns: [{ enemy: 'a', count: 5 }, { enemy: 'b', count: 3 }], maxAlive: 3, interval: 0.5 };
    const wd = new WaveDirector(def, 1);
    let alive = 0;
    let total = 0;
    for (let i = 0; i < 400; i++) {
      const sp = wd.update(0.1, alive);
      alive += sp.length;
      total += sp.length;
      expect(alive).toBeLessThanOrEqual(3);
      if (i % 7 === 0 && alive > 0) alive--; // something dies
    }
    while (alive > 0) alive--;
    expect(total).toBe(8);
    expect(wd.isCleared(alive)).toBe(true);
  });
});
