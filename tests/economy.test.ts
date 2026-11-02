import { describe, expect, it } from 'vitest';
import { stageReward, upgradeCost } from '../src/core/economy';
import { applyStageResult, buyStarter, buyUpgrade, createDefaultSave, selectStarter } from '../src/core/save';
import { statsFromUpgrades, applyBuff, BASE_STATS } from '../src/core/stats';
import { ctx, data } from './helpers';

describe('economy', () => {
  it('first clear pays full reward; replays pay the reduced fraction', () => {
    const st = data.stages.kovaci;
    expect(stageReward(st, false)).toBe(st.reward);
    expect(stageReward(st, true)).toBe(Math.floor(st.reward * st.replayFactor));
    expect(stageReward(st, true)).toBeLessThan(stageReward(st, false));
  });

  it('replaying a cleared stage adds reduced KM and does not duplicate clears', () => {
    let s = applyStageResult(createDefaultSave(ctx), ctx, 'kovaci', 'victory').save;
    const km1 = s.km;
    const r = applyStageResult(s, ctx, 'kovaci', 'victory');
    s = r.save;
    expect(r.firstClear).toBe(false);
    expect(r.unlockedStage).toBeNull();
    expect(s.km - km1).toBe(stageReward(data.stages.kovaci, true));
    expect(s.cleared).toEqual(['kovaci']);
  });

  it('upgrade cost increases with level', () => {
    for (const u of data.shop.upgrades) expect(upgradeCost(u, 1)).toBeGreaterThan(upgradeCost(u, 0));
  });

  it('buying deducts KM and raises level; cannot buy without funds', () => {
    let s = createDefaultSave(ctx);
    expect(buyUpgrade(s, ctx, 'health').ok).toBe(false);
    s = { ...s, km: 1000 };
    const r = buyUpgrade(s, ctx, 'health');
    expect(r.ok).toBe(true);
    expect(r.save.upgrades.health).toBe(1);
    expect(r.save.km).toBe(1000 - upgradeCost(data.shop.upgrades[0], 0));
  });

  it('cannot exceed max upgrade level', () => {
    let s = { ...createDefaultSave(ctx), km: 1e9 };
    for (let i = 0; i < 50; i++) s = buyUpgrade(s, ctx, 'speed').save;
    const max = data.shop.upgrades.find((u) => u.id === 'speed')!.maxLevel;
    expect(s.upgrades.speed).toBe(max);
  });

  it('starter weapons can be bought once and selected', () => {
    let s = { ...createDefaultSave(ctx), km: 1000 };
    const r = buyStarter(s, ctx, 'cevapi');
    expect(r.ok).toBe(true);
    s = r.save;
    expect(s.selectedStarter).toBe('cevapi');
    expect(buyStarter(s, ctx, 'cevapi').ok).toBe(false);
    s = selectStarter(s, 'rucka');
    expect(s.selectedStarter).toBe('rucka');
    expect(selectStarter(s, 'dzezva').selectedStarter).toBe('rucka');
    expect(buyStarter(s, ctx, 'golub').ok).toBe(false); // not a starter
  });

  it('upgrades and buffs feed player stats', () => {
    const st = statsFromUpgrades({ health: 2, damage: 1, speed: 1, xp: 3 }, data.shop.upgrades);
    expect(st.maxHp).toBe(BASE_STATS.maxHp + 24);
    expect(st.damageMult).toBeCloseTo(1.08);
    expect(st.xpMult).toBeCloseTo(1.3);
    const b = applyBuff(st, data.buffs.strength);
    expect(b.damageMult).toBeCloseTo(1.23);
  });
});
