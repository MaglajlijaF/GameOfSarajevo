import { CELL, LEVEL_H, type Cell, type LevelPlan } from './level';

/**
 * The interactive tutorial course, left to right. Each step has a prompt and,
 * where needed, a gate that opens when the step is done.
 */
export const TUTORIAL_W = 112;

export type TutorialStep = 'move' | 'jump' | 'double' | 'dash' | 'ladder' | 'drop' | 'attack' | 'steam' | 'info';
export const TUTORIAL_STEPS: TutorialStep[] = ['move', 'jump', 'double', 'dash', 'ladder', 'drop', 'attack', 'steam', 'info'];

/** Tile x of the gate that holds the player until a step is done. */
export const TUTORIAL_GATES: Partial<Record<TutorialStep, number>> = { move: 13, dash: 39, drop: 53, attack: 76 };
/** Tile x the player must pass to finish an obstacle step. */
export const TUTORIAL_PASS: Partial<Record<TutorialStep, number>> = { jump: 20, double: 28, steam: 94 };
/** Dummy spawn tiles (x, row above ground) for the attack and steam lessons. */
export const TUTORIAL_DUMMIES = { attack: [60, 66, 71], steam: [87] };
export const TUTORIAL_INFO_CARDS = 4;

export function tutorialPlan(): LevelPlan {
  const W = TUTORIAL_W;
  const cells: Cell[][] = Array.from({ length: LEVEL_H }, () => new Array<Cell>(W).fill(CELL.EMPTY));
  const solid = (x: number, y0: number, y1: number) => { for (let y = y0; y <= y1; y++) cells[y][x] = CELL.SOLID; };
  for (let x = 0; x < W; x++) solid(x, 20, LEVEL_H - 1);
  for (let y = 0; y < LEVEL_H; y++) { cells[y][0] = CELL.SOLID; cells[y][W - 1] = CELL.SOLID; }
  // jump: a 2-tile block
  for (const x of [17, 18]) solid(x, 18, 19);
  // double jump: a 6-tile wall
  for (const x of [25, 26]) solid(x, 14, 19);
  // ladder up to a wooden platform, then drop back down through it
  for (let y = 12; y <= 19; y++) cells[y][42] = CELL.LADDER;
  for (let x = 42; x <= 51; x++) cells[12][x] = CELL.ONEWAY;
  // steam: two sewer grates in shallow dips
  for (const [a, b] of [[80, 82], [86, 88]]) for (let x = a; x <= b; x++) { cells[20][x] = CELL.EMPTY; cells[21][x] = CELL.HAZARD; }
  return { width: W, height: LEVEL_H, cells, sections: [], playerSpawn: { x: 4, y: 18 } };
}
