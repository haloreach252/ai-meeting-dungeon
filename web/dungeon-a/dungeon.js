// Grid Dungeon — Variant A (freeform build, NO solvability gate).
// Pure module: no window/document access, loads cleanly under node.

export const ROWS = 11;
export const COLS = 15;

// Seeded PRNG (mulberry32) — same seed, same level, always.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Naive-on-purpose generator (spec §3): carve rooms and corridors, then drop
// S, E, and sometimes a K/D pair at loosely-constrained random spots. No
// connectivity or solvability checks here — that's variant policy (§5).
export function generateLevel(seed) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('#'));

  const roomCount = 3 + Math.floor(rand() * 3); // 3–5 rooms
  for (let i = 0; i < roomCount; i++) {
    const w = 3 + Math.floor(rand() * 4); // 3–6
    const h = 2 + Math.floor(rand() * 3); // 2–4
    const r0 = 1 + Math.floor(rand() * (ROWS - h - 1));
    const c0 = 1 + Math.floor(rand() * (COLS - w - 1));
    for (let r = r0; r < r0 + h; r++)
      for (let c = c0; c < c0 + w; c++) grid[r][c] = '.';
  }

  const corridorCount = 1 + Math.floor(rand() * 2); // 1–2 corridors
  for (let i = 0; i < corridorCount; i++) {
    if (rand() < 0.5) {
      const r = 1 + Math.floor(rand() * (ROWS - 2));
      let c1 = 1 + Math.floor(rand() * (COLS - 2));
      let c2 = 1 + Math.floor(rand() * (COLS - 2));
      if (c1 > c2) [c1, c2] = [c2, c1];
      for (let c = c1; c <= c2; c++) grid[r][c] = '.';
    } else {
      const c = 1 + Math.floor(rand() * (COLS - 2));
      let r1 = 1 + Math.floor(rand() * (ROWS - 2));
      let r2 = 1 + Math.floor(rand() * (ROWS - 2));
      if (r1 > r2) [r1, r2] = [r2, r1];
      for (let r = r1; r <= r2; r++) grid[r][c] = '.';
    }
  }

  const floors = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (grid[r][c] === '.') floors.push([r, c]);

  // Draw distinct random floor tiles for the special positions.
  const pick = () => floors.splice(Math.floor(rand() * floors.length), 1)[0];
  const start = pick();
  const exit = pick();
  let key = null;
  let door = null;
  if (rand() < 0.6 && floors.length >= 2) {
    key = pick();
    door = pick();
  }

  grid[start[0]][start[1]] = 'S';
  grid[exit[0]][exit[1]] = 'E';
  if (key) grid[key[0]][key[1]] = 'K';
  if (door) grid[door[0]][door[1]] = 'D';

  return { grid, start, exit, key, door, seed };
}

// Canonical solvability judge (spec §4), plain BFS. Defined per spec, but
// Variant A never calls it before shipping a level.
export function isSolvable(level) {
  const { grid, start, exit, key, door } = level;
  function bfs(from, to, doorOpen) {
    const seen = new Set([from.join(',')]);
    const queue = [from];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === to[0] && c === to[1]) return true;
      for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) continue;
        if (grid[nr][nc] === '#' || seen.has(nr + ',' + nc)) continue;
        if (!doorOpen && door && nr === door[0] && nc === door[1]) continue;
        seen.add(nr + ',' + nc);
        queue.push([nr, nc]);
      }
    }
    return false;
  }
  if (!key || !door) return bfs(start, exit, true);
  return bfs(start, key, false) && bfs(key, exit, true);
}

// Variant A acceptance policy (spec §5): ship the raw generator output.
export function shippedLevel(seed) {
  return generateLevel(seed);
}
