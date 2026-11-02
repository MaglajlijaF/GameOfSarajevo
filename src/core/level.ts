import type { StageDef } from './types';

/** Logical cell types. Rendering maps these to tiles; physics maps them to collision. */
export const CELL = { EMPTY: 0, SOLID: 1, ONEWAY: 2, LADDER: 3, HAZARD: 4 } as const;
export type Cell = (typeof CELL)[keyof typeof CELL];

export const ARENA_W = 40;
export const LEVEL_H = 23;
export const CORRIDOR_W = 10;
export const START_W = 14;

export interface Section {
  kind: 'arena' | 'boss';
  /** wave index 0..4 for arenas, -1 for boss */
  wave: number;
  x0: number; // first column (tiles)
  x1: number; // one past last column
  spawns: { x: number; y: number }[];
  bossSpawn?: { x: number; y: number };
}

export interface LevelPlan {
  width: number;
  height: number;
  cells: Cell[][]; // [row][col]
  sections: Section[];
  playerSpawn: { x: number; y: number };
}

const CHAR_CELL: Record<string, Cell> = { '#': CELL.SOLID, '=': CELL.ONEWAY, H: CELL.LADDER, '^': CELL.HAZARD };

function groundColumn(rows: Cell[][], x: number) {
  for (let y = 20; y < LEVEL_H; y++) rows[y][x] = CELL.SOLID;
}

/**
 * Assembles a stage: start corridor, 5 arenas separated by corridors, then the
 * boss arena. Coordinates in the result are tile units.
 */
export function buildLevel(stage: StageDef, layouts: Record<string, string[]>): LevelPlan {
  const layoutIds = [...stage.waves.map((w) => w.layout), stage.bossLayout];
  const width = START_W + stage.waves.length * (ARENA_W + CORRIDOR_W) + ARENA_W;
  const cells: Cell[][] = Array.from({ length: LEVEL_H }, () => new Array<Cell>(width).fill(CELL.EMPTY));
  const sections: Section[] = [];
  let x = 0;
  for (let i = 0; i < START_W; i++) groundColumn(cells, x + i);
  cells[16][x + 8] = CELL.ONEWAY; cells[16][x + 9] = CELL.ONEWAY; cells[16][x + 10] = CELL.ONEWAY;
  x += START_W;

  layoutIds.forEach((id, idx) => {
    const rows = layouts[id];
    const isBoss = idx === layoutIds.length - 1;
    const sec: Section = { kind: isBoss ? 'boss' : 'arena', wave: isBoss ? -1 : idx, x0: x, x1: x + ARENA_W, spawns: [] };
    rows.forEach((row, r) => {
      for (let c = 0; c < ARENA_W; c++) {
        const ch = row[c];
        const cell = CHAR_CELL[ch];
        if (cell !== undefined) cells[r][x + c] = cell;
        if (ch === 'S') sec.spawns.push({ x: x + c, y: r });
        if (ch === 'B') sec.bossSpawn = { x: x + c, y: r };
      }
    });
    sections.push(sec);
    x += ARENA_W;
    if (!isBoss) {
      for (let i = 0; i < CORRIDOR_W; i++) groundColumn(cells, x + i);
      // a small step platform in every corridor
      for (let i = 3; i < 7; i++) cells[17][x + i] = CELL.ONEWAY;
      x += CORRIDOR_W;
    }
  });
  // close the level ends with walls
  for (let y = 0; y < LEVEL_H; y++) { cells[y][0] = CELL.SOLID; cells[y][width - 1] = CELL.SOLID; }

  return { width, height: LEVEL_H, cells, sections, playerSpawn: { x: 4, y: 18 } };
}

/** How far the player can get with a double jump, in tiles (kept conservative). */
export const REACH = { up: 7, side: 6 };

/**
 * Verifies an arena layout: every spawn marker and every one-way platform must
 * be reachable from the ground on the arena's left edge, using jumps (REACH)
 * and ladders. Returns a list of problems (empty = OK).
 */
export function checkLayoutReachability(rows: string[]): string[] {
  const H = rows.length, W = rows[0].length;
  const cell = (x: number, y: number): Cell => (x < 0 || y < 0 || x >= W || y >= H ? CELL.SOLID : (CHAR_CELL[rows[y][x]] ?? CELL.EMPTY));
  const solidish = (c: Cell) => c === CELL.SOLID || c === CELL.ONEWAY;
  const stand = (x: number, y: number) => cell(x, y) !== CELL.SOLID && (solidish(cell(x, y + 1)) || cell(x, y) === CELL.LADDER);
  const nodes: [number, number][] = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) if (stand(x, y) && cell(x, y) !== CELL.HAZARD) nodes.push([x, y]);
  const key = (x: number, y: number) => y * W + x;
  const seen = new Set<number>();
  const start = nodes.find(([x, y]) => x <= 2 && y >= 18);
  if (!start) return ['no ground at the left edge'];
  const queue = [start];
  seen.add(key(...start));
  while (queue.length) {
    const [ax, ay] = queue.shift()!;
    for (const [bx, by] of nodes) {
      const k = key(bx, by);
      if (seen.has(k)) continue;
      const dx = Math.abs(bx - ax), dy = by - ay;
      const ladder = cell(ax, ay) === CELL.LADDER || cell(bx, by) === CELL.LADDER;
      const ok = (ladder && dx <= 1 && Math.abs(dy) <= 1) || (dy >= -REACH.up && dx <= REACH.side + Math.max(0, dy) / 2);
      if (ok) { seen.add(k); queue.push([bx, by]); }
    }
  }
  const problems: string[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x];
    if ((ch === 'S' || ch === 'B') && !seen.has(key(x, y)) && stand(x, y)) problems.push(`spawn ${ch} at ${x},${y} unreachable`);
    if (ch === '=' && y > 0 && cell(x, y - 1) !== CELL.SOLID && !seen.has(key(x, y - 1))) problems.push(`platform at ${x},${y} unreachable`);
  }
  return problems;
}
