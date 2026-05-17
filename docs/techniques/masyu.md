# Masyu

Masyu is a loop puzzle with black and white pearls. The final answer is one continuous loop that passes through every pearl.

This page is a short user-facing technique note. AI agents and developers should start from `docs/MASYU_AGENT_BRIEF.md` instead.

## Core Rules

- The loop travels between cell centers and never branches.
- Every pearl is visited by the loop.
- A white pearl is passed through straight, and the loop must turn in at least one adjacent cell before or after it.
- A black pearl is turned on, and the loop must go straight for at least one cell before and after the turn.
- The final loop must be a single loop, not several disconnected loops or an early small loop.

## PuzzleKit Model

PuzzleKit represents Masyu with a center-line model:

- `PuzzleIR.lines` stores the Masyu loop decisions.
- `PuzzleIR.cells` stores pearl clues.
- `PuzzleIR.tiles` stores vertex-centered inside/outside colors used by Masyu coloring rules.
- `PuzzleIR.edges` is Slitherlink state and is not the Masyu loop model.

## Current Support

- Import from Masyu-family `puzz.link` URLs.
- Render pearls, center-to-center loop segments, crosses, and tile colors.
- Replay deterministic solving steps with explanations.
- Analyze completion for a single valid loop and satisfied pearl constraints.
- Apply local pearl rules, selected local patterns, premature-loop prevention, candidate pruning, completion rules, and Masyu tile-color propagation.

## Developer Pointers

- Start here for Masyu development: `docs/MASYU_AGENT_BRIEF.md`
- Current rule taxonomy: `docs/MASYU_RULE_ABSTRACTIONS.md`
- Original strategy research: `docs/MASYU_ASSIST_STRATEGIES_CN.md`
- Historical implementation notes: `docs/MASYU_CHANGELOG.md`
