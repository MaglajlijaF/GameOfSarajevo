import { describe, expect, it } from 'vitest';
import { buildLevel, checkLayoutReachability } from '../src/core/level';
import { stageScale } from '../src/core/difficulty';
import { data } from './helpers';

describe('arena layouts', () => {
  it.each(Object.keys(data.layouts))('%s: every platform and spawn is reachable', (id) => {
    expect(checkLayoutReachability(data.layouts[id])).toEqual([]);
  });

  it('detects an unreachable platform', () => {
    const rows = data.layouts.kovaci_1.map((r) => r);
    rows[2] = '..........====........................';
    for (let y = 3; y < 20; y++) rows[y] = '.'.repeat(40);
    expect(checkLayoutReachability(rows).length).toBeGreaterThan(0);
  });

  it.each(data.stageOrder)('%s builds a full level', (id) => {
    const plan = buildLevel(data.stages[id], data.layouts);
    expect(plan.sections).toHaveLength(6);
    expect(plan.sections[5].bossSpawn).toBeDefined();
  });
});

describe('campaign content', () => {
  it('every stage has its own theme, boss, music and at least 3 enemy types incl. ground and ranged', () => {
    const themes = new Set<string>(), bosses = new Set<string>(), seeds = new Set<number>();
    const ranged = ['thrower', 'shooter', 'bomber', 'sniper', 'roller', 'summoner'];
    const ground = ['walker', 'charger', 'jumper', 'dasher', 'shielder', 'spinner', 'dropper'];
    for (const id of data.stageOrder) {
      const st = data.stages[id];
      themes.add(st.theme); bosses.add(st.boss); seeds.add(st.music.seed);
      expect(new Set(st.enemies).size).toBeGreaterThanOrEqual(3);
      const kinds = st.enemies.map((e) => data.enemies[e].behavior);
      expect(kinds.some((k) => ranged.includes(k))).toBe(true);
      expect(kinds.some((k) => ground.includes(k))).toBe(true);
      expect(data.bosses[st.boss].phases.length).toBeGreaterThanOrEqual(2);
    }
    expect(themes.size).toBe(13);
    expect(bosses.size).toBe(13);
    expect(seeds.size).toBe(13);
  });

  it('no enemy type is reused between stages', () => {
    const all = data.stageOrder.flatMap((id) => data.stages[id].enemies);
    expect(new Set(all).size).toBe(all.length);
  });

  it('difficulty, enemy count, boss hp and reward rise stage by stage', () => {
    const o = data.stageOrder.map((id) => data.stages[id]);
    for (let i = 1; i < o.length; i++) {
      const a = o[i - 1], b = o[i];
      expect(b.difficulty).toBeGreaterThan(a.difficulty);
      const count = (s: typeof a) => s.waves.reduce((n, w) => n + w.spawns.reduce((m, x) => m + x.count, 0), 0);
      expect(count(b)).toBeGreaterThanOrEqual(count(a));
      expect(data.bosses[b.boss].hp * stageScale(b).hp).toBeGreaterThan(data.bosses[a.boss].hp * stageScale(a).hp);
      expect(b.reward).toBeGreaterThan(a.reward);
    }
  });
});

import { PROJECTILES } from '../src/art/weaponsArt';
import { PROPS } from '../src/art/props';
import sprites from '../src/data/sprites.json';
import bs from '../src/data/lang/bs.json';
import en from '../src/data/lang/en.json';

describe('art and text coverage', () => {
  it('every projectile, prop and sprite recipe referenced by data exists', () => {
    const recipes = sprites as Record<string, { prop?: string }>;
    for (const e of Object.values(data.enemies)) {
      if (e.projectile) expect(PROJECTILES[e.projectile], e.id).toBeDefined();
      expect(recipes[e.sprite], e.sprite).toBeDefined();
      const prop = recipes[e.sprite].prop;
      if (prop) expect(PROPS[prop], prop).toBeDefined();
    }
    for (const b of Object.values(data.bosses)) {
      expect(PROJECTILES[b.projectile], b.id).toBeDefined();
      const prop = recipes[b.sprite]?.prop;
      if (prop) expect(PROPS[prop], prop).toBeDefined();
    }
    expect(data.characters.filter((c) => c.gender === 'm').length).toBeGreaterThanOrEqual(3);
    expect(data.characters.filter((c) => c.gender === 'f').length).toBeGreaterThanOrEqual(3);
  });

  it('every enemy, boss and character has a name in both languages', () => {
    const keys = [
      ...Object.keys(data.enemies).map((id) => `enemy.${id}`),
      ...Object.keys(data.bosses).flatMap((id) => [`boss.${id}`, `boss.${id}.intro`]),
      ...data.characters.map((c) => `character.${c.id}`),
    ];
    for (const k of keys) {
      expect((bs as Record<string, string>)[k], k).toBeTruthy();
      expect((en as Record<string, string>)[k], k).toBeTruthy();
    }
  });
});
