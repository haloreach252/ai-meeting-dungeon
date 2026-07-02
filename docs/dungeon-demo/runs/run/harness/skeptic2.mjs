// Skeptic #2 harness — independent reachability judge for Variant B.
// Imports ONLY shippedLevel/generateLevel from the game (the thing under test).
// The judge below is written from scratch against spec §4; it does NOT call
// or copy the game's isSolvable.

import { shippedLevel } from '../../../../../web/dungeon-b/dungeon.js';

// ---- MY judge (spec §4), written independently ----------------------------
// A tile is enterable iff inside the grid and not '#'. The door tile 'D' is
// additionally blocked unless the key has been collected. Movement is
// 4-connected. Solvable iff:
//   - K/D pair exists: S reaches K with door CLOSED, then K reaches E with
//     door OPEN.
//   - no pair: S reaches E (door irrelevant / absent).
function judgeSolvable(level) {
  const g = level.grid;
  const R = g.length, C = g[0].length;

  function reach(src, dst, doorOpen) {
    if (!src || !dst) return false;
    const blocked = (r, c) => {
      if (r < 0 || r >= R || c < 0 || c >= C) return true;
      if (g[r][c] === '#') return true;
      if (!doorOpen && level.door && r === level.door[0] && c === level.door[1]) return true;
      return false;
    };
    if (blocked(src[0], src[1])) return false; // can't even stand on src
    const visited = Array.from({ length: R }, () => new Array(C).fill(false));
    const stack = [src];
    visited[src[0]][src[1]] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      if (r === dst[0] && c === dst[1]) return true;
      const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of nbrs) {
        if (blocked(nr, nc) || visited[nr][nc]) continue;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    return false;
  }

  const hasPair = level.key != null && level.door != null;
  if (!hasPair) return reach(level.start, level.exit, true);
  return reach(level.start, level.key, false) && reach(level.key, level.exit, true);
}

// ---- Sanity self-tests for the judge (hand-built levels) -------------------
function lv(rows, extra = {}) {
  const grid = rows.map(s => s.split(''));
  const find = ch => {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) if (grid[r][c] === ch) return [r, c];
    return null;
  };
  return { grid, start: find('S'), exit: find('E'), key: find('K'), door: find('D'), ...extra };
}
const tests = [
  // simple open path, no pair
  [lv(['S.E']), true],
  // exit walled off, no pair
  [lv(['S#E']), false],
  // key before door: S -> K, then through D to E
  [lv(['S.K#.', '###D.', '..#.E']), false], // K reachable but D not on any path? check: from K(0,2), open door D(1,3): K->(0,2) has right neighbor (0,3)='#'. down (1,2)='#'. So unsolvable.
  [lv(['SKD E'.replace(' ', '.')]), true],  // S K D E in a row: S->K ok, K->E via open D
  // key behind its own door
  [lv(['SD K'.replace(' ', '.')].map(s => s)), false], // S . can't pass D closed to reach K
];
for (const [level, want] of tests) {
  const got = judgeSolvable(level);
  if (got !== want) {
    console.error('JUDGE SELF-TEST FAILED', { want, got, grid: level.grid.map(r => r.join('')) });
    process.exit(2);
  }
}

// ---- Sweep the assigned seed block -----------------------------------------
const LO = 5000, HI = 10000;
const refutations = [];
let sampled = 0;
for (let seed = LO; seed < HI; seed++) {
  let level;
  try {
    level = shippedLevel(seed);
  } catch (e) {
    refutations.push({ seed, reason: 'shippedLevel threw: ' + e.message });
    sampled++;
    continue;
  }
  sampled++;
  if (!judgeSolvable(level)) {
    const why = (level.key && level.door)
      ? 'my BFS judge: no S->K path with door closed, or no K->E path with door open'
      : 'my BFS judge: no S->E path';
    refutations.push({
      seed,
      reason: `shipped level for input seed ${seed} (internal seed ${level.seed}) ruled UNSOLVABLE — ${why}`,
      grid: level.grid.map(r => r.join('')),
    });
    if (refutations.length <= 3) {
      console.error('COUNTEREXAMPLE seed=' + seed);
      console.error(level.grid.map(r => r.join('')).join('\n'));
    }
  }
}

console.log(JSON.stringify({
  skeptic_index: 2,
  seed_range: [LO, HI],
  seeds_sampled: sampled,
  refutations: refutations.slice(0, 10).map(({ seed, reason }) => ({ seed, reason })),
  refutation_count: refutations.length,
  all_shipped_solvable: refutations.length === 0,
}, null, 2));
