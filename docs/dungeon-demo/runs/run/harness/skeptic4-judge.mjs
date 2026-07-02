// Skeptic #4 (verification pass 1) — independent reachability judge.
// Goal: refute "Variant B never ships an unsolvable dungeon" over seeds [15000, 20000).
// This judge is written FROM SCRATCH per spec §4 and does NOT call the game's isSolvable.
//
// Spec §4 rule:
//   If a K/D pair exists:
//     (1) S must reach K with D treated as IMPASSABLE (pre-key state), AND
//     (2) K must reach E with D treated as PASSABLE (post-key state).
//   If no K/D pair: S must simply reach E.
//   Movement is 4-connected; '#' walls always block.

import { shippedLevel } from '../../../../../web/dungeon-b/dungeon.js';

// --- my own BFS, independent of the game's solver ---------------------------
function reaches(grid, from, to, doorPassable) {
  const R = grid.length, C = grid[0].length;
  const blocked = (r, c) => {
    const t = grid[r][c];
    if (t === '#') return true;
    if (t === 'D' && !doorPassable) return true;
    return false;
  };
  if (blocked(from[0], from[1])) return false; // degenerate but be strict
  const seen = Array.from({ length: R }, () => Array(C).fill(false));
  const q = [from];
  seen[from[0]][from[1]] = true;
  while (q.length) {
    const [r, c] = q.shift();
    if (r === to[0] && c === to[1]) return true;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if (seen[nr][nc] || blocked(nr, nc)) continue;
      seen[nr][nc] = true;
      q.push([nr, nc]);
    }
  }
  return false;
}

function myJudge(level) {
  const { grid, start, exit, key, door } = level;
  if (key && door) {
    if (!reaches(grid, start, key, false)) return { ok: false, why: 'S cannot reach K with D locked' };
    if (!reaches(grid, key, exit, true)) return { ok: false, why: 'K cannot reach E even with D open' };
    return { ok: true };
  }
  // No K/D pair (also covers the anomaly of one without the other — flag it)
  if ((key && !door) || (!key && door)) {
    return { ok: false, why: 'anomalous level: key/door not a pair' };
  }
  if (!reaches(grid, start, exit, true)) return { ok: false, why: 'S cannot reach E' };
  return { ok: true };
}

// Also sanity-check structural invariants of what was shipped.
function structuralProblem(level) {
  const { grid, start, exit, key, door } = level;
  if (!grid || grid.length === 0) return 'no grid';
  if (!start || grid[start[0]][start[1]] !== 'S') return 'start marker mismatch';
  if (!exit || grid[exit[0]][exit[1]] !== 'E') return 'exit marker mismatch';
  if (key && grid[key[0]][key[1]] !== 'K') return 'key marker mismatch';
  if (door && grid[door[0]][door[1]] !== 'D') return 'door marker mismatch';
  return null;
}

// --- sweep my disjoint block -------------------------------------------------
const LO = 15000, HI = 20000;
const refutations = [];
let sampled = 0;

for (let seed = LO; seed < HI; seed++) {
  let level;
  try {
    level = shippedLevel(seed);
  } catch (e) {
    refutations.push({ seed, reason: `shippedLevel threw: ${e.message}` });
    sampled++;
    continue;
  }
  sampled++;
  const structural = structuralProblem(level);
  if (structural) {
    refutations.push({ seed, reason: `structural: ${structural}` });
    continue;
  }
  const verdict = myJudge(level);
  if (!verdict.ok) {
    refutations.push({ seed, reason: verdict.why });
  }
}

console.log(JSON.stringify({
  skeptic_index: 4,
  seed_range: [LO, HI],
  seeds_sampled: sampled,
  refutation_count: refutations.length,
  refutations: refutations.slice(0, 10),
  all_shipped_solvable: refutations.length === 0,
}, null, 2));
