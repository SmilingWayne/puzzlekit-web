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
    ir/             # puzzle IR schemas, key utilities, normalize/clone
    parsers/        # puzz.link/penpa adapters
    rules/          # rule contracts, step engine, puzzle-specific rule sets
    plugins/        # plugin contracts and registry
    exporters/      # export adapters
    difficulty/     # difficulty snapshot and rule usage aggregation
  features/         # board, controls, replay, explanation, stats
  test/             # test setup/runtime helpers
```

Design rule:

- UI should render and orchestrate.
- Domain should decide logic.

---

## 4. End-to-End Data Flow

1. Parser converts URL/input into IR (`PuzzleIR`).
2. Rule engine runs ordered rules and returns one step at a time.
3. Each step stores rule metadata + explicit diffs.
4. Timeline store replays diffs forward/backward.
5. Board and explanation panel render current state + reasoning history.

This guarantees the same inference chain can be replayed and inspected later.

---

## 5. Slitherlink Rule Architecture (Current)

The Slitherlink rules are now modularized under `src/domain/rules/slither/rules/`.

### 5.1 Aggregation entrypoint

- `src/domain/rules/slither/rules.ts`
  - Exports `deterministicSlitherRules` in a fixed order
  - Exports `slitherRules = deterministic + strong-inference`
  - Serves as the single place for execution-order control

### 5.2 Rule modules

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
- `strongInference.ts`
  - conservative branch-based contradiction inference
- `shared.ts`
  - reusable helpers (geometry adjacency, clue/color utilities, mask helpers)

### 5.3 Strong inference decoupling

`strongInference` no longer self-references the exported `slitherRules` array.
Instead, it receives deterministic rules via dependency injection:

- `createStrongInferenceRule(() => deterministicSlitherRules)`

This prevents circular coupling and keeps strong-inference reusable/testable.

---

## 6. Sector Constraint Model (Critical)

Sector state is represented as a bitmask of allowed corner line counts `{0,1,2}`.

- IR source: `src/domain/ir/types.ts`
- Rule diff source: `src/domain/rules/types.ts`
- Sector diffs use `fromMask -> toMask`
- Rule semantics are narrowing by mask intersection, then propagating when masks become strict enough

Do not revert to old single-label sector semantics.

---

## 7. Replay and Determinism Contract

Two files must stay behaviorally aligned:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Both apply the same `RuleDiff` semantics, especially sector mask writes:

- `puzzle.sectors[sectorKey].constraintsMask = diff.toMask`

If these two paths diverge, timeline replay and solver state will drift.

---

## 8. Current Capability Snapshot

Implemented:

- Slitherlink puzz.link parse/encode baseline (URL input currently targets puzz.link; penpa-style URL support is planned)
- Ordered rule execution with step metadata
- Step replay (`Next`, `Previous`, `Solve to End`)
- Explanation-oriented deduction trace
- Sector mask inference/propagation pipeline
- Strong-inference fallback for harder states

Partially implemented / planned:

- Penpa adapter completeness
- More puzzle families (e.g. Masyu/Nonogram)
- Richer puzzle-specific interaction tools
- Better calibrated difficulty modeling

Important expectation: difficult puzzles may stop at a stable but incomplete state if no rule applies.

---

## 9. AI Agent Quick Start

If you are an AI agent onboarding this repository, do this first:

1. Read `src/domain/rules/types.ts` and `src/domain/rules/engine.ts`.
2. Read `src/domain/rules/slither/rules.ts` to understand execution order.
3. Read `src/domain/rules/slither/rules/*.ts` by module category.
4. Verify replay contract in `src/features/solver/solverStore.ts`.
5. Use `src/domain/rules/slither/rules.test.ts` as behavior reference.

When editing:

- Keep changes domain-first and minimally scoped.
- Preserve diff/message explainability.
- Preserve ordered deterministic behavior unless intentionally changed.
- Add/adjust tests alongside rule changes.

---

## 10. Development Commands

- `npm run dev` - local development
- `npm run lint` - linting
- `npm run test:run` - unit/component tests
- `npm run build` - production build
- `npm run test:e2e` - Playwright end-to-end tests

