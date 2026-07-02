// Skeptic #3 harness — independent reachability judge, written from scratch.
// Does NOT call the game's isSolvable. Only imports shippedLevel (the thing
// under attack) and judges its output with my own BFS per spec §4.
import { pathToFileURL } from 'node:url';

const mod = await import(
  pathToFileURL('N:/_WORK/AI_MEETING_DEMO/web/dungeon-b/dungeon.js').href
);
const { shippedLevel } = mod;

// --- My own judge (spec §4), independent implementation -------------------
// A tile is passable iff it is not '#', except the door tile which is only
// passable once the key has been collected.
function myReach(grid, src, dst, blocked) {
  const R = grid.length, C = grid[0].length;
  const q = [src];
  const vis = Array.from({ length: R }, () => new Array(C).fill(false));
  vis[src[0]][src[1]] = true;
  for (let i = 0; i < q.length; i++) {
    const [r, c] = q[i];
    if (r === dst[0] && c === dst[1]) return true;
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (const [nr, nc] of nbrs) {
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if (vis[nr][nc]) continue;
      if (grid[nr][nc] === '#') continue;
      if (blocked && nr === blocked[0] && nc === blocked[1]) continue;
      vis[nr][nc] = true;
      q.push([nr, nc]);
    }
  }
  return false;
}

function myJudge(level) {
  const { grid, start, exit, key, door } = level;
  if (key && door) {
    // Phase 1: S -> K with the door impassable.
    if (!myReach(grid, start, key, door)) return false;
    // Phase 2: K -> E with the door passable.
    return myReach(grid, key, exit, null);
  }
  return myReach(grid, start, exit, null);
}

// --- Sanity self-checks on my judge before trusting it --------------------
const wall = '#';
const t1 = {
  grid: [
    ['#','#','#','#','#'],
    ['#','S','#','E','#'],
    ['#','#','#','#','#'],
  ].map(r => r.slice()),
  start: [1,1], exit: [1,3], key: null, door: null,
};
if (myJudge(t1) !== false) throw new Error('self-check 1 failed (walled off should be unsolvable)');
const t2 = {
  grid: [
    ['#','#','#','#','#','#'],
    ['#','S','.','D','K','#'],
    ['#','#','#','#','E','#'],
  ].map(r => r.slice()),
  start: [1,1], exit: [2,4], key: [1,4], door: [1,3],
};
// Key behind its own door — unsolvable.
if (myJudge(t2) !== false) throw new Error('self-check 2 failed (key behind own door)');
const t3 = {
  grid: [
    ['#','#','#','#','#','#'],
    ['#','S','K','D','E','#'],
    ['#','#','#','#','#','#'],
  ].map(r => r.slice()),
  start: [1,1], exit: [1,4], key: [1,2], door: [1,3],
};
if (myJudge(t3) !== true) throw new Error('self-check 3 failed (key then door should be solvable)');
console.error('judge self-checks passed');

// --- Sweep my disjoint seed block ------------------------------------------
const LO = 10000, HI = 15000;
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
  if (!myJudge(level)) {
    const why = (level.key && level.door)
      ? (!myReach(level.grid, level.start, level.key, level.door)
          ? 'no S->K path with door blocked'
          : 'no K->E path with door open')
      : 'no S->E path';
    refutations.push({ seed, reason: `shipped level unsolvable by independent BFS: ${why} (shipped seed field=${level.seed})` });
  }
}
console.log(JSON.stringify({ sampled, lo: LO, hi: HI, refutations: refutations.slice(0, 10), totalRefutations: refutations.length }));
