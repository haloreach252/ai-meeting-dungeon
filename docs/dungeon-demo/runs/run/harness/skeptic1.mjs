// SKEPTIC #1 harness — adversarial verification of Variant B's gate.
// Imports ONLY shippedLevel/generation from the game module. The judge below
// is written from scratch against spec §4 and deliberately does NOT reuse or
// look at the game's isSolvable implementation.
//
// Spec §4 (canonical solvability):
//   If a K/D pair exists: (1) S -> K reachable with D impassable, AND
//                         (2) K -> E reachable with D passable.
//   If no K/D pair: S -> E reachable.
//   4-connected; '#' is always impassable.

import { shippedLevel } from '../../../../../web/dungeon-b/dungeon.js';

// --- My own judge (independent flood fill over grid characters) -----------
function reachable(grid, from, to, doorPassable) {
  const R = grid.length, C = grid[0].length;
  const blocked = (ch) => ch === '#' || (ch === 'D' && !doorPassable);
  if (blocked(grid[from[0]][from[1]])) return false;
  const seen = Array.from({ length: R }, () => new Array(C).fill(false));
  const stack = [from];
  seen[from[0]][from[1]] = true;
  while (stack.length) {
    const [r, c] = stack.pop();
    if (r === to[0] && c === to[1]) return true;
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if (seen[nr][nc]) continue;
      if (blocked(grid[nr][nc])) continue;
      seen[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return false;
}

function myJudge(level) {
  const { grid, start, exit, key, door } = level;
  if (key && door) {
    return reachable(grid, start, key, false) && reachable(grid, key, exit, true);
  }
  return reachable(grid, start, exit, true);
}

// --- Structural sanity checks (a malformed shipped level is also a refutation)
function structuralProblem(level) {
  const { grid, start, exit, key, door } = level;
  if (!Array.isArray(grid) || grid.length === 0) return 'bad grid';
  if (!start || grid[start[0]]?.[start[1]] !== 'S') return 'start tile mismatch';
  if (!exit || grid[exit[0]]?.[exit[1]] !== 'E') return 'exit tile mismatch';
  if ((key && !door) || (door && !key)) return 'dangling half of K/D pair';
  if (key && grid[key[0]]?.[key[1]] !== 'K') return 'key tile mismatch';
  if (door && grid[door[0]]?.[door[1]] !== 'D') return 'door tile mismatch';
  return null;
}

// --- Sweep my disjoint seed block ------------------------------------------
const LO = 0, HI = 5000;
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
  const sp = structuralProblem(level);
  if (sp) {
    refutations.push({ seed, reason: 'malformed shipped level: ' + sp });
    continue;
  }
  if (!myJudge(level)) {
    const why = level.key
      ? (!reachable(level.grid, level.start, level.key, false)
          ? 'S cannot reach K with door closed (key behind own door / disconnected)'
          : 'K cannot reach E even with door open')
      : 'S cannot reach E (no K/D pair)';
    refutations.push({ seed, reason: 'shipped level unsolvable per independent judge: ' + why });
  }
}

console.log(JSON.stringify({
  skeptic_index: 1,
  seed_range: [LO, HI],
  seeds_sampled: sampled,
  refutation_count: refutations.length,
  refutations: refutations.slice(0, 10),
  all_shipped_solvable: refutations.length === 0,
}, null, 2));
