# Masyu Agent Brief

This is the lightweight starting point for AI agents working on Masyu in PuzzleKit Web. Read this first. Only open the longer docs if the task needs them.

## Read-On-Demand Route

- Implement a Masyu rule: read this brief, then inspect the relevant `src/domain/rules/masyu/*` files.
- Research Puzzlink Assistance strategy: also read `docs/MASYU_ASSIST_STRATEGIES_CN.md`.
- Design a new rule family: also read `docs/MASYU_RULE_ABSTRACTIONS.md`.
- Check historical context: also read `docs/MASYU_CHANGELOG.md`.
- Change plugin, IR, replay, stats, or app-wide architecture: also read `docs/PROJECT_GUIDE_EN.md`.

## Current State

Masyu is implemented as a first-class puzzle family with import, rendering, replay-safe rules, completion analysis, and tile-color topology support.

Canonical model:

- `PuzzleIR.cells`: pearl clues, stored as `{ kind: "pearl"; color: "white" | "black" }`.
- `PuzzleIR.lines`: canonical Masyu loop decisions. These are center-to-center line segments between orthogonally adjacent cells.
- `PuzzleIR.tiles`: vertex-centered region-color units for Masyu inside/outside reasoning.
- `PuzzleIR.edges`: Slitherlink edge state. Do not use it as Masyu loop state.

Important coordinate convention:

- Cell keys are `row,col`, zero-based.
- Masyu line keys connect cells: `lineKey([r, c], [nr, nc])`.
- Masyu tile keys are grid vertices: `tileKey(row, col)` where `row = 0..rows`, `col = 0..cols`.

## Current Rule Stack

Registered rule order:

1. `White Circle Rule`
2. `Black Circle Rule`
3. `Black Facing Consecutive Whites`
4. `Black Diagonal White Pinch`
5. `Consecutive White Pearls Straight`
6. `Double Black Squeeze`
7. `Masyu Tile Color Propagation`
8. `Masyu Color-Pearl Propagation`
9. `Masyu Color-Line Propagation`
10. `Masyu Tile Connectivity Cut Coloring`
11. `Masyu Candidate Bridge Line`
12. `Prevent Premature Loop`
13. `Black Pearl Candidate Pruning`
14. `Pearl Completion`
15. `Cell Completion`
16. `Black Pearl Strong Inference`

Implemented rule areas:

- Pearl-local rules for white straight-through and black turn/extension behavior.
- Local pattern rules derived from common Masyu situations.
- Premature loop prevention over `PuzzleIR.lines`.
- Black pearl candidate pruning with shallow feasibility checks.
- Black pearl strong inference with bounded trial propagation that crosses out an exit when that exit's two-step assumption leads to a hard contradiction.
- Completion rules for pearl and non-pearl cells.
- Tile color propagation:
  - boundary tiles are `yellow` / outside;
  - known `blank` lines imply same-color adjacent tiles;
  - known `line` lines imply opposite-color adjacent tiles;
  - white pearl diagonal tiles imply opposite colors;
  - same-color adjacent tiles imply a `blank` Masyu line;
  - opposite-color adjacent tiles imply a `line` Masyu line;
  - tile connectivity cuts color articulation regions needed to connect known inside/outside regions;
  - regions unreachable from outside/yellow through non-line passages become inside/green;
  - tile fills are replay-safe via `TileDiff`;
  - Masyu tile colors render on the board as full-size vertex-centered tiles.

## Architecture Hotspots

Use these files first:

- Masyu rule registration: `src/domain/rules/masyu/rules.ts`
- Masyu geometry helpers: `src/domain/rules/masyu/rules/shared.ts`
- Pearl rules: `src/domain/rules/masyu/rules/pearls.ts`
- Pattern rules: `src/domain/rules/masyu/rules/patterns.ts`
- Loop rules: `src/domain/rules/masyu/rules/loop.ts`
- Tile color rules: `src/domain/rules/masyu/rules/color.ts`
- Tile connectivity rules: `src/domain/rules/masyu/rules/connectivity.ts`
- Candidate bridge rules: `src/domain/rules/masyu/rules/bridges.ts`
- Lookahead helpers: `src/domain/rules/masyu/rules/lookahead*.ts`
- Tests: `src/domain/rules/masyu/rules.test.ts`

Replay and rendering plumbing:

- Rule diffs: `src/domain/rules/types.ts`
- Diff application: `src/domain/rules/engine.ts`
- Board rendering: `src/features/board/CanvasBoard.tsx`
- Solver timeline/highlights: `src/features/solver/solverStore.ts`

## Current Development Direction

Near-term Masyu work should focus on making tile color useful beyond connectivity coloring:

1. Add pearl-local color implications:
   - migrate selected Puzzlink in/out tricks only when they can be explained as small Masyu tile parity rules.

2. Keep rule granularity small:
   - one reasoning idea per rule;
   - explicit diffs;
   - concise explanation message;
   - focused fixture tests.

## How To Start A Task

Default workflow:

1. Read this brief.
2. Inspect the exact rule/helper files touched by the task.
3. Search existing tests before writing a new rule.
4. Prefer extending local Masyu helpers over copying Slither code directly.
5. Run focused tests first, then build.

Useful commands:

```bash
pnpm test:run src/domain/rules/masyu/rules.test.ts
pnpm test:run src/domain/rules/engine.test.ts src/features/solver/solverStore.test.ts
pnpm build
```

## When To Read More

Read `docs/MASYU_RULE_ABSTRACTIONS.md` when designing a new rule family or checking intended rule taxonomy.

Read `docs/MASYU_ASSIST_STRATEGIES_CN.md` only when tracing a deduction back to Puzzlink Assistance. It is research/provenance, not the implementation source of truth.

Read `docs/MASYU_CHANGELOG.md` only when historical context matters.

Read `docs/PROJECT_GUIDE_EN.md` when changing plugin contracts, IR conventions, replay, stats, or app-wide architecture.

## Maintenance Rules

- Update this brief whenever rule order, canonical state, or next development direction changes.
- Keep this brief current, not historical. Move history to `docs/MASYU_CHANGELOG.md`.
- Keep this brief short enough that it can be pasted into an AI context without drowning the actual task.
- Prefer links and routing over duplicating long explanations.

## Guardrails

- Do not use `PuzzleIR.edges` for Masyu loop deductions.
- Do not mutate `PuzzleIR` inside rule inspection.
- Do not batch unrelated reasoning into one rule.
- Do not overwrite already-decided line/tile state with the opposite value.
- Do not make long Puzzlink-style monolithic rules; keep steps explainable.
- If a doc disagrees with current code, trust current code and update this brief.
