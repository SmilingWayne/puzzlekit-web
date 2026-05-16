# Masyu

Current implementation location:

- IR factory: `src/domain/ir/masyu.ts`
- puzz.link decoder: `src/domain/parsers/puzzlink/masyuPuzzlink.ts`
- Plugin: `src/domain/plugins/masyuPlugin.ts`
- Board rendering branch: `src/features/board/CanvasBoard.tsx`
- Change log: `docs/MASYU_CHANGELOG.md`
- Encoding reference: `docs/MASYU_ENCODE_METHOD.md`
- Strategy reference: `docs/MASYU_ASSIST_STRATEGIES_CN.md`

Current model:

- `PuzzleIR.lines` is the canonical center-to-center loop decision state.
- `PuzzleIR.edges` remains Slitherlink-style vertex-to-vertex grid-edge state.
- `PuzzleIR.tiles` is reserved for future vertex-centered coloring units.
- Pearl clues are stored on cells as
  `Clue { kind: "pearl"; color: "white" | "black" }`.
- Masyu line keys use cell coordinates:
  `lineKey([row, col], [neighborRow, neighborCol])`.

Implemented so far:

- Import from `puzz.link` Masyu-family URLs: `masyu`, `mashu`, and `pearl`.
- Render dashed inner grid, thick outer border, pearls, center lines, and
  crosses.
- Replay and trace stats understand `LineDiff`.

Not implemented yet:

- Deterministic Masyu solving rules.
- Masyu editor, dataset flow, completion analysis, and URL export.
- Masyu-specific Live Stats labels and rich legend examples.

Next rule-development direction:

- Use `docs/MASYU_ASSIST_STRATEGIES_CN.md` as the main source for Masyu solving
  strategies.
- Start with generic single-loop-in-cell rules: degree 2, no dead ends, forced
  two exits, and premature loop prevention.
- Then add pearl-local rules:
  - Black pearl turn-and-straight constraints.
  - White pearl straight-and-turn-nearby constraints.
- Keep each rule deterministic, explainable, small, and covered by focused
  tests.
