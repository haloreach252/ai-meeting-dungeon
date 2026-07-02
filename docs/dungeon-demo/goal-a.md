# Goal: build Variant A of the Grid Dungeon demo (freeform build)

Read `docs/dungeon-demo/spec.md` in full before writing any code. Implement
Sections 2, 3, 4 (the solver is still *defined* there, but see the policy
below), and 6 exactly as written.

## Acceptance policy for THIS build (spec §5, Variant A)

**No solvability gate.** Ship whatever the generator emits — including
unsolvable levels. Do not run a solver before presenting a level, do not
regenerate on failure, do not "repair" bad levels. The generator's ~25–35%
unsolvable rate reaching the player is intentional and is the point of this
variant. Keeping the raw generator fallible per spec §3 is a hard requirement.

## Structure (this overrides spec §1's "single self-contained index.html")

Split the deliverable into two files so the shipped level is headlessly
inspectable:

- `web/dungeon-a/dungeon.js` — an ES module containing the seeded generator
  (mulberry32 or similar) and exporting:
  - `shippedLevel(seed)` → the level object the player would actually be
    given for that seed, shaped exactly per spec §6:
    `{ grid: string[][], start: [r,c], exit: [r,c], key: [r,c]|null, door: [r,c]|null, seed: number }`.
    For Variant A this is the RAW generator output — no gate.
- `web/dungeon-a/index.html` — imports `./dungeon.js` (module script), renders
  the game (canvas or CSS grid), handles arrow-key/WASD movement, walls, the
  key/door rule, the "Solved!" state, a New Level button, and a visible seed —
  and exposes `window.__demo = { newLevel(seed?), getLevel() }` per spec §6.

Notes: the repo's `package.json` sets `"type": "module"`, so `.js` files are ES
modules under node. `dungeon.js` must not touch `window`/`document` at module
top level (it must load cleanly in node); all DOM work lives in `index.html`.

## Done condition (must be PROVEN in the transcript)

The goal is complete only when you have run this from the repo root and shown
its output in the transcript:

```sh
node -e "import('./web/dungeon-a/dungeon.js').then(m => { const a = m.shippedLevel(12345), b = m.shippedLevel(12345); console.log('shape', JSON.stringify({ rows: a.grid.length, cols: a.grid[0].length, start: a.start, exit: a.exit, key: a.key, door: a.door, seed: a.seed })); console.log('deterministic', JSON.stringify(a) === JSON.stringify(b)); })"
```

and the output shows (1) a 15x11-ish grid with `start`, `exit`, `key`, `door`
(key/door may be null), and `seed: 12345`; and (2) `deterministic true`.

Stop when that is proven, **or stop after 25 turns**, whichever comes first.
Do not touch `web/dungeon-b/`, `web/index.html`, or anything outside
`web/dungeon-a/`.
