# Masyu Agent Brief

This is the low-token starting point for AI agents working on Masyu in PuzzleKit Web. Read this first, then inspect the exact source files for the task.

## Current State

Masyu is a first-class puzzle family with:

- puzz.link-compatible import/export for `masyu`, `mashu`, and `pearl` URLs.
- Penpa+ import.
- Solver rendering, replay, explanations, stats, legend/help content, and completion analysis.
- Editor support for blank custom grids, URL import, black/white pearl placement, and load-to-solver flow.
- Deterministic rules plus bounded strong-inference rules with branch replay and contradiction focus.
- Tile-color topology support for inside/outside reasoning.

A categorized Masyu manifest is committed to `dataset/public`; use private manifests for additional local experiments.

## Canonical Model

- `PuzzleIR.cells`: pearl clues, stored as `{ kind: "pearl"; color: "white" | "black" }`.
- `PuzzleIR.lines`: canonical Masyu loop decisions, connecting orthogonally adjacent cell centers.
- `PuzzleIR.tiles`: vertex-centered region-color units for inside/outside reasoning.
- `PuzzleIR.edges`: Slitherlink edge state. Do not use it as Masyu loop state.

Coordinate conventions:

- Cell keys are `row,col`, zero-based.
- Masyu line keys connect cells with `lineKey([r, c], [nr, nc])`.
- Masyu tile keys are grid vertices with `tileKey(row, col)` where `row = 0..rows` and `col = 0..cols`.

## Rule Stack

Rule registration lives in `src/domain/rules/masyu/rules.ts`. Verify the current order there before changing or describing exact execution order.

Implemented rule areas include:

- Pearl-local rules for white straight-through and black turn/extension behavior.
- Local named patterns around black/white pearl interactions.
- Line graph constraints, cell-exit completion, and premature-loop prevention.
- Candidate bridge reasoning and pearl candidate pruning.
- Adjacent white pearl lookahead.
- Tile color propagation, color-line implications, color-pearl implications, and connectivity cut coloring.
- Bounded strong inference for black pearls, confirmed-line component endpoints,
  and white pearls.

Default expectation: deterministic rules run first, then bounded strong-inference rules reuse the deterministic rule list for local propagation.

## Architecture Hotspots

Use these files first:

- Rule registration: `src/domain/rules/masyu/rules.ts`
- Shared geometry and state helpers: `src/domain/rules/masyu/rules/shared.ts`
- Pearl rules: `src/domain/rules/masyu/rules/pearls.ts`
- Pattern rules: `src/domain/rules/masyu/rules/patterns.ts`
- Loop rules: `src/domain/rules/masyu/rules/loop.ts`
- Tile color rules: `src/domain/rules/masyu/rules/color.ts`
- Tile connectivity rules: `src/domain/rules/masyu/rules/connectivity.ts`
- Candidate bridge and pruning rules: `src/domain/rules/masyu/rules/bridges.ts`, `src/domain/rules/masyu/rules/candidates.ts`
- Lookahead helpers: `src/domain/rules/masyu/rules/lookahead*.ts`
- Masyu parser/exporter: `src/domain/parsers/puzzlink/masyuPuzzlink.ts`, `src/domain/parsers/penpa/index.ts`
- Masyu editor: `src/features/editor/MasyuEditorBoard.tsx`, `src/features/editor/editorStore.ts`
- Tests: `src/domain/rules/masyu/tests/`, `src/domain/rules/masyu/completion.test.ts`, `src/domain/ir/masyu.test.ts`, parser tests

Replay and rendering plumbing:

- Rule diffs: `src/domain/rules/types.ts`
- Diff application: `src/domain/rules/engine.ts`
- Solver timeline/checkpoints: `src/features/solver/solverStore.ts`
- Board rendering: `src/features/board/CanvasBoard.tsx`
- Strong-inference inspection: `src/features/explanation/BranchInspector.tsx`

## Development Direction

Near-term Masyu work should favor small, maintainable rule improvements over broad rewrites:

- Consolidate repeated line, tile, candidate, and graph primitives when duplication becomes costly.
- Prefer named deterministic rules before adding broader assumption search.
- Keep bounded inference explainable through structured trial traces, contradiction focus, and formal conclusions.
- Add focused fixture tests whenever a rule changes.

Historical Masyu planning notes live under `docs/legacy/`. They are reference material, not the current source of truth.

## Default Workflow

1. Read this brief.
2. Inspect `src/domain/rules/masyu/rules.ts` and the exact helper files touched by the task.
3. Search existing tests before adding a new fixture.
4. Prefer extending local Masyu helpers over copying Slitherlink code directly.
5. Run focused tests first, then build when the change has wider impact.

Useful commands:

```bash
pnpm test:run src/domain/rules/masyu/tests
pnpm test:run src/domain/rules/engine.test.ts src/features/solver/solverStore.test.ts
pnpm build
```

## Guardrails

- Do not use `PuzzleIR.edges` for Masyu loop deductions.
- Do not mutate `PuzzleIR` inside rule inspection.
- Do not batch unrelated reasoning into one rule.
- Do not overwrite already-decided line/tile state with the opposite value.
- Do not make unbounded search part of the default solver.
- If a doc disagrees with current code, trust current code and update the doc.
