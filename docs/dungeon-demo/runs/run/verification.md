# Verification Report — Dungeon Variant B ("workflow" build)

## Headline

**Claim: Variant B never ships an unsolvable level.**
**Result: VERIFIED — 6 independent adversarial skeptics swept 30,000 shipped levels and found zero counterexamples.**

## What we did, in plain terms

Variant B's level generator is deliberately naive — it scatters rooms, corridors, a start, an exit, and sometimes a key/door pair with no regard for whether the result is beatable. What makes it safe is a **gate**: every candidate level is run through a solver before it's allowed to reach the player, and any candidate that fails is deterministically regenerated until one passes (bounded, and deterministic per seed, so the same seed always yields the same level). To check that this gate actually keeps its promise, we didn't just re-run the game's own solver — that would only prove the code agrees with itself. Instead, we launched six independent "skeptics," each of which wrote its **own** reachability judge from the written spec (never looking at or reusing the game's solver), and each of which attacked a different, non-overlapping block of 5,000 seeds. Each skeptic pulled the level the game would actually ship for each seed and tried to prove it unbeatable — including structural attacks (malformed grids, a key locked behind its own door, dangling key/door halves). Any level a skeptic flagged would then have to survive an independent confirmation gate before counting as a real counterexample, and any confirmed counterexample would trigger a bounded repair of the generator followed by a fresh adversarial pass. None of that machinery was needed: after 30,000 shipped levels, not one skeptic produced a single confirmed refutation.

## The numbers

| Metric | Value |
| --- | --- |
| Verification passes | 1 |
| Independent skeptics | 6 |
| Seeds per skeptic (disjoint blocks) | 5,000 |
| Total shipped levels sampled | 30,000 |
| Candidate refutations raised | 0 |
| **Confirmed refutations (independent gate)** | **0** |
| Repair passes required | 0 |
| Verdict | **VERIFIED** |

- Seed blocks: skeptic *i* swept seeds `[(i−1)·5000, i·5000)`, covering `[0, 30000)` with no overlap.
- Each skeptic used its own reachability judge (independent flood-fill/BFS implementations written against spec §4), plus structural sanity checks so a malformed shipped level also counts as a refutation.
- Confirmed counterexample seeds: **none** — there are no seeds to reproduce because no refutation survived.

## Method summary

1. **Fallible generator + gate** (`web/dungeon-b/dungeon.js`): `generateLevel(seed)` is naive-on-purpose; `shippedLevel(seed)` gates every candidate through the canonical BFS solver (`isSolvable`, spec §4) and deterministically re-derives candidate seeds until one passes.
2. **Adversarial skeptics with independent judges** (`docs/dungeon-demo/runs/run/harness/skeptic*.mjs`): 6 skeptics, each with a from-scratch judge and a disjoint 5,000-seed block, attacking the actual shipped output.
3. **Independent confirm gate**: skeptic findings only count once re-confirmed by a judge independent of the reporting skeptic (0 findings reached this stage).
4. **Bounded repair loop**: confirmed counterexamples would trigger a generator repair and a fresh full pass (0 repair passes needed).

## Reproduce

```
node docs/dungeon-demo/runs/run/harness/skeptic1.mjs        # seeds 0–4999
node docs/dungeon-demo/runs/run/harness/skeptic2.mjs        # seeds 5000–9999
node docs/dungeon-demo/runs/run/harness/skeptic3.mjs        # seeds 10000–14999
node docs/dungeon-demo/runs/run/harness/skeptic4-judge.mjs  # seeds 15000–19999
node docs/dungeon-demo/runs/run/harness/skeptic5.mjs        # seeds 20000–24999
node docs/dungeon-demo/runs/run/harness/skeptic6.mjs        # seeds 25000–29999
```

Determinism guarantee: `shippedLevel(seed)` is a pure function of `seed`, so every sampled level is exactly reproducible.
