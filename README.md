# Grid Dungeon — an A/B demo of AI build methods

**Live demo: [ai-meeting.nathanruesch.com](https://ai-meeting.nathanruesch.com)**

Two AI agents were given the **same spec** for a tiny browser dungeon game and
allowed to differ in **exactly one line of policy**. This repo contains both
results, side by side, plus the machinery that proves the difference is real.

- **Version 1 (Variant A)** — built by a freeform autonomous agent loop.
  Policy: *ship whatever the generator produces.*
- **Version 2 (Variant B)** — built by an orchestrated workflow with
  adversarial verification. Policy: *never ship a level a solver hasn't
  confirmed solvable.*

Both use the same deliberately naive level generator, which produces broken
(unsolvable) dungeons roughly a quarter of the time. The only question is
whether those broken levels reach the player.

## The punchline, measured

| | Variant A (freeform) | Variant B (verified) |
|---|---|---|
| Levels shipped unsolvable | **528 / 2,000 seeds (26.4%)** | **0 / 2,000 seeds** |
| Adversarial sweep (6 independent skeptics × 5,000 disjoint seeds) | — | **0 / 30,000** |

Both measurements come from a judge that is independent of both games — the
same BFS solver the demo harness uses. Variant B's 30,000-seed sweep is
documented in the [verification report](docs/dungeon-demo/runs/run/verification.md),
including the reproduction commands.

## Driving the demo

Open the [live harness](https://ai-meeting.nathanruesch.com) (or serve it
locally, below):

1. **New Level** — regenerates both panes. Within a handful of clicks,
   Version 1 will deal you a dungeon that cannot be beaten (exit walled off,
   or the key locked behind its own door). Version 2 never will.
2. **Reveal** — the harness runs its *own* copy of the solvability check on
   each pane and overlays **SOLVABLE / UNSOLVABLE**. It never trusts either
   game's internal logic: it reads the level through a small
   `window.__demo.getLevel()` contract and judges from outside.
3. **Seed input** — both games are seeded and deterministic. Try seed **4**,
   **6**, or **13**: Version 1 ships a broken level, Version 2 ships a
   solvable one, every time.

Play a pane directly: arrow keys / WASD, grab the key (K) to open the door
(D), reach the exit (E).

## Why this exists

This is a talk demo about *how you let AI build things*:

- **Variant A** is freeform autonomous authoring — fast, plausible, and
  occasionally wrong in ways that look fine until a user hits them.
- **Variant B** is fan-out plus adversarial verification — six independent
  "skeptics" each wrote their own solver from the written spec (never reading
  the game's code) and attacked disjoint seed blocks of the *actual shipped
  output*, with an independent confirmation gate and a bounded repair loop
  behind them.
- **The harness** is verification at the seam: judge the work with a check
  that is independent of whatever produced it.

The two variants share everything else — grid, movement, key/door rule,
seeded generator, even the generator's failure rate — so the comparison
measures the policy, not the aesthetics. See the
[shared spec](docs/dungeon-demo/spec.md), §5 in particular.

## Repo map

```
web/index.html                        the A/B harness (independent solver, unlabeled panes)
web/dungeon-a/                        Variant A — built by the freeform goal loop
web/dungeon-b/                        Variant B — built by the verification workflow
docs/dungeon-demo/spec.md             the shared spec both builds implemented
docs/dungeon-demo/goal-a.md           the goal prompt that produced Variant A
docs/dungeon-demo/runs/run/           Variant B's verification report + the 6 skeptic harnesses
dungeon-verify.workflow.js            the workflow that built and verified Variant B
RUNBOOK.md                            how the builds were launched + deployment steps
```

## Run it locally

Any static server works (ES modules won't load over `file://`):

```sh
npm run serve                                  # http-server on http://localhost:8000
# or
python3 -m http.server 8000 --directory web
```

Re-check the numbers yourself — each skeptic harness re-runs its 5,000-seed
block against Variant B's real shipped output:

```sh
node docs/dungeon-demo/runs/run/harness/skeptic1.mjs   # …through skeptic6
```

## How each variant was produced

Variant A came from a single headless [Claude Code](https://claude.com/claude-code)
run pointed at [goal-a.md](docs/dungeon-demo/goal-a.md), with a transcript-provable
done condition and a turn cap. Variant B came from
[dungeon-verify.workflow.js](dungeon-verify.workflow.js), which authored the
gated build, fanned out the skeptics, and wrote the verification report —
exact commands in [RUNBOOK.md](RUNBOOK.md). Neither game was written or
touched by hand; the harness and scaffold were built once, before either run.
