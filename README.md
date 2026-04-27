# PuzzleKit Web

PuzzleKit Web provides step-wise and explainable inference flow for logical puzzles (only slitherlink for now). The core goal is not just to output a final answer, but to make each deduction step explicit: what changed, why it changed, and which rule produced this change.

Current focus:

- Pure web-based solving experience
- Rule-driven, explainable, replayable deduction flow
- Modular Slitherlink rule architecture (including strong-inference fallback)
- Practical interoperability with common puzzle URL formats (currently centered on puzz.link)

---

## 1) Project Introduction

### 1.1 Positioning

PuzzleKit Web is a reasoning-engine-centered puzzle tool:

- `domain` handles puzzle IR, rules, inference, and replay semantics
- `features` handles controls, board rendering, step explanations, and stats views
- The UI is not a black-box "give me the answer" interface, but a visualization layer for deduction

### 1.2 Current Focus: Slitherlink

Slitherlink rules are modularized under `src/domain/rules/slither/rules/`, including:

- Pattern rules (`patterns.ts`)
- Core constraints (`core.ts`)
- Color-based inference chain (`color.ts`)
- Sector inference and propagation (`sectorInference.ts`, `sectorPropagation.ts`)
- Conservative branch-based strong inference (`strongInference.ts`)
- Shared helpers (`shared.ts`)

Execution order is centrally managed in `src/domain/rules/slither/rules.ts`: deterministic rules first, then strong inference.

---

## 2) Getting Started

### 2.1 Requirements

- Node.js 18+ (latest LTS recommended)
- npm 9+

### 2.2 Install and Start

```bash
npm install
npm run dev
```

This starts the local Vite development server.

### 2.3 Common Commands

```bash
npm run lint       # ESLint
npm run test:run   # Vitest unit tests
npm run build      # TypeScript + Vite production build
npm run test:e2e   # Playwright end-to-end tests
```



---

## 3) Features Implemented So Far

### 3.1 Input and Puzzle Construction

- Import puzzle state from URL
- Create custom blank Slitherlink grids (rows/cols configurable)
- Edit Slitherlink clues directly in cells (`0` to `3` and `?`)

> URL support note: URL import is currently focused on `puzz.link`. `penpa`-style URL support is planned next.

### 3.2 Solving and Replay

- `Next Step`: apply one inference step
- `Previous Step`: rewind one step
- `Solve Next 100 Steps`: auto-advance 100 steps until no more progress (or limit reached)
- `Reset Replay`: return to initial puzzle state
- Each rule step stores message + diffs + affected regions for replay and explanation


### 3.3 Explainability and Visualization

- Reasoning timeline in the `Reasoning Steps` panel
- Toggle between latest 30 steps and full history
- Vertex numbering overlay for board analysis


### 3.4 Live Stats and Terminal Report

- Live metrics: total steps, total modifications, unique techniques, draft difficulty score
- Terminal report when solving stalls: decided-edge ratio, unknown-edge count, blocker reasons
- Rule usage statistics to analyze deduction paths

### 3.5 Export

- Export current puzzle state (including puzz.link encoding attempts)
- One-click copy to clipboard

---

## 4) Roadmap

- `penpa`-style URL support
- Configurable solver parameters (for example: step limits, strong-inference budget)
- Broader Slitherlink rule coverage
- More puzzle type adapters (e.g. Masyu, Nonogram) with stronger plugin support
- Unique-solution checking and diagnostics

---

## 5) Why This Project Exists

This project is built around one idea: solving is not only about the final answer, but also about understanding and replaying the reasoning process.

1. Most solvers focus on "what is the final solution", but not "how the solution is obtained" or "what should be deduced next".
2. By supporting `puzz.link` URLs, the tool can better fit into existing puzzle-sharing workflows and community standards.
3. It offers a lightweight, browser-native alternative to mobile games and desktop software.

The long-term direction is to build a puzzle reasoning tool that is:

- Pure web implementation
- Explainable
- Step-by-step replayable
- Progressively deduction-oriented

---

## 6) Acknowledgements

- Thanks to AI vibe-coding tools such as `Codex` and `Cursor` for helping accelerate development and refactoring.

## 7) References

This repo is inspired by the browser plguin [Puzzlink_Assistance](https://github.com/LeavingLeaves/Puzzlink_Assistance), which help do trivial inference for puzz.link-style puzzles. 

The detailed inference techniques can be found from [How slitherlink should be solved](https://jonathanolson.net/slitherlink/). 

