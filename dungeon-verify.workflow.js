export const meta = {
  name: 'dungeon-verify',
  description: 'Build Variant B of the A/B dungeon demo (the "workflow" build) and PROVE it never ships an unsolvable level: author the gated generator, then fan out N independent adversarial skeptics that each try to refute the gate with their OWN solver, confirm survivors through an independent gate, bounded-repair on any confirmed counterexample, and emit a verification report.',
  phases: [
    { title: 'Author',      detail: 'build dungeon.js (gated generator + shared render) per the shared spec' },
    { title: 'Adversarial', detail: 'N skeptics headlessly sample disjoint seed blocks, each with its own reachability judge' },
    { title: 'Repair',      detail: 'bounded fix of the gate on any confirmed shipped-unsolvable level' },
    { title: 'Finalize',    detail: 'write the verification report (skeptics x seeds x confirmed refutations)' },
  ],
}

// ---- config / args ----
const cfg = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const RUN_LABEL = cfg.runLabel || 'run'
const RUN_DIR   = cfg.runDir   || `docs/dungeon-demo/runs/${RUN_LABEL}`
const SPEC      = cfg.spec     || 'docs/dungeon-demo/spec.md'
const MODULE    = cfg.module   || 'web/dungeon-b/dungeon.js'   // importable: exports shippedLevel(seed)
const INDEX     = cfg.index    || 'web/dungeon-b/index.html'   // browser page importing dungeon.js
const REPORT    = `${RUN_DIR}/verification.md`

const SKEPTICS          = Number.isInteger(cfg.skeptics) ? cfg.skeptics : 6
const SEEDS_PER_SKEPTIC = Number.isInteger(cfg.seedsPerSkeptic) ? cfg.seedsPerSkeptic : 5000
const MAX_REPAIRS       = Number.isInteger(cfg.maxRepairs) ? cfg.maxRepairs : 2
const BLOCK             = SEEDS_PER_SKEPTIC   // skeptic k owns seeds [(k-1)*BLOCK, k*BLOCK)

const range = n => Array.from({ length: n }, (_, i) => i)

// ---- schemas ----
const AUTHOR_SCHEMA = {
  type: 'object',
  required: ['status', 'files_touched', 'module_entry', 'gate_summary', 'issues'],
  properties: {
    status: { type: 'string', enum: ['authored', 'blocked'] },
    files_touched: { type: 'array', items: { type: 'string' } },
    module_entry: { type: 'string', description: 'exact node import + the shipped-level fn signature to call with a seed (e.g. `import { shippedLevel } from "./dungeon.js"` -> shippedLevel(seed) => level)' },
    gate_summary: { type: 'string', description: 'one paragraph: how the solvability gate works and why the RAW generator can still emit unsolvable candidates (so the test stays meaningful)' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: true,
}

const SKEPTIC_SCHEMA = {
  type: 'object',
  required: ['skeptic_index', 'seeds_sampled', 'seed_range', 'refutations', 'all_shipped_solvable', 'harness_path'],
  properties: {
    skeptic_index: { type: 'integer' },
    seeds_sampled: { type: 'integer' },
    seed_range: { type: 'array', items: { type: 'integer' }, description: '[loInclusive, hiExclusive]' },
    refutations: {
      type: 'array',
      description: 'shipped levels YOUR judge found unsolvable; first ~10, each reproducible by seed',
      items: {
        type: 'object',
        required: ['seed', 'reason'],
        properties: { seed: { type: 'integer' }, reason: { type: 'string' } },
        additionalProperties: true,
      },
    },
    all_shipped_solvable: { type: 'boolean' },
    harness_path: { type: 'string', description: 'the throwaway node harness you wrote, for audit' },
    notes: { type: 'string' },
  },
  additionalProperties: true,
}

const CONFIRM_SCHEMA = {
  type: 'object',
  required: ['confirmed', 'dismissed', 'scanned'],
  properties: {
    confirmed: { type: 'array', items: { type: 'object', required: ['seed', 'reason'], properties: { seed: { type: 'integer' }, reason: { type: 'string' } }, additionalProperties: true } },
    dismissed: { type: 'array', items: { type: 'object', required: ['seed', 'why'], properties: { seed: { type: 'integer' }, why: { type: 'string' } }, additionalProperties: true } },
    scanned: { type: 'string', description: 'how many reported seeds re-run, with counts' },
  },
  additionalProperties: true,
}

const FINALIZE_SCHEMA = {
  type: 'object',
  required: ['skeptics', 'seeds_total', 'confirmed_refutations', 'verdict', 'report_path'],
  properties: {
    skeptics: { type: 'integer' },
    seeds_total: { type: 'integer' },
    confirmed_refutations: { type: 'integer' },
    verdict: { type: 'string' },
    report_path: { type: 'string' },
  },
  additionalProperties: true,
}

// ---- prompt builders ----
function authorPrompt() {
  return [
    `You are the BUILD agent for VARIANT B (the verified "workflow" build) of the dungeon A/B demo.`,
    ``,
    `READ FIRST: the shared spec ${SPEC} — implement Sections 2-4 and 6 EXACTLY as written (they are shared with Variant A and must not diverge), plus the Variant B acceptance policy in Section 5.`,
    ``,
    `STRUCTURE (so the shipped code path is headlessly verifiable):`,
    `- Put the generator + the canonical solver in ${MODULE} as an ES module. Export shippedLevel(seed) => the level object ACTUALLY shown to the player, i.e. AFTER the Variant B gate has run. Same {grid,start,exit,key,door,seed} shape as spec §6.`,
    `- ${INDEX} imports ${MODULE} and renders the game + wires window.__demo per spec §6.`,
    ``,
    `VARIANT B GATE (spec §5): after the RAW generator produces a candidate, run the solver; if unsolvable, regenerate/repair and re-check; only ever return a solver-confirmed-solvable level from shippedLevel().`,
    `DO NOT weaken the raw generator: it must still be CAPABLE of emitting unsolvable candidates (spec §3, ~25-35%). The gate is what filters them — if you make the raw generator never fail, the verification below is meaningless. The point is a fallible generator + a trustworthy gate.`,
    ``,
    `Return: status ("authored" iff both files exist and shippedLevel(seed) runs under node); files_touched; module_entry (the exact import line + call signature); gate_summary; issues[].`,
  ].join('\n')
}

function skepticPrompt(k, attempt) {
  const lo = (k - 1) * BLOCK
  const hi = k * BLOCK
  return [
    `You are ADVERSARIAL SKEPTIC #${k} of ${SKEPTICS} (verification pass ${attempt + 1}). Your ONLY goal is to REFUTE the claim: "Variant B never ships an unsolvable dungeon."`,
    ``,
    `INDEPENDENCE IS THE WHOLE POINT: do NOT import, read, or reuse the game's own solver. Write your OWN reachability judge from scratch in a throwaway node harness — a plain BFS honoring the key/door rule (spec §4: reach K first if a K/D pair exists, then reach E with D passable). If your judge and the game's gate disagree, that disagreement is the bug you are hunting.`,
    ``,
    `PROCEDURE:`,
    `1. Read spec §4 for the solvability definition (the rule, not the game's code).`,
    `2. In a harness under ${RUN_DIR}/harness/, import ${MODULE} and call shippedLevel(seed) for EVERY seed in [${lo}, ${hi}) (${BLOCK} seeds — your disjoint block; other skeptics cover other blocks).`,
    `3. Run YOUR judge on each returned (shipped) level. Any shipped level your judge rules unsolvable is a counterexample — the gate leaked.`,
    ``,
    `Return: skeptic_index=${k}; seeds_sampled; seed_range=[${lo}, ${hi}]; refutations (first ~10, each {seed, reason} so it's reproducible); all_shipped_solvable; harness_path; notes.`,
  ].join('\n')
}

function confirmPrompt(reported) {
  const seeds = reported.map(r => r.seed)
  return [
    `You are the INDEPENDENT CONFIRM GATE. Skeptics reported these candidate counterexample seeds against Variant B: ${JSON.stringify(seeds)}.`,
    `Guard against skeptic false-positives: for EACH reported seed, import ${MODULE}, call shippedLevel(seed), and run a fresh canonical solver (spec §4). CONFIRM only seeds whose shipped level is truly unsolvable; DISMISS any your check finds solvable.`,
    `Return: confirmed [{seed, reason}]; dismissed [{seed, why}]; scanned (e.g. "re-ran 7 reported seeds: 5 confirmed, 2 dismissed").`,
  ].join('\n')
}

function repairPrompt(confirmed, attempt) {
  return [
    `You are the REPAIR agent — attempt ${attempt} of ${MAX_REPAIRS}. Variant B's gate SHIPPED unsolvable levels for these CONFIRMED seeds:`,
    `"""${JSON.stringify(confirmed, null, 2)}"""`,
    `Fix ONLY the gate in ${MODULE} so these seeds — and their whole class of failure — can never be returned by shippedLevel(). Do NOT disable the raw generator's fallibility; only strengthen the gate (spec §5).`,
    `Re-run shippedLevel() on the confirmed seeds and confirm each is now solvable by your own check.`,
    `Return the author-schema object (status="authored" iff the confirmed seeds now pass, else "blocked" with detail in issues).`,
  ].join('\n')
}

// ---- preflight ----
if (SKEPTICS < 1 || SEEDS_PER_SKEPTIC < 1) {
  log(`ERROR: bad fan-out config skeptics=${SKEPTICS} seedsPerSkeptic=${SEEDS_PER_SKEPTIC}`)
  return { error: 'bad config', skeptics: SKEPTICS, seedsPerSkeptic: SEEDS_PER_SKEPTIC }
}
log(`dungeon-verify: run="${RUN_LABEL}" | ${SKEPTICS} skeptics x ${SEEDS_PER_SKEPTIC} seeds = ${SKEPTICS * SEEDS_PER_SKEPTIC} | maxRepairs=${MAX_REPAIRS} -> ${RUN_DIR}`)

// ---- author ----
phase('Author')
const built = await agent(authorPrompt(), { label: 'author-b', phase: 'Author', schema: AUTHOR_SCHEMA })
if (!built || built.status !== 'authored') {
  log(`author-b did not complete (status=${built ? built.status : 'null'}) — cannot verify; finalizing as blocked`)
}

// ---- adversarial fan-out + bounded repair ----
let attempt = 0
let confirmed = []
let seedsTotal = 0
let verified = false

if (built && built.status === 'authored') {
  while (true) {
    // fan out N independent skeptics in parallel over disjoint seed blocks.
    // (Promise.all over agent() keeps per-call caching so a transient failure resumes only that skeptic.
    //  swap for your framework's parallel() if you want its concurrency/logging wrapper.)
    phase('Adversarial')
    const skeptics = (await Promise.all(
      range(SKEPTICS).map(k => agent(skepticPrompt(k + 1, attempt), { label: `skeptic-${attempt}-${k + 1}`, phase: 'Adversarial', schema: SKEPTIC_SCHEMA }))
    )).filter(Boolean)

    seedsTotal = skeptics.reduce((a, s) => a + (s.seeds_sampled || 0), 0)
    const reported = skeptics.reduce((acc, s) => acc.concat((s.refutations || []).map(r => ({ seed: r.seed, reason: r.reason, skeptic: s.skeptic_index }))), [])
    log(`pass ${attempt + 1}: ${skeptics.length}/${SKEPTICS} skeptics reported, ${seedsTotal} seeds sampled, ${reported.length} raw refutation(s)`)

    if (!reported.length) { verified = true; break }

    // independent gate re-checks the reported seeds before we trust them (spine-build pattern).
    const gate = await agent(confirmPrompt(reported), { label: `confirm-${attempt}`, phase: 'Adversarial', schema: CONFIRM_SCHEMA, effort: 'low' })
    confirmed = (gate && gate.confirmed) || []
    log(`pass ${attempt + 1}: ${confirmed.length} confirmed counterexample(s) (${reported.length - confirmed.length} dismissed as false-positive)`)

    if (!confirmed.length) { verified = true; break }              // all reports were skeptic false-positives
    if (attempt >= MAX_REPAIRS) { verified = false; break }         // out of repairs -> ships unverified

    attempt++
    phase('Repair')
    const rep = await agent(repairPrompt(confirmed, attempt), { label: `repair-${attempt}`, phase: 'Repair', schema: AUTHOR_SCHEMA })
    if (!rep || rep.status !== 'authored') { verified = false; break }
    // loop: re-run the full skeptic fleet against the repaired gate
  }
}

// ---- finalize (always) ----
phase('Finalize')
const finalize = await agent([
  `You are FINALIZE for the dungeon-verify run "${RUN_LABEL}".`,
  built && built.status === 'authored'
    ? `Variant B was built (${MODULE} + ${INDEX}). Adversarial verification ran ${attempt + 1} pass(es): ${SKEPTICS} independent skeptics, ${seedsTotal} shipped levels sampled across disjoint seed blocks, each skeptic using its OWN reachability judge. Confirmed shipped-unsolvable levels remaining: ${confirmed.length}. Verified=${verified}.`
    : `Variant B FAILED to build (author status=${built ? built.status : 'null'}); no verification was possible.`,
  `Write ${REPORT} (overwrite): the headline claim + result, the method (fallible generator + gate, adversarial skeptics with independent judges, independent confirm gate, bounded repair), the exact numbers (skeptics x seeds, confirmed refutations, repair passes), and — if any — the confirmed counterexample seeds so they stay reproducible. Keep it talk-ready: one clean paragraph a non-Minecraft audience understands, then the numbers.`,
  `Return: { skeptics, seeds_total, confirmed_refutations, verdict, report_path }.`,
].join('\n'), { label: 'finalize', phase: 'Finalize', schema: FINALIZE_SCHEMA })

log(`dungeon-verify finished: verified=${verified} | ${SKEPTICS} skeptics x ${SEEDS_PER_SKEPTIC} seeds | repairs=${attempt} | confirmed=${confirmed.length}`)

return {
  runLabel: RUN_LABEL,
  runDir: RUN_DIR,
  built: built ? built.status : 'null',
  fanout: { skeptics: SKEPTICS, seedsPerSkeptic: SEEDS_PER_SKEPTIC, seedsTotal },
  repairs: attempt,
  confirmedRefutations: confirmed.length,
  verified,
  finalize,
}
