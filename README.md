# PuzzleKit Web

[PuzzleKit Web](https://smilingwayne.github.io/puzzlekit-web/) is a pure frontend logic-puzzle tool for step-wise, explainable solving. It currently focuses on **Slitherlink** and **Masyu**.

The goal is not only to produce a final answer. The app shows each deduction step: what changed, which rule changed it, and how the board can be replayed forward or backward.

## What It Does

- Runs entirely in the browser.
- Imports Slitherlink and Masyu puzzles from puzz.link-compatible URLs and Penpa+ URLs.
- Provides an explainable solver workspace with step replay, highlights, rule messages, strong-inference branch inspection, and live stats.
- Provides an editor workspace for building Slitherlink and Masyu boards, importing URLs, and loading the result into the solver.
- Provides a small Dataset page for curated examples and benchmark-oriented puzzle sets.
- Exports supported puzzle states back to puzz.link-style URLs where available.
- Opens canonical puzz.link payloads directly in Solver through shareable deep links.

Slitherlink has the more mature rule stack. Masyu is now a first-class puzzle family with editor, import/export, rendering, replay, completion analysis, and an actively evolving solver.

![](https://cdn.jsdelivr.net/gh/SmilingWayne/picsrepo/20260604213830574.png)

## Getting Started

Requirements:

- Node.js 20, matching `.nvmrc`
- Corepack with pnpm 10.33.0

```bash
corepack enable
pnpm install
pnpm dev
```

This starts the local Vite development server.

Common commands:

```bash
pnpm lint       # ESLint
pnpm test:run   # Vitest unit tests
pnpm build      # TypeScript + Vite production build
pnpm test:e2e   # Playwright end-to-end tests
pnpm benchmark:solve
```

## App Surfaces

- **Solver** (`/`): import a puzzle, run one deduction at a time, jump through the replay timeline, inspect explanations and strong-inference branches, view stats, and export supported states.
- **Editor** (`/editor`): create custom Slitherlink or Masyu grids, edit clues/pearls and marks, import supported URLs, then hand the puzzle to the solver.
- **Dataset** (`/dataset`): browse curated public dataset manifests, preview puzzles, and load them into Solver or Editor.

## Solver Deep Links

Solver accepts canonical puzz.link-compatible payloads through the `p` query parameter:

```text
https://smilingwayne.github.io/puzzlekit-web/?p=slither/10/10/...
https://smilingwayne.github.io/puzzlekit-web/?p=mashu/14/8/...
```

Deep links support the compact `slither/...` and `mashu/...` payload forms only. Full puzz.link,
pzplus, pzv, and Penpa+ URLs remain supported through the existing manual URL import controls.

## Architecture Snapshot

```text
src/
  app/        page composition and routing
  domain/     IR, parsers, exporters, plugins, rule engine, benchmark logic
  features/   board rendering, solver controls, editor, stats, explanations
  test/       test setup helpers
dataset/
  public/     small committed dataset manifests
  private/    local-only manifests ignored by git
docs/
  techniques/ puzzle-specific technique notes
```

Puzzle families are registered as plugins. A plugin owns parsing, exporting, help/legend content, stats, and the ordered rule list used by the solver. The shared rule engine applies explicit diffs so every step can be replayed and reverted deterministically.

## Deployment

CI runs on pushes and pull requests targeting `main`:

```bash
pnpm lint
pnpm test:run
pnpm build
```

GitHub Pages deployment is triggered by pushing a `v*` tag. The Pages workflow builds `dist/`, adds an SPA fallback, and publishes the result.

## Documentation

- `docs/PROJECT_GUIDE_EN.md`: compact project guide for AI agents and maintainers.
- `docs/MASYU_AGENT_BRIEF.md`: active low-token Masyu onboarding brief.
- `docs/techniques/slitherlink.md`: Slitherlink technique notes.
- `docs/techniques/masyu.md`: Masyu technique notes.
- `docs/legacy/`: older plans and research notes kept for reference only.

## Why This Project Exists

Most puzzle solvers emphasize the final solution. PuzzleKit Web is built around the solving trace: each step should be inspectable, explainable, and replayable. The long-term direction is a browser-native reasoning workbench for logic puzzles, with puzzle-family support growing incrementally through small, explicit rules.

## References

This repo is inspired by [Puzzlink_Assistance](https://github.com/LeavingLeaves/Puzzlink_Assistance), a browser plugin for puzz.link-style puzzles.

Slitherlink technique references include [How slitherlink should be solved](https://jonathanolson.net/slitherlink/).
