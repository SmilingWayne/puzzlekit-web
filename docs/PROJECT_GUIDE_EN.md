# PuzzleKit Web Project Guide

This guide is the compact maintainer and AI-agent reference for PuzzleKit Web. The README explains the project at a public level; this file records the working architecture, repo contracts, and current capability boundaries.

## 1. Project Intent

PuzzleKit Web is a frontend-first, rule-based logic puzzle solver. It values reasoning quality over maximum solve rate.

Core principles:

- Prefer explicit deductions over black-box search.
- Keep every step replayable, inspectable, and explainable.
- Accept stable incomplete states when the current rules cannot continue.
- Grow solver strength through deterministic, human-readable rules plus bounded, explainable assumption rules.

## 2. Architecture Map

```text
src/
  app/              # routes, pages, and top-level layout
  domain/           # puzzle logic source of truth
    benchmark/      # dataset validation and benchmark runner
    difficulty/     # trace statistics and difficulty snapshots
    exporters/      # export adapters
    ir/             # PuzzleIR schemas, key helpers, normalize/clone
    parsers/        # puzz.link-compatible and Penpa+ adapters
    plugins/        # plugin contracts and registry
    rules/          # rule contracts, rule engine, puzzle-specific rules
  features/         # board rendering, solver controls, editor, stats, explanations
  test/             # test setup/runtime helpers
dataset/
  public/           # committed curated manifests
  private/          # local-only manifests, ignored by git
scripts/
  benchmark-solve.ts
docs/
  techniques/       # puzzle-specific technique notes
  legacy/           # old plans and research notes
```

Boundary rule:

- UI renders and orchestrates.
- Domain code owns parsing, IR, rules, replay semantics, completion analysis, and exports.
- Solver and editor are separate product surfaces that exchange normalized `PuzzleIR`.
- Puzzle-family behavior enters through `PuzzlePlugin`, puzzle-specific domain modules, or explicit renderer/editor branches.

## 3. Core Data Flow

1. Parser or editor creates a normalized `PuzzleIR`.
2. Solver store loads the initial IR and resets replay state.
3. The plugin supplies an ordered rule list.
4. The rule engine returns one `RuleApplication` at a time.
5. Each step stores rule metadata, explanation text, highlights, and explicit diffs.
6. Replay applies or reverts diffs, with checkpoints for large timeline jumps.
7. Board, stats, and explanation panels render the active replay state.

This contract is central: solver output must remain deterministic, replay-safe, and explainable.

Bounded inference steps may also store structured branch details: the base
puzzle, initial branch diffs, trial trace, contradiction focus, and formal
conclusion. The shared Branch Inspector replays these details for Slitherlink
and Masyu without changing solver behavior.

## 4. Plugin Contract

Puzzle families are registered in `src/domain/plugins/registry.ts`.

Each `PuzzlePlugin` may provide:

- `parse(input)` for supported URLs or strings.
- `encode(puzzle)` for supported exports.
- `getRules()` for the ordered solver rule list.
- `help` for the puzzle rules popout.
- `legend` for board legend examples.
- `getStats(puzzle)` for compact board-title stats.
- `liveStats` for puzzle-specific inference coverage series shown in the shared Live Stats panel.
- `displayOptions` for puzzle-specific board toggles.

Current families:

- **Slitherlink**: parser, Penpa+ import, renderer, editor, rules, stats, completion analysis, puzz.link export, datasets, and benchmark flow are implemented.
- **Masyu**: puzz.link-compatible import/export, Penpa+ import, renderer, editor, stats, help/legend, replay plumbing, completion analysis, deterministic rules, tile-color topology, and bounded strong inference are implemented. Solver strength is still evolving.
- **Nonogram**: planned plugin stub only.

## 5. IR And Diff Conventions

`PuzzleIR` is the shared state between parser, editor, solver, rules, board rendering, exporters, and datasets.

Important state buckets:

- `cells`: clues and cell-local visual state.
- `edges`: Slitherlink-style vertex-to-vertex grid-edge decisions.
- `lines`: Masyu-style center-to-center line decisions.
- `sectors`: Slitherlink corner-sector constraints.
- `tiles`: vertex-centered coloring units used by Masyu inside/outside reasoning.
- `vertices`: Slitherlink vertex candidate state.

`RuleDiff` is the replay contract. If a rule mutates a new IR bucket, update both:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Forward and reverse replay behavior must stay aligned. Timeline replay must not diverge from direct rule execution.

## 6. Current Capability Snapshot

Implemented:

- Solver workspace for import, step solving, replay, explanations, live stats, terminal reports, and export.
- Editor workspace for Slitherlink and Masyu custom boards, URL import, and load-to-solver flow.
- Dataset page with filters, previews, and load-to-Solver/Editor actions.
- Plugin-powered rules help, board legend, board display toggles, and compact puzzle stats.
- Slitherlink puzz.link-compatible parse/encode, Penpa+ import, deterministic rules, branch-based inference, completion analysis, editor tools, and public dataset example.
- Masyu puzz.link-compatible parse/encode, Penpa+ import, renderer, editor, deterministic rules, completion analysis, tile-color propagation, candidate pruning, bridge reasoning, premature-loop prevention, and inspectable bounded strong inference.
- Public/private benchmark manifest workflow.
- GitHub Pages release workflow for tagged builds.

Partial or planned:

- The public dataset includes a categorized Masyu manifest.
- Penpa+ support is import-oriented; export completeness is not a current guarantee.
- Live Stats uses a shared timeline, step-duration chart, and rule-usage view. Each puzzle plugin declares the meaningful inference coverage series for its own IR primitives.
- Difficulty modeling is draft-level.
- Nonogram remains planned.

## 7. Benchmark And Dataset Flow

Benchmarks evaluate solver behavior across JSON dataset manifests. They are for solver-quality and rule-usage analysis, not unit-test correctness.

Data locations:

- `dataset/public/**/*.json` is committed and should stay small and curated.
- `dataset/private/**/*.json` is local-only and ignored by git.
- `benchmark-results/` is generated output and ignored by git.

Run:

```bash
pnpm benchmark:solve
```

The benchmark runner scans public/private manifests, runs each puzzle with the default plugin rule order, and writes reports to `benchmark-results/<dataset-id>.report.json`.

Default benchmark settings:

- `maxSteps = 2000`
- `timeoutMs = 60000`
- `ruleProfile = "default"`

Reports include per-puzzle status, step count, duration, terminal completion report, `ruleUsage`, and compact `ruleSteps`. Full `steps` are intentionally omitted to keep reports small.

## 8. AI Agent Quick Start

Read in this order for broad context:

1. `src/domain/ir/types.ts`
2. `src/domain/rules/types.ts`
3. `src/domain/rules/engine.ts`
4. `src/domain/plugins/types.ts`
5. `src/domain/plugins/registry.ts`
6. `src/features/solver/solverStore.ts`
7. The relevant note in `docs/techniques/`

For targeted work:

- Slitherlink rules: start at `src/domain/rules/slither/rules.ts`.
- Masyu rules: start at `docs/MASYU_AGENT_BRIEF.md`, then inspect `src/domain/rules/masyu/rules.ts`.
- Editor/UI work: inspect the relevant `src/features/*` component plus page tests.
- Benchmark work: read `src/domain/benchmark/runner.ts` and `scripts/benchmark-solve.ts`.
- Historical Masyu plans: check `docs/legacy/` only when old design context is useful.

When editing:

- Keep changes domain-first and minimally scoped.
- Preserve deterministic replay semantics.
- Preserve explicit diffs and explainable rule messages.
- Add or adjust tests beside parser, IR, replay, or rule changes.
- Do not commit private datasets or generated benchmark reports.

## 9. Commands And Release Flow

Use Node.js 20 from `.nvmrc` and pnpm 10.33.0 from `package.json`.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test:run
pnpm build
pnpm benchmark:solve
pnpm test:e2e
```

CI runs linting, unit tests, and build on pushes and pull requests targeting `main`.

GitHub Pages deployment is triggered by pushing a `v*` tag. The deployment workflow builds `dist/`, copies `dist/index.html` to `dist/404.html` for SPA fallback, then publishes `dist/`.
