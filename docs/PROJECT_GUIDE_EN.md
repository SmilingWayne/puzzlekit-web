# PuzzleKit Web Project Guide (English)

## 1. Project Purpose

PuzzleKit Web is a frontend-first, explainable logic puzzle workspace focused on:

- Parsing puzzle URLs into a unified in-browser IR (no backend dependency).
- Running non-SAT, rule-based deduction step by step.
- Visualizing board state and reasoning history in real time.
- Providing a foundation for multi-puzzle extensibility (Slitherlink now; Masyu/Nonogram planned).

The core product intent is **human-readable deduction**, not black-box solving.

---

## 2. Tech Stack and Toolchain

- **Language**: TypeScript
- **UI Framework**: React 19
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: Zustand
- **Validation**: Zod
- **Testing**:
  - Unit/Component: Vitest + Testing Library
  - E2E: Playwright
- **Quality**: ESLint + Prettier + lint-staged + Husky (prepare hook)

Key scripts (root `package.json`):

- `npm run dev`: start local dev server
- `npm run build`: production build
- `npm run preview`: preview build artifact
- `npm run lint`: lint check
- `npm run test:run`: run unit/component tests once
- `npm run test:e2e`: run Playwright E2E tests

---

## 3. Current Architecture Overview

```text
src/
  app/              # page composition and layout
  domain/           # pure puzzle/business logic
    ir/             # puzzle IR types and key utilities
    parsers/        # URL decode/encode adapters
    rules/          # deduction rule engine and rule definitions
    plugins/        # puzzle plugin registry and contracts
    exporters/      # output/export abstraction
    difficulty/     # difficulty metric snapshots (derived)
  features/         # UI feature modules (board, controls, stats, explanation)
  test/             # test runtime setup
```

Design principles:

- Keep board rendering separate from puzzle logic.
- Keep puzzle-family differences in plugin and domain layers.
- Keep reasoning steps as explicit diffs for replay and explainability.

---

## 4. Core Code Map (Where to Modify)

### 4.1 Deduction Engine

- Rule execution loop: `src/domain/rules/engine.ts`
- Rule contracts and step schema: `src/domain/rules/types.ts`
- Slitherlink rules: `src/domain/rules/slither/rules.ts`
- Timeline state (`next/prev/solve/reset`): `src/features/solver/solverStore.ts`

When adding new logic rules, start with:

1. puzzle-specific rule file
2. plugin `getRules()`
3. rule tests

### 4.2 Parsing / Encoding

- Unified parse/encode entry: `src/domain/parsers/index.ts`
- Slitherlink puzz.link codec: `src/domain/parsers/puzzlink/slitherPuzzlink.ts`
- Penpa adapter placeholder: `src/domain/parsers/penpa/index.ts` (not implemented)

### 4.3 Board Visualization (Canvas)

- Canvas renderer and view-only interactions (zoom/pan): `src/features/board/CanvasBoard.tsx`
- Note: puzzle interaction behaviors are intentionally not fully implemented yet.

### 4.4 UI Layout and Interaction Panels

- Main page layout: `src/app/WorkspacePage.tsx`
- Global styles/layout: `src/app/workspace.css`
- Main controls + export panel: `src/features/solver/ControlPanel.tsx`
- Reasoning list UI: `src/features/explanation/ExplanationPanel.tsx`
- Stats UI: `src/features/stats/StatsPanel.tsx`

### 4.5 Plugin-Based Puzzle Extensibility

- Plugin contract: `src/domain/plugins/types.ts`
- Plugin registry: `src/domain/plugins/registry.ts`
- Implemented plugin: `src/domain/plugins/slitherPlugin.ts`
- Planned placeholders: `src/domain/plugins/masyuPlugin.ts`, `src/domain/plugins/nonogramPlugin.ts`

---

## 5. Current Feature Status

Implemented:

- Slitherlink puzz.link decode/encode (baseline)
- Rule-based step progression (`Next`, `Previous`, `Solve to End`)
- Timeline rewind reliability fix (branch-safe after previous-step rewinds)
- Reasoning display modes (`Recent 30` / `Show All`)
- Newest-first reasoning order
- Export panel (collapsible) with:
  - puzz.link output
  - penpa placeholder output
  - normalized JSON output
  - clipboard copy action

Partially implemented / placeholder:

- Penpa parsing/encoding
- Multi-puzzle rule sets beyond Slitherlink
- Puzzle-specific board interaction tools
- Difficulty scoring model (currently structural metrics only)

---

## 6. Development Workflow (Recommended)

1. Create a small scoped change.
2. Add/adjust tests first where practical.
3. Run:
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`
4. For UI flow-critical changes, optionally run:
   - `npx playwright install` (first time only)
   - `npm run test:e2e`

---

## 7. Deployment Notes

- Build output: `dist/`
- Standard static deployment works (Vercel, Netlify, static Nginx, etc.).
- No server runtime is required for current features.

---

## 8. Backlog and Priority Suggestions

High priority:

1. Penpa decode/encode implementation for Slitherlink.
2. Puzzle interaction contract (plugin-defined action handlers).
3. Stronger Slitherlink rule coverage and deterministic step ordering.

Medium priority:

1. Export validation and format status badges.
2. Difficulty model calibration.
3. Enhanced explanation metadata (rule categories, confidence, impacted entities).

Low priority:

1. UI theming and accessibility pass.
2. Performance optimization for larger boards.

---

## 9. Guidance for AI Agents / New Collaborators

When modifying this codebase:

- Treat `domain/` as source of truth for puzzle behavior.
- Avoid embedding puzzle-specific logic in `features/board/CanvasBoard.tsx`.
- Keep steps reproducible: each rule application must emit explicit diffs and messages.
- Preserve timeline semantics (`steps + pointer`) and ensure rewind-safe behavior.
- Add tests near changed logic (`*.test.ts` / `*.test.tsx`).

If introducing a new puzzle:

1. Add parser/encoder adapter.
2. Add plugin implementation and register it.
3. Add rule set and tests.
4. Add puzzle-specific UI labels/config only through plugin-friendly interfaces.

