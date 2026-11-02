import { describe, expect, it } from 'vitest';
import { computeUnlocked, validateCleared, isUnlocked } from '../src/core/progression';
import { applyStageResult, createDefaultSave } from '../src/core/save';
import { ctx, data } from './helpers';

const order = ['a', 'b', 'c', 'd'];

describe('stage unlocking', () => {
  it('only the first stage is unlocked on a new save', () => {
    expect(computeUnlocked(order, [])).toEqual(['a']);
    const s = createDefaultSave(ctx);
    expect(s.unlocked).toEqual(['kovaci']);
    expect(s.cleared).toEqual([]);
  });

  it('campaign order starts Kovači → Bistrik and has 13 stages', () => {
    expect(data.stageOrder.slice(0, 2)).toEqual(['kovaci', 'bistrik']);
    expect(data.stageOrder.at(-1)).toBe('dobrinja');
    expect(data.stageOrder).toHaveLength(13);
  });

  it('clearing a stage unlocks exactly the next one', () => {
    expect(computeUnlocked(order, ['a'])).toEqual(['a', 'b']);
    expect(computeUnlocked(order, ['a', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('ignores clears that are not reachable through the chain', () => {
    expect(validateCleared(order, ['a', 'c'])).toEqual(['a']);
    expect(computeUnlocked(order, ['c', 'd'])).toEqual(['a']);
    expect(isUnlocked(order, ['c'], 'd')).toBe(false);
  });

  it('defeating the Kovači boss unlocks Bistrik', () => {
    const r = applyStageResult(createDefaultSave(ctx), ctx, 'kovaci', 'victory');
    expect(r.unlockedStage).toBe('bistrik');
    expect(r.save.unlocked).toEqual(['kovaci', 'bistrik']);
    expect(r.save.cleared).toEqual(['kovaci']);
  });

  it.each(['defeat', 'quit'] as const)('%s never unlocks or pays', (outcome) => {
    const r = applyStageResult(createDefaultSave(ctx), ctx, 'kovaci', outcome);
    expect(r.unlockedStage).toBeNull();
    expect(r.reward).toBe(0);
    expect(r.save.unlocked).toEqual(['kovaci']);
    expect(r.save.cleared).toEqual([]);
    expect(r.save.stats.runs).toBe(1);
  });

  it('a victory on a locked stage (skip attempt) does nothing', () => {
    const r = applyStageResult(createDefaultSave(ctx), ctx, 'skenderija', 'victory');
    expect(r.reward).toBe(0);
    expect(r.save.cleared).toEqual([]);
    expect(r.save.unlocked).toEqual(['kovaci']);
  });

  it('unknown stage ids are ignored', () => {
    const r = applyStageResult(createDefaultSave(ctx), ctx, 'nowhere', 'victory');
    expect(r.save.cleared).toEqual([]);
  });

  it('unlocking follows the configured order, so reordering needs no logic change', () => {
    const reordered = ['b', 'a', 'c'];
    expect(computeUnlocked(reordered, [])).toEqual(['b']);
    expect(computeUnlocked(reordered, ['b'])).toEqual(['b', 'a']);
  });
});
