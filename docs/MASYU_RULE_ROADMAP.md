# Masyu Rule Roadmap

This is the implementation roadmap for future Masyu rule work. Read
`docs/MASYU_AGENT_BRIEF.md` first for current state and file locations, then use
this document when planning refactors or new deductions.

## Direction

Masyu already has a working rule stack: pearl-local deductions, local patterns,
completion, premature-loop prevention, candidate graph reasoning, black-pearl
candidate pruning, bounded strong inference, and vertex-centered tile coloring.

The next goal is not to add another large rule module. The next goal is to make
the current rule strategy smaller and easier to extend:

- consolidate repeated helpers;
- separate rule semantics by reasoning idea;
- give white pearls the same candidate-model treatment black pearls already
  have;
- make tile color useful through small pearl-local parity rules;
- keep every rule replay-safe and explainable.

## Core Model

- `PuzzleIR.cells` stores pearl clues.
- `PuzzleIR.lines` stores Masyu loop decisions between orthogonally adjacent
  cell centers.
- `PuzzleIR.tiles` stores vertex-centered inside/outside color information.
- `PuzzleIR.edges` is Slitherlink state and must not be used for Masyu loop
  deductions.

Rule output should stay explicit:

- line decisions use `LineDiff`;
- tile color decisions use `TileDiff`;
- rules inspect `PuzzleIR` without mutating it;
- if a candidate update conflicts with an existing decision, skip or reject the
  inference rather than overwriting state.

## Current Pain Points

The Masyu code is capable, but too much reasoning is repeated locally:

- pearl iteration helpers and clue filters exist in several files;
- "remember this compatible decision" helpers are repeated;
- degree and possibility checks are split between direct rules, completion,
  lookahead, and trial inference;
- black-pearl feasibility exists in `lookahead.ts`, while trial inference has a
  separate feasibility model;
- union-find and low-link graph logic are implemented independently for loop
  closure, bridge detection, tile parity, tile connectivity, and trial
  contradiction checks.

This makes future rule work feel heavier than it should. A new rule author has
to rediscover which helper has the intended meaning of "available", "blocked",
"possible", and "contradiction".

## Refactor Priorities

### 1. Shared Decision Collection

Create a small collector used by line and tile rules:

- add compatible decisions only;
- optionally guard `line` decisions against degree overflow;
- track the first clear example for the explanation message;
- build replay-safe diffs in stable order;
- expose affected line/tile keys.

This should replace file-local helpers that only differ in naming.

### 2. Pearl Selectors

Centralize pearl lookup:

- iterate all pearls;
- iterate white pearls;
- iterate black pearls;
- read pearl color safely;
- format common pearl labels.

This is tiny, but it removes noise from every rule file.

### 3. Pearl Candidate Model

Build one shared candidate model for local pearl feasibility.

Black candidates:

- choose one vertical exit and one horizontal exit;
- require both exit lines;
- require the one-step straight extension after each exit;
- exclude the two non-selected incident exits.

White candidates:

- choose one straight axis;
- require both axis exits;
- exclude perpendicular exits;
- track whether each adjacent side can still provide the required immediate
  turn.

Use this model for:

- existing black-pearl candidate pruning;
- future white-pearl candidate pruning;
- trial feasibility checks;
- common consequence extraction across all feasible candidates.

### 4. Line Graph Helpers

Centralize graph operations over `PuzzleIR.lines`:

- cell-center degree counts;
- touched cells for a set of line keys;
- connected components of known lines;
- premature-loop checks;
- candidate graph from all non-blank lines;
- required sources from pearls and existing line components;
- bridge and articulation analysis.

`Masyu Candidate Bridge Line` and `Prevent Premature Loop` should eventually use
the same graph vocabulary.

### 5. Tile Parity Graph

Centralize tile inside/outside parity:

- line means adjacent tiles have opposite colors;
- blank means adjacent tiles have the same color;
- boundary tiles are outside/yellow;
- existing tile fills are anchors;
- conflicting anchors or parity cycles can be reported to trial inference.

Reuse this helper from color propagation and bounded trial contradiction
detection.

## Rule Family Cleanup

After the helpers exist, split or rename current rules so each one maps to one
deduction idea.

Suggested pearl rule boundaries:

- White straight axis: a known white exit forces the opposite exit and blanks
  perpendicular exits.
- White adjacent turn: if one side already continues straight beyond the
  adjacent cell, the opposite side cannot also continue straight.
- White axis feasibility: if one white axis cannot satisfy the adjacent-turn
  condition on either side, eliminate that axis.
- Black turn pair: a black pearl must use one vertical and one horizontal exit.
- Black straight extension: a known black exit forces the next line straight
  beyond the neighboring cell.
- Pearl completion: only handle degree completion and "only legal pair remains"
  cases.

Pattern rules should stay only when they are clearer or cheaper than candidate
reasoning. Do not grow a large library of copied coordinate patterns unless the
deduction has a short explanation and focused tests.

## Missing Rule Work

Highest leverage additions:

1. White pearl candidate pruning.
2. Black pearl local tile-color implications.
3. White pearl candidate color implications when all feasible axes imply the
   same tile relation.
4. Candidate graph articulation reasoning beyond single bridge edges.
5. A Masyu `NoChecker`-style tile parity inference only if it can be stated in
   vertex-centered tile terms and returned as explicit diffs.

Avoid broad monolithic "assistance script" ports. Convert outside research into
small line, pearl-candidate, graph, or tile-parity rules.

## Test Plan

Focused rule tests:

```bash
pnpm test:run src/domain/rules/masyu/rules.test.ts
```

Replay safety:

```bash
pnpm test:run src/domain/rules/engine.test.ts src/features/solver/solverStore.test.ts
```

Full confidence:

```bash
pnpm build
```

New tests should be fixture-sized and grouped by behavior:

- candidate model: black turn candidates, white straight-axis candidates,
  blocked extensions, blocked adjacent turns;
- decision collector: duplicate compatible decisions, conflicts, degree guards;
- tile parity graph: boundary anchors, line/blank parity, conflicting anchors,
  pearl-local parity;
- line graph helpers: premature closures, bridge lines, articulation cells,
  required-source connectivity;
- trial inference: hard contradictions should match deterministic feasibility
  semantics.

## Working Rule

If this roadmap disagrees with current code, trust current code and update the
roadmap. Keep this file current and compact; use git history for historical
detail.

