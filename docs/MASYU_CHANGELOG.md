# Masyu Implementation Changelog

## 2026-05-17 Deterministic Rule Increment

This update adds the first replay-safe Masyu solving rules. The goal is still
incremental: keep each rule local, deterministic, explainable, and backed by
small fixtures before moving toward graph or coloring techniques.

## Implemented

- Added Masyu rule helpers in `src/domain/rules/masyu/rules/shared.ts`:
  - Cardinal directions, opposite/turn checks, and direction offsets.
  - Directional center-line lookup from a cell.
  - Two-step line lookup for pearl extension logic.
  - Line-decision collection helpers that avoid overwriting decided marks.
- Added pearl-local rules in `src/domain/rules/masyu/rules/pearls.ts`:
  - `White Circle Rule`: white pearls go straight through the pearl, reject
    blocked axes, blank perpendicular turn exits, and now enforce the adjacent
    turn requirement when one side already runs straight for two segments.
  - `Black Circle Rule`: black pearls turn, extend any known exit straight one
    more cell, reject impossible exits, and blank the opposite side of a known
    exit on the same axis.
- Added generic center-line completion in
  `src/domain/rules/masyu/rules/completion.ts`:
  - `Pearl Completion`: pearl cells get their own completion pass, separate
    from ordinary cells. White pearls only complete straight-through exits;
    black pearls only complete turn exits and try to extend confirmed exits one
    more cell.
  - Non-pearl cells with degree 2 blank every other candidate.
  - Non-pearl cells with one known line and one remaining candidate force that
    candidate as a line.
  - Non-pearl dead-end candidates are blanked.
- Added local pattern rules in `src/domain/rules/masyu/rules/patterns.ts`:
  - `Black Facing Consecutive Whites`: a black pearl facing two consecutive
    white pearls two and three cells away is forced to leave the opposite way.
  - `Black Diagonal White Pinch`: two diagonal white pearls on one side of a
    black pearl force the black pearl away from that side.
  - `Consecutive White Pearls Straight`: a run of three or more adjacent white
    pearls is forced to pass perpendicular to the run.
  - `Double Black Squeeze`: two black pearls with one middle cell between them
    force the opposite perpendicular exit blank when the other perpendicular
    exit is already blank.
- Registered the current Masyu rule order:
  1. `White Circle Rule`
  2. `Black Circle Rule`
  3. `Black Facing Consecutive Whites`
  4. `Black Diagonal White Pinch`
  5. `Consecutive White Pearls Straight`
  6. `Double Black Squeeze`
  7. `Pearl Completion`
  8. `Cell Completion`

## Validation

Focused tests live in `src/domain/rules/masyu/rules.test.ts` and cover:

- White pearl straight-through, blocked-axis, and adjacent-turn deductions.
- Black pearl turn, extension, and impossible-exit deductions.
- Black-pearl local patterns.
- Consecutive white-pearl run patterns.
- Pearl-specific completion and double-black squeeze completion.
- Registration order and line-diff application on the sample Masyu puzzle.

Commands run successfully:

```bash
pnpm test:run src/domain/rules/masyu/rules.test.ts
pnpm lint
```

Focused result at implementation time:

- 1 test file passed.
- 56 Masyu rule tests passed.

## Notes For Future Agents

- Keep using `PuzzleIR.lines` as the canonical Masyu loop state.
- New Masyu rules should continue to return explicit `LineDiff`s only unless a
  future feature deliberately introduces replay support for another state field.
- Avoid contradiction masking: if a target line is already decided as the
  opposite mark, skip the inference and leave invalidity reporting to a later
  completion/analysis layer.
- The next useful rule families are graph-level single-loop constraints
  (`premature loop prevention`, `candidate bridge`) and more white-pearl axis
  elimination, before any Masyu coloring work.

## 2026-05-16 Initial Import And Display Increment

This update adds the first real Masyu support path to PuzzleKit Web. The goal of
this increment is intentionally narrow: import a Masyu `puzz.link` URL, preserve
the existing Slitherlink architecture, and render the imported board in the main
solver workspace.

## Implemented

- Added first-class Masyu IR fields:
  - `PuzzleIR.lines`: canonical center-to-center loop decisions for Masyu.
  - `PuzzleIR.tiles`: future vertex-centered coloring units.
  - Pearl clues as `Clue { kind: "pearl"; color: "white" | "black" }`.
- Added Masyu key helpers:
  - `lineKey`, `parseLineKey`, `getCellLineKeys`.
  - `tileKey`, `parseTileKey`.
- Added `createMasyuPuzzle(rows, cols)`:
  - Creates one unknown line for each orthogonally adjacent cell-center pair.
  - Creates tiles at original grid vertex coordinates, `0..rows` and `0..cols`.
  - Leaves Slitherlink-style `edges` and `sectors` empty.
- Added `decodeMasyuFromPuzzlink`:
  - Accepts `masyu`, `mashu`, and `pearl`.
  - Supports optional `v:` and `b` header segments.
  - Decodes `number3` trits according to `docs/MASYU_ENCODE_METHOD.md`.
  - Verified sample:
    `https://puzz.link/p?mashu/5/5/001390360`.
- Updated `masyuPlugin`:
  - Display name is now `Masyu`.
  - Parser is wired to the new puzz.link decoder.
  - Export intentionally throws: Masyu puzz.link export is not implemented yet.
  - Rule/help text is present.
  - Legend is a placeholder.
  - Stats show board size and pearl distribution.
- Extended replay and stats plumbing:
  - Added `LineDiff`.
  - Rule engine can apply and revert line diffs.
  - Rule steps may carry `affectedLines`.
  - Trace stats treat Masyu line decisions as board progress.
  - Slitherlink edge behavior remains unchanged.
- Added Masyu rendering in the solver board:
  - Thin dashed inner grid.
  - Thick solid outer border.
  - Existing `R` / `C` coordinate labels.
  - Centered white and black pearls.
  - Center-to-center lines and crosses from `PuzzleIR.lines`.

## Not Implemented Yet

- Masyu solving rules.
- Masyu editor.
- Masyu dataset flow.
- Masyu-specific Live Stats labels.
- Masyu export back to puzz.link.
- Rule examples and rich legend diagrams.

## Validation

Use a modern local Node runtime. Debugging with local Node `v24.13.1` should be
fine. In this Codex environment, the bundled Node runtime was required because
the default shell Node was too old for the current `pnpm`.

Commands run successfully:

```bash
pnpm lint
pnpm build
pnpm test:run
```

Full test result at implementation time:

- 16 test files passed.
- 278 tests passed.

Focused tests added:

- `src/domain/ir/masyu.test.ts`
- `src/domain/parsers/puzzlink/masyuPuzzlink.test.ts`
- Line diff coverage in `src/domain/rules/engine.test.ts`
- Masyu line progress coverage in `src/domain/difficulty/traceStats.test.ts`

## Architecture Notes For Future Agents

- `lines` is the canonical Masyu decision state. Do not reuse Slitherlink
  `edges` for Masyu loop segments.
- `edges` remains Slitherlink-style vertex-to-vertex grid-edge state.
- `tiles` is reserved for future Masyu coloring over vertex-centered middle
  cells. It is not currently rendered or inferred.
- Masyu line keys use cell coordinates, not vertex coordinates:
  `lineKey([row, col], [neighborRow, neighborCol])`.
- `rows × cols` in the UI means the user-operated cell board size.
- Existing Slitherlink rules should not be generalized unless a Masyu feature
  needs shared infrastructure.

## Next Work Center

The next development center should be stronger deterministic Masyu solving
rules. Use `docs/MASYU_RULE_ABSTRACTIONS.md` as the implementation-oriented
taxonomy and `docs/MASYU_ASSIST_STRATEGIES_CN.md` as provenance for the original
strategy source.

Recommended next steps:

- Add premature-loop prevention over Masyu `lines`.
- Add candidate-graph bridge inference over non-blank center-line candidates.
- Continue expanding local white-pearl axis elimination and optional pattern
  rules with focused fixtures.
- Keep each rule small, named, deterministic, and backed by focused tests.
