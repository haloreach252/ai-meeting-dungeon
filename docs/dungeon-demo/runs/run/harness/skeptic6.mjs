// ADVERSARIAL SKEPTIC #6 — independent reachability judge (written from
// scratch; does NOT call the game's isSolvable). Seeds [25000, 30000).
import { shippedLevel } from '../../../../../web/dungeon-b/dungeon.js';

// My own judge. Spec §4: a level is solvable iff
//  - if a K/D pair exists: S can reach K with the door tile treated as a wall,
//    AND K can reach E with the door tile passable;
//  - otherwise: S can reach E.
function myJudge(level) {
  const { grid, start, exit, key, door } = level;
  const R = grid.length, C = grid[0].length;

  function reachable(src, dst, doorBlocked) {
    // iterative flood fill with an explicit stack (deliberately not the same
    // shape as the game's queue-based BFS)
    const visited = Array.from({ length: R }, () => Array(C).fill(false));
    const stack = [src];
    visited[src[0]][src[1]] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      if (r === dst[0] && c === dst[1]) return true;
      const neighbors = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
        if (visited[nr][nc]) continue;
        const t = grid[nr][nc];
        if (t === '#') continue;
        if (doorBlocked && door && nr === door[0] && nc === door[1]) continue;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
    return false;
  }

  const hasPair = key !== null && door !== null;
  if (!hasPair) return reachable(start, exit, false);
  return reachable(start, key, true) && reachable(key, exit, false);
}

// Sanity checks on the judge itself before trusting it.
function sanity() {
  const wall = (r, c, g) => (g[r][c] = '#');
  // 1) trivial open corridor, no key/door -> solvable
  let g1 = [['S', '.', 'E']];
  if (!myJudge({ grid: g1, start: [0, 0], exit: [0, 2], key: null, door: null }))
    throw new Error('sanity1 failed');
  // 2) exit walled off -> unsolvable
  let g2 = [['S', '#', 'E']];
  if (myJudge({ grid: g2, start: [0, 0], exit: [0, 2], key: null, door: null }))
    throw new Error('sanity2 failed');
  // 3) key behind its own door -> unsolvable (S . D K, E adjacent to S)
  let g3 = [['S', '.', 'D', 'K'], ['E', '#', '#', '#']];
  if (myJudge({ grid: g3, start: [0, 0], exit: [1, 0], key: [0, 3], door: [0, 2] }))
    throw new Error('sanity3 failed');
  // 4) key reachable, exit behind door -> solvable
  let g4 = [['S', 'K', 'D', 'E']];
  if (!myJudge({ grid: g4, start: [0, 0], exit: [0, 3], key: [0, 1], door: [0, 2] }))
    throw new Error('sanity4 failed');
  // 5) key reachable but exit walled off (wall, not door) -> unsolvable
  let g5 = [['S', 'K', '#', 'E'], ['.', 'D', '#', '#']];
  if (myJudge({ grid: g5, start: [0, 0], exit: [0, 3], key: [0, 1], door: [1, 1] }))
    throw new Error('sanity5 failed');
  console.error('judge sanity checks passed');
}

sanity();

const LO = 25000, HI = 30000;
const refutations = [];
let sampled = 0;
let genErrors = [];
for (let seed = LO; seed < HI; seed++) {
  let level;
  try {
    level = shippedLevel(seed);
  } catch (e) {
    genErrors.push({ seed, reason: 'shippedLevel threw: ' + e.message });
    sampled++;
    continue;
  }
  sampled++;
  if (!myJudge(level)) {
    refutations.push({
      seed,
      reason:
        'shipped level for seed ' + seed + ' judged UNSOLVABLE by independent BFS ' +
        '(shipped-level internal seed field: ' + level.seed + ')',
    });
  }
}

console.log(JSON.stringify({
  sampled,
  refutations: refutations.slice(0, 10),
  totalRefutations: refutations.length,
  genErrors: genErrors.slice(0, 10),
  totalGenErrors: genErrors.length,
}, null, 2));
