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
- Puzzle-specific behavior should enter through `PuzzlePlugin` or puzzle-specific feature modules, not shared solver orchestration.

---

## 4. End-to-End Data Flow

1. Parser converts URL/input into IR (`PuzzleIR`).
2. Optional editor tooling can create or modify initial puzzle IR before solving.
3. The solver store loads the initial IR and resets replay state.
4. Rule engine runs ordered rules and returns one step at a time.
5. Each step stores rule metadata + explicit diffs.
6. Timeline store replays diffs forward/backward.
7. Board, stats, and explanation panels render current state + reasoning history.

This guarantees the same inference chain can be replayed and inspected later.

---

## 5. Plugin Contract

Puzzle families are registered in `src/domain/plugins/registry.ts`.

Each `PuzzlePlugin` owns the puzzle-family boundary:

- `parse(input)` converts supported source input into normalized `PuzzleIR`.
- `encode(puzzle)` exports a puzzle back to a supported URL/string format.
- `getRules()` returns the ordered rule list used by the solver.
- `help` optionally powers the puzzle rules popout.
- `legend` optionally powers board legend examples.
- `getStats(puzzle)` optionally powers compact board-title puzzle stats via `PuzzleStatsInfoButton`.

The current registry includes Slitherlink plus planned Masyu/Nonogram stubs. The
stubs are visible as future puzzle families but do not yet parse, render, edit,
or solve real puzzles.

---

## 6. Benchmark and Dataset Flow

Benchmarks evaluate solver behavior across JSON dataset manifests. They are for
solver quality and rule-usage analysis, not for unit-test correctness.

Data locations:

- `dataset/public/**/*.json` is committed and should stay small/curated.
- `dataset/private/**/*.json` is local-only and ignored by git.
- `benchmark-results/` is generated output and ignored by git.

Run:

- `pnpm benchmark:solve`

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

The Dataset page browses public manifests, renders compact puzzle previews, and
can load a puzzle into either Solver or Editor.

---

## 7. Slitherlink Rule Architecture (Current)

The Slitherlink rules are now modularized under `src/domain/rules/slither/rules/`.

### 7.1 Aggregation entrypoint

- `src/domain/rules/slither/rules.ts`
  - Exports `deterministicSlitherRules` in a fixed order
  - Exports `slitherRules = deterministic + strong-inference`
  - Serves as the single place for execution-order control

### 7.2 Rule modules

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

### 7.3 Branch inference decoupling

Branch-based inference rules should not self-reference the exported
`slitherRules` array. They receive deterministic rules via dependency
injection, for example:

- `createStrongInferenceRule(() => deterministicSlitherRules)`

This prevents circular coupling and keeps branch inference reusable/testable.

---

## 8. Sector Constraint Model (Critical)

Sector state is represented as a bitmask of allowed corner line counts `{0,1,2}`.

- IR source: `src/domain/ir/types.ts`
- Rule diff source: `src/domain/rules/types.ts`
- Sector diffs use `fromMask -> toMask`
- Rule semantics are narrowing by mask intersection, then propagating when masks become strict enough

Do not revert to old single-label sector semantics.

---

## 9. Replay and Determinism Contract

Two files must stay behaviorally aligned:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Both apply the same `RuleDiff` semantics, especially sector mask writes:

- `puzzle.sectors[sectorKey].constraintsMask = diff.toMask`

If these two paths diverge, timeline replay and solver state will drift.

---

## 10. Current Capability Snapshot

Implemented:

- Dedicated solver workspace for import, solving, replay, explanation, live stats, terminal reports, and export
- Dedicated editor workspace for puzzle construction before loading into the solver
- Public Dataset page with filters, compact previews, and load-to-Solver/Editor actions
- Slitherlink puzz.link parse/encode baseline
- Slitherlink Penpa import baseline
- Slitherlink editor tools for clues, pre-drawn line edges, crossed/blank edges, erasing, custom grid sizes, and built-in presets
- Plugin-powered rule help, board legend, and compact board-title puzzle stats
- Slitherlink board stats for numeric clue count and 0/1/2/3 clue distribution
- Ordered rule execution with step metadata
- Step replay (`Next`, `Previous`, `Solve to End`)
- Explanation-oriented deduction trace
- Sector mask inference/propagation pipeline
- Strong-inference fallback for harder states
- Slitherlink completion analysis for solved/stalled terminal reports
- Public/private benchmark manifest workflow
- Compact benchmark reports with solve status, timing, rule usage, and rule step indices
- GitHub Pages release workflow for tagged builds

Partially implemented / planned:

- Masyu and Nonogram plugin stubs only; real parsers, renderers, editors, rules, and completion checks are still planned
- Puzzle-specific editor support for each puzzle family
- Canvas interaction and rendering optimization for larger boards and richer editor states
- Penpa adapter/export completeness
- Better calibrated difficulty modeling

Important expectation: difficult puzzles may stop at a stable but incomplete state if no rule applies.

---

## 11. AI Agent Quick Start

If you are an AI agent onboarding this repository, do this first:

1. Read `src/domain/rules/types.ts` and `src/domain/rules/engine.ts`.
2. Read `src/domain/plugins/types.ts` and `src/domain/plugins/registry.ts`.
3. Read `src/features/solver/solverStore.ts` to verify replay and terminal-report behavior.
4. For Slitherlink work, read `src/domain/rules/slither/rules.ts` and the rule modules by category.
5. For editor/UI work, inspect the relevant `src/features/*` component and page tests first.
6. For benchmark work, read `src/domain/benchmark/runner.ts` and `scripts/benchmark-solve.ts`.
7. Use `src/domain/rules/slither/rules.test.ts`, page tests, and benchmark tests as behavior references.

When editing:

- Keep changes domain-first and minimally scoped.
- Preserve diff/message explainability.
- Preserve ordered deterministic behavior unless intentionally changed.
- Add/adjust tests alongside rule changes.
- Do not commit private datasets or generated benchmark reports.

---

## 12. Development Commands

- `pnpm install` - install dependencies using the locked pnpm dependency graph
- `pnpm dev` - local development
- `pnpm benchmark:solve` - run all public/private benchmark manifests
- `pnpm lint` - linting
- `pnpm test:run` - unit/component tests
- `pnpm build` - production build
- `pnpm test:e2e` - Playwright end-to-end tests

## 13. Deployment and Release Flow

- Package management is standardized on pnpm 10.33.0 via the `packageManager`
  field in `package.json`. GitHub Actions installs that pnpm version before
  enabling `actions/setup-node` pnpm caching.
- CI runs on pushes and pull requests targeting `main`; it installs with
  `pnpm install --frozen-lockfile`, then runs linting, unit tests, and build.
- GitHub Pages deployment is triggered by pushing a `v*` tag. The deployment
  workflow runs the same checks and build, copies `dist/index.html` to
  `dist/404.html` for SPA fallback, then publishes `dist/`.
