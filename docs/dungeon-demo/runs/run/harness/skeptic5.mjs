// Adversarial skeptic #5 — independent solvability judge.
// Imports ONLY shippedLevel/generateLevel from the game; the judge below is
// written from scratch (flood fill, no reuse of the game's isSolvable).
import { shippedLevel } from '../../../../../web/dungeon-b/dungeon.js';

// ---- MY judge (spec §4), independent implementation ----
// Flood fill over 4-connected non-wall tiles. `blocked` is an optional [r,c]
// tile treated as impassable (the closed door). Returns set of reached cells.
function flood(grid, src, blocked) {
  const R = grid.length, C = grid[0].length;
  const reached = Array.from({ length: R }, () => new Array(C).fill(false));
  const stack = [src];
  reached[src[0]][src[1]] = true;
  while (stack.length) {
    const [r, c] = stack.pop();
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if (reached[nr][nc]) continue;
      if (grid[nr][nc] === '#') continue;
      if (blocked && nr === blocked[0] && nc === blocked[1]) continue;
      reached[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return reached;
}

function myJudge(level) {
  const { grid, start, exit, key, door } = level;
  if (key && door) {
    // Phase 1: S -> K with door closed (door tile impassable).
    const pre = flood(grid, start, door);
    if (!pre[key[0]][key[1]]) return false;
    // Phase 2: K -> E with door open.
    const post = flood(grid, key, null);
    return post[exit[0]][exit[1]];
  }
  // No K/D pair: plain S -> E (any lone door/key tile is just floor-like,
  // but generator only ever places both or neither).
  const reach = flood(grid, start, null);
  return reach[exit[0]][exit[1]];
}

// ---- sanity self-tests of my judge on hand-built grids ----
function lvl(rows, extras = {}) {
  const grid = rows.map(s => s.split(''));
  const find = ch => {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[0].length; c++)
        if (grid[r][c] === ch) return [r, c];
    return null;
  };
  return { grid, start: find('S'), exit: find('E'), key: find('K'), door: find('D'), ...extras };
}
const tests = [
  [lvl(['S.E']), true],
  [lvl(['S#E']), false],
  [lvl(['S.K.D.E']), true],        // key before door: solvable
  [lvl(['S.#K#DE']), false],   // key walled off entirely
  [lvl(['S#D#E', '.....']), true], // no K -> plain S->E via row 2 (lone D is passable floor here)
  [lvl(['SD.K.E']), false],    // key behind its own door
  [lvl(['S.DKE']), false],                          // K behind D
  [lvl(['SK.DE']), true],
];
let tfail = 0;
for (const [t, want] of tests) {
  const got = myJudge(t);
  if (got !== want) { tfail++; console.error('SELFTEST FAIL', t.grid.map(r=>r.join('')), 'want', want, 'got', got); }
}
if (tfail) { console.error(`${tfail} self-test failures — judge is wrong, aborting`); process.exit(2); }

// ---- main sweep: seeds [20000, 25000) ----
const LO = 20000, HI = 25000;
const refutations = [];
let sampled = 0, errors = 0;
for (let seed = LO; seed < HI; seed++) {
  sampled++;
  let level;
  try {
    level = shippedLevel(seed);
  } catch (e) {
    errors++;
    refutations.push({ seed, reason: 'shippedLevel threw: ' + e.message });
    continue;
  }
  if (!myJudge(level)) {
    refutations.push({
      seed,
      reason:
        'my independent BFS judge rules the shipped level UNSOLVABLE ' +
        `(shipped internal seed ${level.seed}); grid=\n` +
        level.grid.map(r => r.join('')).join('\n'),
    });
  }
}
console.log(JSON.stringify({
  skeptic_index: 5,
  seed_range: [LO, HI],
  seeds_sampled: sampled,
  errors,
  refutation_count: refutations.length,
  refutations: refutations.slice(0, 10),
  all_shipped_solvable: refutations.length === 0,
}, null, 2));
