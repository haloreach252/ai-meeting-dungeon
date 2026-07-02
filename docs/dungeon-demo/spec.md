# Grid Dungeon — Shared Build Spec (A/B verification demo)

This is the **shared** spec for a browser game used to demo two build methods
side by side. Both variants implement everything below identically. They differ
in **exactly one thing**: the *acceptance policy* (Section 5). Nothing else may
diverge, or the A/B comparison measures aesthetics instead of correctness.

---

## 1. Deliverable

- A single self-contained `index.html` per variant. No build step, no external
  dependencies, no network calls. Deployable by dropping the file on Cloudflare
  Pages (or opening locally).
- Pure vanilla JS + a `<canvas>` or CSS-grid render. Keep it small and readable.

## 2. The game

- Top-down dungeon on a tile grid (recommend **15 x 11**).
- Tiles: `floor`, `wall`, `start` (S), `exit` (E), `key` (K), `locked door` (D).
- The player spawns on S and moves one tile at a time with arrow keys / WASD.
  Walls block movement.
- A `locked door` (D) is impassable **until the player has picked up the key**
  (K). Picking up K is automatic on stepping onto its tile.
- **Win** = player reaches E. Show a simple "Solved!" state and a New Level
  button. There is no timer, score, enemies, or sound. Keep scope minimal.

## 3. Level generator (shared, deliberately fallible)

- Generate a **fresh level on load and on every "New Level" press.**
- Use a **seeded PRNG** (e.g. mulberry32) and display the seed. A given seed must
  reproduce the same level exactly — this is required for the backup broken
  example in the demo harness.
- Generation may be **naive on purpose**: carve some rooms/corridors, then place
  S, E, and (sometimes) a K + D pair at loosely-constrained random positions.
- The generator MUST be capable of producing **unsolvable** levels — e.g. E
  walled off, or K placed in a region only reachable *through* D (key behind its
  own door). Target an unsolvable rate of roughly **25–35%** so a broken level
  surfaces within a few reloads. Do **not** add a solvability check here; that is
  variant-specific (Section 5).

## 4. Canonical solvability definition (the "judge")

A level is **solvable** iff, treating D as passable only after K is collected:

1. There is a path (4-connected, non-wall) from S to K if a K/D pair exists, AND
2. From the post-key state (D now passable), there is a path from the key
   position to E.
   If there is no K/D pair, solvability is simply: a path from S to E.

Implement this as a plain BFS. This exact function is reused by the demo harness
oracle (Section 6). Keep it ~15 lines and obviously correct — its trustworthiness
is the whole point of the demo.

## 5. Acceptance policy — THE ONLY THING THAT DIFFERS

- **Variant A (goal-loop build):** ship whatever the generator produces. No
  solvability gate. Broken levels reach the player. This is intentional.
- **Variant B (workflow build):** after generating, run the Section 4 solver.
  If unsolvable, regenerate (or repair) and re-check; only ever present a level
  the solver confirms solvable.

Everything in Sections 2–4 and 6 is byte-for-byte the same across A and B.

## 6. Page interface contract (so the harness can judge from outside)

Each variant page must expose, on `window`:

```js
window.__demo = {
  newLevel(seed?) { /* regenerate; if seed given, use it */ },
  getLevel() {
    // returns the CURRENT level as plain data for the external oracle:
    // { grid: string[][], start:[r,c], exit:[r,c], key:[r,c]|null, door:[r,c]|null, seed:number }
  }
};
```

The harness never trusts a variant's internal logic — it reads `getLevel()` and
runs its own copy of the Section 4 solver.

## 7. Demo harness (thin wrapper — built once, not by either agent run)

- One page embedding Variant A (left) and Variant B (right) in iframes,
  **unlabeled** ("Version 1" / "Version 2").
- A shared **New Level** button that calls `newLevel()` on both.
- A **Reveal** toggle, hidden by default. When enabled, the harness runs its
  canonical solver on each pane's `getLevel()` and overlays **SOLVABLE / UNSOLVABLE**.
  Left will occasionally read UNSOLVABLE; right never will.
- A **seed input**: typing a seed calls `newLevel(seed)` on both panes — used to
  force a known-broken level for A on demand as a live-demo safety net.

## 8. Talk mapping (why this shape)

- Variant A ≙ freeform autonomous authoring: fast, plausible, occasionally wrong.
- Variant B ≙ fan-out + adversarial verification: the solver gate is the "skeptic
  that refutes each candidate before it's trusted."
- The external oracle ≙ verifying at the seam with a check independent of the
  thing that produced the work.
