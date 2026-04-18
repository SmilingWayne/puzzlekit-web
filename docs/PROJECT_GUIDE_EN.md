# PuzzleKit Web Project Guide (English)

## 1. Project Purpose

PuzzleKit Web is a frontend-first, explainable logic puzzle workspace focused on:

- Parsing puzzle URLs into a unified in-browser IR (no backend dependency)
- Running non-SAT, rule-based deduction step by step
- Visualizing board state and reasoning history in real time
- Supporting multi-puzzle extensibility (Slitherlink implemented; Masyu/Nonogram planned)

The product goal is **human-readable deduction**, not black-box solving.

---

## 2. What Changed Recently (Important)

The largest recent change is the Slither sector model:

- Sector state is no longer a single enum-like marker.
- Sector state is now a **bitmask constraint set** over allowed corner line counts `{0,1,2}`.
- Rule diffs for sectors are now `fromMask -> toMask` transitions.
- Inference now works by **constraint intersection** (narrowing), then edge propagation from exact masks.
- Canvas rendering now visualizes overlapping constraints with layered arcs.

This guide now documents that new model as the current baseline.

---

## 3. Tech Stack and Toolchain

- **Language**: TypeScript
- **UI Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: Zustand
- **Validation**: Zod
- **Testing**:
  - Unit/Component: Vitest + Testing Library
  - E2E: Playwright
- **Quality**: ESLint + Prettier + lint-staged + Husky

Key scripts (root `package.json`):

- `npm run dev`: start local dev server
- `npm run build`: production build
- `npm run preview`: preview build artifact
- `npm run lint`: lint check
- `npm run test:run`: run unit/component tests once
- `npm run test:e2e`: run Playwright E2E tests

---

## 4. Architecture Overview

```text
src/
  app/              # page composition and layout
  domain/           # pure puzzle/business logic
    ir/             # IR types, keys, normalize/clone
    parsers/        # URL decode/encode adapters
    rules/          # deduction engine and puzzle rules
    plugins/        # puzzle plugin contracts and registry
    exporters/      # output/export abstraction
    difficulty/     # derived difficulty snapshots
  features/         # board, controls, explanation, stats
  test/             # test runtime setup
```

Design principles:

- Keep puzzle behavior in `domain/`, not in view components
- Keep puzzle-family differences in plugins + domain rules
- Keep every deduction step as explicit diffs for replay and explanation

---

## 5. Slither Sector Model (Current Truth)

### 5.1 IR representation

Defined in `src/domain/ir/types.ts`:

- `SectorState` stores `constraintsMask`
- Mask encodes allowed line counts at a corner sector:
  - `SECTOR_ALLOW_0`, `SECTOR_ALLOW_1`, `SECTOR_ALLOW_2`
  - `SECTOR_MASK_ALL`, `SECTOR_MASK_ONLY_0/1/2`, `SECTOR_MASK_NOT_0/1/2`
- Helpers:
  - `sectorMaskAllows(mask, n)`
  - `sectorMaskIntersect(a, b)`
  - `sectorMaskIsSingle(mask)`
  - `sectorMaskSingleValue(mask)`

### 5.2 Rule diff representation

Defined in `src/domain/rules/types.ts`:

- `SectorDiff` now uses:
  - `fromMask`
  - `toMask`

No legacy `SectorMark` field is used in core rule flow.

### 5.3 Inference flow

Defined in `src/domain/rules/slither/rules.ts`:

- `inferSectorMaskByVertex(...)` computes mask constraints from current local evidence
- `createApplySectorsInference()` intersects current and inferred masks
- `createSectorConstraintEdgePropagationRule()` pushes exact masks to edges:
  - only-two => both sector edges are `line`
  - only-zero => both sector edges are `blank`
  - only-one + one decided edge => infer the remaining edge
- `createSectorNotOneClueTwoPropagationRule()` now checks "not one" via mask semantics (line-count 1 disallowed)

---

## 6. Engine and Replay Invariants

Critical files:

- `src/domain/rules/engine.ts`
- `src/features/solver/solverStore.ts`

Both must apply sector diffs identically:

- `SectorDiff.toMask` is written to `puzzle.sectors[sectorKey].constraintsMask`

If one side changes and the other does not, rewind/replay diverges. Treat these two paths as a paired contract.

---

## 7. Core Code Map (Where to Modify)

### 7.1 Deduction engine and rules

- Rule loop and step creation: `src/domain/rules/engine.ts`
- Rule contracts: `src/domain/rules/types.ts`
- Slither rules: `src/domain/rules/slither/rules.ts`
- Timeline state (`next/prev/solve/reset`): `src/features/solver/solverStore.ts`

### 7.2 IR and serialization

- IR types + sector mask helpers: `src/domain/ir/types.ts`
- Slither puzzle initialization: `src/domain/ir/slither.ts`
- Normalized JSON snapshot + semantic compare: `src/domain/ir/normalize.ts`
- Export entry: `src/domain/exporters/index.ts`

### 7.3 Parsing / encoding

- Unified parse/encode entry: `src/domain/parsers/index.ts`
- Slither puzz.link codec: `src/domain/parsers/puzzlink/slitherPuzzlink.ts`
- Penpa adapter placeholder: `src/domain/parsers/penpa/index.ts`

### 7.4 Board and explanation UI

- Canvas rendering and interactions: `src/features/board/CanvasBoard.tsx`
- Reasoning list UI: `src/features/explanation/ExplanationPanel.tsx`
- Controls and export panel: `src/features/solver/ControlPanel.tsx`

---

## 8. Current Feature Status

Implemented:

- Slitherlink puzz.link decode/encode (clue-centric baseline)
- Rule-based progression (`Next`, `Previous`, `Solve to End`)
- Rewind-safe timeline replay using stored diffs
- Sector **multi-constraint mask semantics** in IR/rules/engine/replay
- Sector-to-edge propagation from exact masks
- Canvas sector visualization for overlapping constraints (layered arcs)
- Explanation panel with newest-first step order and display modes (`Recent 30` / `Show All`)
- Export panel:
  - puzz.link URL output
  - penpa placeholder output
  - normalized JSON output
  - clipboard copy

Partially implemented / placeholder:

- Penpa parsing/encoding
- Additional puzzle families beyond Slitherlink
- Puzzle-specific interaction tools on board
- Difficulty model calibration (current snapshot is structural/basic)

---

## 9. Development Workflow

1. Make a small, scoped change.
2. Add/update tests with the logic change.
3. Run:
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`
4. For UI-critical flows, optionally run:
   - `npx playwright install` (first time)
   - `npm run test:e2e`

---

## 10. Known Risks and Documentation Gaps to Watch

Areas that historically caused drift and must stay aligned:

- **Sector semantics drift**: do not reintroduce single-label logic in new rules.
- **Engine/replay split-brain**: when `RuleDiff` shape changes, update both `engine.ts` and `solverStore.ts`.
- **Doc staleness after model upgrades**: update this guide whenever IR schema changes (especially `types.ts`, `rules/types.ts`, and `CanvasBoard` assumptions).

---

## 11. Contributor Guidelines

When modifying this codebase:

- Treat `domain/` as the source of truth for puzzle behavior.
- Keep puzzle-specific deduction out of generic UI layout files.
- Emit explicit diffs + messages for each rule application.
- Preserve timeline semantics (`steps + pointer`) and replay determinism.
- Add tests next to changed logic (`*.test.ts` / `*.test.tsx`).

If introducing a new puzzle:

1. Add parser/encoder adapter.
2. Add plugin implementation and register it.
3. Add rule set and tests.
4. Add puzzle-specific UI labels/config through plugin interfaces.

