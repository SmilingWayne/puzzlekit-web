# Slitherlink

Slitherlink is a loop puzzle played on a grid of dots. The final answer is one
continuous loop drawn along grid edges.

## Core Rules

- The loop never branches or crosses itself.
- Every grid vertex touched by the loop has exactly two used edges.
- A numbered cell tells how many of its four surrounding edges are part of the
  loop.
- Empty cells have no direct number clue, but they still obey the single-loop
  rules.
- The final loop must be one connected loop, not several smaller loops.

## PuzzleKit Model

PuzzleKit represents Slitherlink with a grid-edge model:

- `PuzzleIR.edges` stores line and cross decisions.
- `PuzzleIR.cells` stores numbered clues.
- `PuzzleIR.sectors` stores corner-sector constraints used by advanced
  reasoning.
- `PuzzleIR.vertices` stores vertex candidate information.

## Current Support

- Import from `puzz.link` Slitherlink URLs and Penpa inputs.
- Create and edit Slitherlink puzzles in the editor.
- Render clues, lines, crosses, colors, sectors, and solver highlights.
- Replay deterministic and conservative branch-based solving steps with
  explanations.
- Analyze completion for one valid loop satisfying all numbered clues.

