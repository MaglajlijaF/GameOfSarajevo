/**
 * Stage unlocking rules.
 * - The first stage in `order` is always unlocked.
 * - Stage N is unlocked only if stage N-1 is cleared (its boss was defeated).
 * - Only a 'victory' outcome clears a stage. Defeat / quit / skip never unlock.
 */
export type StageOutcome = 'victory' | 'defeat' | 'quit';

/** Keeps only clears reachable through the chain from the first stage. */
export function validateCleared(order: readonly string[], cleared: Iterable<string>): string[] {
  const set = new Set(cleared);
  const out: string[] = [];
  for (const id of order) {
    if (!set.has(id)) break;
    out.push(id);
  }
  return out;
}

export function computeUnlocked(order: readonly string[], cleared: Iterable<string>): string[] {
  const valid = new Set(validateCleared(order, cleared));
  const out: string[] = [];
  order.forEach((id, i) => {
    if (i === 0 || valid.has(order[i - 1])) out.push(id);
  });
  return out;
}

export function isUnlocked(order: readonly string[], cleared: Iterable<string>, stageId: string): boolean {
  return computeUnlocked(order, cleared).includes(stageId);
}

export function nextStage(order: readonly string[], stageId: string): string | null {
  const i = order.indexOf(stageId);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}
