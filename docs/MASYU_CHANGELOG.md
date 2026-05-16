# Masyu Implementation Changelog

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

The next development center should be deterministic Masyu solving rules. Use
`docs/MASYU_ASSIST_STRATEGIES_CN.md` as the strategy reference. That document
summarizes the Masyu assist framework and local rules from `Puzzlink_Assistance`
in a form suitable for PuzzleKit's explainable rule engine.

Recommended next steps:

- Add small Masyu rule helpers for directions, opposite directions, adjacent
  cell-center lines, and pathable line checks.
- Implement generic single-loop-in-cell basics for Masyu:
  degree 2, no dead ends, forced two exits, and no premature small loop.
- Then add pearl-specific rules:
  black pearl turn-and-straight constraints.
  white pearl straight-and-turn-nearby constraints.
- Keep each rule small, named, deterministic, and backed by focused tests.
