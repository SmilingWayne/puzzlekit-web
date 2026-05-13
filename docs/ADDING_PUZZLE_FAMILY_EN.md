# Adding a Puzzle Family

This guide is for developers and AI agents adding a new puzzle type such as
Nonogram or Masyu. Build a small vertical slice first: parse or create one
puzzle, render it, run a few explainable rules, and prove replay works.

PuzzleKit is a reasoning engine with a UI. Keep puzzle logic in `domain/`, keep
rendering/orchestration in `features/` and `app/`, and connect them through
`PuzzleIR` plus `PuzzlePlugin`.

---

## 1. Understand the Core Mechanisms

Read these before writing code:

- `src/domain/ir/types.ts` - shared `PuzzleIR`, cell/edge/sector/vertex state.
- `src/domain/ir/keys.ts` - stable keys for cells, edges, sectors, and vertices.
- `src/domain/rules/types.ts` - `Rule`, `RuleApplication`, `RuleStep`, and `RuleDiff`.
- `src/domain/rules/engine.ts` - applies rule diffs and rebuilds replay states.
- `src/features/solver/solverStore.ts` - loads puzzles, runs plugin rules, replays steps, and builds terminal reports.
- `src/features/editor/editorStore.ts` - current editor state model and Slitherlink editing pattern.
- `src/domain/plugins/types.ts` and `registry.ts` - plugin boundary for puzzle families.
- `src/domain/benchmark/*` and `dataset/public/*` - dataset and benchmark flow.

Replay safety is the central contract. A rule must return explicit diffs; the
engine and solver store must be able to apply and undo those diffs without
hidden mutation.

---

## 2. Define the Puzzle Boundary

Start by deciding how the new puzzle maps into `PuzzleIR`:

- Use `cells` for clue values, fills, shaded states, or symbols.
- Use `edges` for line-like or wall-like decisions.
- Use `sectors` only when the puzzle needs Slitherlink-style corner constraints.
- Use `vertices` only when vertex candidate sets are part of the reasoning model.
- Put puzzle-specific metadata in `metadata`, but prefer typed shared fields when they fit.

Then add or update a plugin in `src/domain/plugins/`:

- `id` and `displayName`
- `parse(input)` for supported input
- `encode(puzzle)` when export is available
- `getRules()` in deterministic execution order
- optional `help`, `legend`, and `getStats(puzzle)` for UI affordances

Register the plugin in `src/domain/plugins/registry.ts`. Planned stubs are fine,
but do not make UI or docs imply a puzzle is implemented until it can parse,
render, and run at least a minimal rule path.

---

## 3. Build the First Vertical Slice

Recommended order:

1. **IR factory and parser**
   - Add a puzzle factory similar to `createSlitherPuzzle` if blank puzzles are needed.
   - Add parser tests with small, readable fixtures.
   - If full URL support is too large, add a minimal loader path first and document the limit.

2. **Renderer**
   - Add a puzzle-specific board renderer or make an existing renderer safely plugin-aware.
   - Render actual puzzle state, not placeholder marketing UI.
   - Keep dimensions stable so large boards and zoom do not shift layout.

3. **Rules**
   - Add a puzzle-specific rule folder under `src/domain/rules/<puzzle>/`.
   - Start with small deterministic rules that produce clear messages and explicit `RuleDiff`s.
   - Keep rule order in one aggregation file, like Slitherlink's `rules.ts`.

4. **Solver integration**
   - Ensure `getRules()` returns the new ordered rules.
   - Add replay tests proving `nextStep`, `prevStep`, and `goToStep` rebuild the same state.
   - Add terminal/completion analysis when the puzzle has a meaningful solved/stalled report.

5. **Editor and export**
   - Add editor tools only after parsing/rendering/rules are stable.
   - Keep editor state normalized as `PuzzleIR` so it can load directly into the solver.
   - Add export only for formats that can round-trip reliably.

6. **Dataset and benchmark**
   - Add small public fixtures only when they are useful and stable.
   - Use private datasets for local experiments.
   - Benchmark reports should summarize status, step count, timing, and rule usage.

---

## 4. UI Integration Checklist

For a puzzle family to feel first-class, decide which of these it owns:

- Solver board rendering and highlights.
- Editor board rendering and input tools.
- Puzzle type controls in Solver, Editor, and Dataset pages.
- `PuzzleInfoButton` content via plugin `help`.
- `BoardLegendButton` content via plugin `legend`.
- Board-title statistics via plugin `getStats`.
- Dataset preview rendering.
- Export controls and error messages.

Prefer plugin-aware shared components when the behavior is generic. Prefer
puzzle-specific components when the interaction model is genuinely different
from Slitherlink.

---

## 5. Suggested Roadmap

**Milestone 1: Parse, render, sample puzzle**

- A sample puzzle can load through the plugin.
- The board displays the puzzle accurately.
- Tests cover parser basics and rendering smoke behavior.

**Milestone 2: Deterministic starter rules**

- Add a small ordered rule set.
- Each rule returns explainable messages and explicit diffs.
- Replay tests prove forward/backward timeline behavior.

**Milestone 3: Editor and export**

- Add minimal editor tools for the puzzle's givens and user-editable state.
- Solver can load the editor puzzle without conversion hacks.
- Export round-trips when supported.

**Milestone 4: Completion, datasets, UI polish**

- Add solved/stalled analysis for terminal reports.
- Add curated public dataset entries and benchmark coverage.
- Add help, legend, and stats where they clarify the puzzle.

**Milestone 5: Stronger inference**

- Add advanced or branch-based inference only after deterministic rules are stable.
- Inject deterministic rule dependencies instead of self-referencing exported rule arrays.
- Keep branch reasoning conservative and test contradiction cases carefully.

---

## 6. Implementation Cautions

- Do not put puzzle-specific rules into shared solver orchestration.
- Do not mutate puzzle state inside a rule; return `RuleDiff`s.
- Do not change diff semantics without updating both engine and replay tests.
- Do not hide non-determinism behind rule ordering or object iteration.
- Do not overfit UI to Slitherlink if the next puzzle needs different primitives.
- Do not claim full support in docs, dropdowns, or datasets until parse/render/solve basics exist.

The best first version is small, explainable, and replay-safe. Coverage can grow
incrementally once that spine is solid.
