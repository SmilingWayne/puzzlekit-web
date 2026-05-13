# PuzzleKit Web Project Guide (English)

## 1. Project Intent (Read This First)

PuzzleKit Web is a frontend-first, rule-based logic puzzle solver focused on **machine reasoning quality**, not maximum solve rate.

Core intent:

- Emphasize explicit computer deduction over black-box search/SAT solving
- Produce step-by-step, replayable, explainable reasoning
- Accept that some puzzles may remain unsolved by current rule coverage
- Prioritize solver traceability and reasoning playback over rich interactive tooling

In short: this project is a **logic reasoning engine with a UI**, not a UI-first puzzle editor.

---

## 2. Product Philosophy and Non-Goals

### 2.1 Philosophy

- Every step should be understandable: what changed, why it changed, and which rule produced it
- The system should be deterministic and replay-safe
- Rule growth should happen incrementally by adding human-readable inference rules

### 2.2 Explicit Non-Goals

- No guarantee to solve every valid puzzle instance
- No requirement to optimize for shortest solution path
- No requirement to prioritize advanced user interaction over deduction transparency

---

## 3. High-Level Architecture

```text
src/
  app/              # page composition and top-level routing/layout
  domain/           # puzzle logic source of truth
    benchmark/      # dataset manifest validation and solver benchmark runner
    ir/             # puzzle IR schemas, key utilities, normalize/clone
    parsers/        # puzz.link/penpa adapters
    rules/          # rule contracts, step engine, puzzle-specific rule sets
    plugins/        # plugin contracts and registry
    exporters/      # export adapters
    difficulty/     # difficulty snapshot and rule usage aggregation
  features/         # solver controls, board rendering, editor tools, explanation, stats
  test/             # test setup/runtime helpers
dataset/
  public/           # committed benchmark/dataset manifests
  private/          # local-only manifests, ignored by git
scripts/
  benchmark-solve.ts # project-owned benchmark entrypoint
```

Design rule:

- UI should render and orchestrate.
- Domain should decide logic.
- The solver workspace and puzzle editor are separate product surfaces that exchange normalized `PuzzleIR`.

---

## 4. End-to-End Data Flow

1. Parser converts URL/input into IR (`PuzzleIR`).
2. Optional editor tooling can create or modify initial puzzle IR before solving.
3. The solver store loads the initial IR and resets replay state.
4. Rule engine runs ordered rules and returns one step at a time.
5. Each step stores rule metadata + explicit diffs.
6. Timeline store replays diffs forward/backward.
7. Board and explanation panel render current state + reasoning history.

This guarantees the same inference chain can be replayed and inspected later.

---

## 5. Benchmark and Dataset Flow

Benchmarks evaluate solver behavior across JSON dataset manifests. They are for
solver quality and rule-usage analysis, not for unit-test correctness.

Data locations:

- `dataset/public/**/*.json` is committed and should stay small/curated.
- `dataset/private/**/*.json` is local-only and ignored by git.
- `benchmark-results/` is generated output and ignored by git.

Run:

- `npm run benchmark:solve`

This command scans public/private manifests, runs each puzzle with the default
plugin rule order, and writes one report per manifest to
`benchmark-results/<dataset-id>.report.json`.

Current defaults:

- `maxSteps = 2000`
- `timeoutMs = 60000`
- `ruleProfile = "default"`

Report intent:

- Per puzzle: status, step count, duration, terminal completion report,
  `ruleUsage`, and compact `ruleSteps`.
- `steps` is intentionally an empty array for now to keep large reports small.
- `ruleSteps[ruleId] = [stepNumbers...]` records where each rule fired.

---

## 6. Slitherlink Rule Architecture (Current)

The Slitherlink rules are now modularized under `src/domain/rules/slither/rules/`.

### 6.1 Aggregation entrypoint

- `src/domain/rules/slither/rules.ts`
  - Exports `deterministicSlitherRules` in a fixed order
  - Exports `slitherRules = deterministic + strong-inference`
  - Serves as the single place for execution-order control

### 6.2 Rule modules

- `patterns.ts`
  - pattern-style clue rules (e.g. contiguous 3-run, diagonal adjacent 3)
- `core.ts`
  - generic Slither constraints (cell count, vertex degree, premature loop prevention)
- `color.ts`
  - cell color seeding and propagation rules
- `sectorInference.ts`
  - corner-sector inference from local edge/vertex/cell evidence
- `sectorPropagation.ts`
  - sector-to-sector and sector-to-edge propagation family
- `colorAssumptionInference.ts`
  - conservative color-branch contradiction inference
- `sectorParityInference.ts`
  - conservative sector-parity contradiction inference
- `strongInference.ts`
  - conservative branch-based contradiction inference
- `shared.ts`
  - reusable helpers (geometry adjacency, clue/color utilities, mask helpers)

### 6.3 Branch inference decoupling

Branch-based inference rules should not self-reference the exported
`slitherRules` array. They receive deterministic rules via dependency
injection, for example:

- `createStrongInferenceRule(() => deterministicSlitherRules)`

This prevents circular coupling and keeps branch inference reusable/testable.

---

## 7. Sector Constraint Model (Critical)

Sector state is represented as a bitmask of allowed corner line counts `{0,1,2}`.

- IR source: `src/domain/ir/types.ts`
- Rule diff source: `src/domain/rules/types.ts`
- Sector diffs use `fromMask -> toMask`
- Rule semantics are narrowing by mask intersection, then propagating when masks become strict enough

Do not revert to old single-label sector semantics.

---

## 8. Replay and Determinism Contract

Two files must stay behaviorally aligned:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Both apply the same `RuleDiff` semantics, especially sector mask writes:

- `puzzle.sectors[sectorKey].constraintsMask = diff.toMask`

If these two paths diverge, timeline replay and solver state will drift.

---

## 9. Current Capability Snapshot

Implemented:

- Dedicated solver workspace for import, solving, replay, explanation, stats, and export
- Dedicated editor workspace for puzzle construction before loading into the solver
- Slitherlink puzz.link parse/encode baseline
- Slitherlink Penpa import baseline
- Slitherlink editor tools for clues, pre-drawn line edges, crossed/blank edges, erasing, custom grid sizes, and built-in presets
- Ordered rule execution with step metadata
- Step replay (`Next`, `Previous`, `Solve to End`)
- Explanation-oriented deduction trace
- Sector mask inference/propagation pipeline
- Strong-inference fallback for harder states
- Public/private benchmark manifest workflow
- Compact benchmark reports with solve status, timing, rule usage, and rule step indices

Partially implemented / planned:

- More puzzle families (e.g. Masyu/Nonogram)
- Puzzle-specific editor support for each puzzle family
- Dataset browsing as a product surface
- Canvas interaction and rendering optimization for larger boards and richer editor states
- Penpa adapter/export completeness
- Better calibrated difficulty modeling

Important expectation: difficult puzzles may stop at a stable but incomplete state if no rule applies.

---

## 10. AI Agent Quick Start

If you are an AI agent onboarding this repository, do this first:

1. Read `src/domain/rules/types.ts` and `src/domain/rules/engine.ts`.
2. Read `src/domain/rules/slither/rules.ts` to understand execution order.
3. Read `src/domain/rules/slither/rules/*.ts` by module category.
4. Verify replay contract in `src/features/solver/solverStore.ts`.
5. For benchmark work, read `src/domain/benchmark/runner.ts` and `scripts/benchmark-solve.ts`.
6. Use `src/domain/rules/slither/rules.test.ts` and `src/domain/benchmark/*.test.ts` as behavior references.

When editing:

- Keep changes domain-first and minimally scoped.
- Preserve diff/message explainability.
- Preserve ordered deterministic behavior unless intentionally changed.
- Add/adjust tests alongside rule changes.
- Do not commit private datasets or generated benchmark reports.

---

## 11. Development Commands

- `npm run dev` - local development
- `npm run benchmark:solve` - run all public/private benchmark manifests
- `npm run lint` - linting
- `npm run test:run` - unit/component tests
- `npm run build` - production build
- `npm run test:e2e` - Playwright end-to-end tests
