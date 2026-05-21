# PuzzleKit Web Project Guide

## 1. Project Intent

PuzzleKit Web is a frontend-first, rule-based logic puzzle solver focused on
machine reasoning quality rather than maximum solve rate.

Core principles:

- Prefer explicit deduction over black-box search or SAT solving.
- Make every step replayable, inspectable, and explainable.
- Accept that some puzzles may stop at a stable incomplete state.
- Grow solver strength incrementally by adding deterministic, human-readable
  inference rules.

In short: this project is a logic reasoning engine with a UI, not a UI-first
puzzle editor.

## 2. Architecture Map

```text
src/
  app/              # page composition and top-level routing/layout
  domain/           # puzzle logic source of truth
    benchmark/      # dataset validation and solver benchmark runner
    difficulty/     # trace statistics and difficulty snapshots
    exporters/      # export adapters
    ir/             # puzzle IR schemas, key utilities, normalize/clone
    parsers/        # puzz.link/penpa adapters
    plugins/        # plugin contracts and registry
    rules/          # rule contracts, step engine, puzzle-specific rules
  features/         # board rendering, solver controls, editor, stats, explanation
  test/             # test setup/runtime helpers
dataset/
  public/           # committed benchmark/dataset manifests
  private/          # local-only manifests, ignored by git
scripts/
  benchmark-solve.ts
docs/
  techniques/       # puzzle-specific solving technique notes
```

Boundary rule:

- UI renders and orchestrates.
- Domain code owns parsing, IR, rules, replay semantics, and exports.
- Solver and editor are separate product surfaces that exchange normalized
  `PuzzleIR`.
- Puzzle-family behavior enters through `PuzzlePlugin`, puzzle-specific domain
  modules, or explicit renderer branches.

## 3. Data Flow

1. Parser converts URL/input into `PuzzleIR`.
2. Optional editor tooling creates or modifies initial IR.
3. Solver store loads the initial IR and resets replay state.
4. Rule engine runs ordered rules and returns one step at a time.
5. Each step stores rule metadata plus explicit diffs.
6. Replay applies or reverts diffs, with checkpoints for large timeline jumps.
7. Board, stats, and explanation panels render the active replay state.

This contract is the heart of the app: solver output must remain deterministic,
replay-safe, and explainable.

## 4. Plugin Contract

Puzzle families are registered in `src/domain/plugins/registry.ts`.

Each `PuzzlePlugin` owns its family boundary:

- `parse(input)` converts supported input into normalized `PuzzleIR`.
- `encode(puzzle)` exports a puzzle to a supported URL/string format.
- `getRules()` returns the ordered rule list used by the solver.
- `help` powers the puzzle rules popout.
- `legend` powers board legend examples.
- `getStats(puzzle)` powers compact board-title puzzle stats.

Current families:

- Slitherlink: parser, renderer, editor, rules, stats, completion analysis, and
  export support are implemented.
- Masyu: puzz.link import, IR, renderer, stats, help, replay plumbing,
  completion analysis, deterministic solving rules, bounded strong inference,
  and tile-color topology support are implemented. Editor, dataset flow, and
  URL export remain future work.
- Nonogram: visible as a planned plugin stub.

## 5. IR And Diff Conventions

`PuzzleIR` is the shared normalized state between parser, rules, replay, board,
editor, and exporters.

Important state buckets:

- `cells`: cell clues and cell-local visual state.
- `edges`: Slitherlink-style vertex-to-vertex grid-edge decisions.
- `lines`: Masyu-style cell-center-to-cell-center line decisions.
- `sectors`: Slitherlink corner-sector constraints.
- `tiles`: vertex-centered coloring units currently used by Masyu
  inside/outside reasoning.
- `vertices`: vertex candidate state for Slitherlink inference.

`RuleDiff` is the replay contract. If a rule mutates a new IR bucket, add a diff
type and update both:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Keep forward and reverse replay behavior aligned. Timeline replay must not
diverge from direct rule execution.

## 6. Puzzle Techniques

Do not put puzzle-specific solving techniques in this project guide. Use the
technique notes instead:

- `docs/techniques/masyu.md`
- `docs/techniques/slitherlink.md`

For implementation-oriented Masyu rule work, start with
`docs/MASYU_AGENT_BRIEF.md` and then `docs/MASYU_RULE_ROADMAP.md`.


## 7. Benchmark And Dataset Flow

Benchmarks evaluate solver behavior across JSON dataset manifests. They are for
solver quality and rule-usage analysis, not for unit-test correctness.

Data locations:

- `dataset/public/**/*.json` is committed and should stay small and curated.
- `dataset/private/**/*.json` is local-only and ignored by git.
- `benchmark-results/` is generated output and ignored by git.

Run:

```bash
pnpm benchmark:solve
```

The benchmark runner scans public/private manifests, runs each puzzle with the
default plugin rule order, and writes reports to
`benchmark-results/<dataset-id>.report.json`.

Current defaults:

- `maxSteps = 2000`
- `timeoutMs = 60000`
- `ruleProfile = "default"`

Report intent:

- Per puzzle: status, step count, duration, terminal completion report,
  `ruleUsage`, and compact `ruleSteps`.
- `steps` is intentionally empty for now to keep reports small.
- `ruleSteps[ruleId] = [stepNumbers...]` records where each rule fired.

## 8. Current Capability Snapshot

Implemented:

- Solver workspace for import, solving, replay, explanation, live stats,
  terminal reports, and export.
- Editor workspace for constructing Slitherlink puzzles before loading into the
  solver.
- Public Dataset page with filters, previews, and load-to-Solver/Editor actions.
- Plugin-powered rule help, board legend, and compact board-title stats.
- Slitherlink puzz.link parse/encode and Penpa import.
- Slitherlink editor tools for clues, line edges, crosses, erasing, custom sizes,
  and built-in presets.
- Slitherlink deterministic and branch-based inference pipeline.
- Slitherlink completion analysis.
- Masyu puzz.link import for `masyu`, `mashu`, and `pearl`.
- Masyu IR support through `lines`, `tiles`, and pearl clues.
- Masyu solver-board rendering for dashed grids, pearls, center lines, and
  crosses.
- Masyu deterministic solving rules, completion analysis, tile-color
  propagation, candidate bridge reasoning, black-pearl pruning, and bounded
  strong inference.
- Replay support for edge, line, and tile diffs.
- Live Stats trace cache for step-prefix summaries, chart progress, and rule
  usage.
- Public/private benchmark manifest workflow.
- GitHub Pages release workflow for tagged builds.

Planned or partial:

- Masyu editor, dataset flow, and URL export.
- Nonogram parser, renderer, editor, and rules.
- Puzzle-specific Live Stats wording beyond the current shared labels.
- Penpa adapter/export completeness.
- Better calibrated difficulty modeling.

## 9. AI Agent Quick Start

If you are an AI agent onboarding this repository, read in this order:

1. `src/domain/rules/types.ts`
2. `src/domain/rules/engine.ts`
3. `src/domain/ir/types.ts`
4. `src/domain/plugins/types.ts`
5. `src/domain/plugins/registry.ts`
6. `src/features/solver/solverStore.ts`
7. The relevant puzzle note in `docs/techniques/` for user-facing rules/help

For targeted work:

- Slitherlink rules: start at `src/domain/rules/slither/rules.ts`.
- Masyu rules: start at `docs/MASYU_AGENT_BRIEF.md`, then read
  `docs/MASYU_RULE_ROADMAP.md` for refactor direction.
- Editor/UI work: inspect the relevant `src/features/*` component and page test.
- Benchmark work: read `src/domain/benchmark/runner.ts` and
  `scripts/benchmark-solve.ts`.

When editing:

- Keep changes domain-first and minimally scoped.
- Preserve deterministic replay semantics.
- Preserve explainable rule messages and explicit diffs.
- Add or adjust tests alongside parser, IR, replay, or rule changes.
- Do not commit private datasets or generated benchmark reports.

## 10. Development Commands

Use a modern Node runtime. Local Node `v24.13.1` is suitable for current
development. Older Node versions may fail before project scripts start because
the configured pnpm version requires a newer runtime.

Commands:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test:run
pnpm build
pnpm benchmark:solve
pnpm test:e2e
```

## 11. Deployment And Release Flow

- Package management is standardized on pnpm 10.33.0 via `packageManager` in
  `package.json`.
- CI runs on pushes and pull requests targeting `main`.
- CI installs with `pnpm install --frozen-lockfile`, then runs linting, unit
  tests, and build.
- GitHub Pages deployment is triggered by pushing a `v*` tag.
- The deployment workflow builds `dist/`, copies `dist/index.html` to
  `dist/404.html` for SPA fallback, then publishes `dist/`.
