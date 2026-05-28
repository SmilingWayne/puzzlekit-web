# Masyu

Masyu is a loop puzzle with black and white pearls. The final answer is one
continuous loop that passes through every pearl.

This page describes the Masyu solving rules currently implemented in PuzzleKit.
It is organized by reasoning family rather than by the exact execution order in
the solver.

## Core Puzzle Rules

- The loop travels between cell centers and never branches.
- Every pearl is visited by the loop.
- A white pearl is passed through straight, and the loop must turn in at least
  one adjacent cell before or after it.
- A black pearl is turned on, and the loop must go straight for at least one
  cell before and after the turn.
- The final loop must be a single loop, not several disconnected loops or an
  early small loop.

## PuzzleKit Model And Notation

PuzzleKit represents Masyu with a center-line model:

- `PuzzleIR.lines` stores Masyu loop decisions. These are center-to-center
  segments between orthogonally adjacent cells.
- `PuzzleIR.cells` stores pearl clues.
- `PuzzleIR.tiles` stores vertex-centered inside/outside colors used by Masyu
  coloring rules.
- `PuzzleIR.edges` is Slitherlink state and is not the Masyu loop model.

Notation used below:

- `W` = white pearl.
- `B` = black pearl.
- `?` = unknown line segment.
- `=` or `|` = confirmed loop line.
- `x` = crossed-out line segment.
- `Y` = outside/yellow tile.
- `G` = inside/green tile.

Line diagrams show decisions between cell centers. Tile-color diagrams describe
the vertex-centered tile colors that sit around those lines.

## Core Pearl Rules

### White Pearl Rule

A white pearl must be passed through straight, and at least one adjacent cell on
the path must turn.

This rule can decide line and crossed-out line segments around a white pearl:

- If one incident side is already a line, the opposite side is forced as a line
  and the turn-direction exits are crossed out where possible.
- If both straight exits are already known, the perpendicular exits are crossed
  out.
- If one straight axis is blocked, or if that axis cannot still satisfy the
  required adjacent turn, the other straight axis is forced.
- If one side already continues straight for two segments, the opposite side's
  straight continuation is crossed out so the white pearl can still turn near
  the pearl.

Example: a white pearl with one horizontal exit already used must continue
horizontally through the pearl.

```text
?   x   ?
    |
== W ==     forces the opposite horizontal line and rejects vertical exits
    |
?   x   ?
```

### Black Pearl Rule

A black pearl must turn on the pearl, and both exits from the pearl must continue
straight for one more segment.

This rule can decide lines and crossed-out lines near a black pearl:

- If one exit is already known, the opposite exit is crossed out and the next
  segment in the known exit direction is forced.
- If two turning exits are already known, all remaining exits are crossed out
  and both straight extensions are forced.
- If an exit direction cannot provide the required two-step path, that exit is
  crossed out.
- When only the opposite direction remains viable for a blocked direction pair,
  the first and second segments in the viable direction are forced.

Example: once a black pearl exits upward, it cannot also exit downward, and the
upward path must continue straight for one more segment.

```text
  |
  |
  B
  x
```

## Local Pearl Patterns

### Black Facing Consecutive Whites

If a black pearl faces two consecutive white pearls with one gap between the
black pearl and the first white pearl, the black pearl cannot exit toward that
white pair. It is forced to exit away from the pair.

This rule determines a confirmed line segment from the black pearl in the
opposite direction.

```text
B ? . W W     forces the black pearl away from the whites
```

### Black Diagonal White Pinch

If two white pearls sit diagonally on the same side of a black pearl, they pinch
that side: the black pearl cannot use exits toward them while still satisfying
the local pearl constraints.

This rule determines a confirmed line segment from the black pearl away from the
pinched side.

```text
W   W
  B          forces B away from the two diagonal whites
```

### Consecutive White Pearls Straight

A run of three or more consecutive white pearls forces each pearl in the run to
pass perpendicular to the run.

This rule determines confirmed line segments through the pearls on the
perpendicular axis.

```text
W ? W ? W     horizontal run

|   |   |
W   W   W     each pearl is forced vertically
|   |   |
```

The same logic applies to vertical runs, forcing horizontal passage through the
white pearls.

### Double Black Squeeze

If a non-pearl cell sits between two black pearls, that middle cell cannot keep
exactly one perpendicular exit. If one perpendicular exit is already crossed
out, the other perpendicular exit is crossed out too.

This rule determines crossed-out line segments at the middle cell.

```text
    ?
B ? . ? B
    x

If one vertical exit of the middle cell is x, the other vertical exit is x too.
```

## Completion Rules

### Cell Exit Completion

Cell Exit Completion applies local exit completion to every cell. It uses
ordinary loop-degree logic for empty cells and pearl-shape logic for pearl cells.

This rule can determine confirmed lines and crossed-out lines:

- For ordinary cells, degree 2 crosses out every other unknown exit; degree 1
  with one unknown exit forces continuation; degree 0 with one unknown exit
  crosses out that dead-end candidate.
- For white pearls, exits must be opposite. A known exit keeps only its opposite
  exit, and a single remaining straight axis is completed.
- For black pearls, exits must be adjacent. A known exit crosses out its
  opposite exit, and a single remaining turn pair is completed.
- Black pearl straight extensions are handled by Black Pearl Rule, not by this
  completion rule.

```text
  |
-- . ?     degree 2 already reached, so the remaining ? becomes x
```

## Loop And Connectivity Rules

### Prevent Premature Loop

The final answer must be one continuous loop. An unknown segment is crossed out
if adding it would close a smaller loop while other confirmed line segments
remain outside that loop.

This rule determines crossed-out line segments. It only blocks premature loop
closures; it does not complete the final loop by itself.

### Masyu Candidate Bridge Line

The solver builds a candidate graph from all confirmed and still-unknown Masyu
lines. Pearls and existing confirmed line components are treated as required
regions that must eventually belong to one loop.

If an unknown candidate line is the only remaining bridge between required loop
regions, that line is forced.

This rule determines confirmed line segments.

```text
required region  == ? ==  required region

If the ? segment is the only candidate bridge, it becomes a line.
```

## Candidate And Lookahead Rules

### Black Pearl Candidate Pruning

For each black pearl, the solver enumerates feasible local turn candidates. A
black candidate consists of two turning exits, their required straight
extensions, and the crossed-out non-exits.

This rule determines:

- confirmed lines that appear in every feasible black pearl candidate;
- crossed-out exits that appear in no feasible black pearl candidate.

Candidate feasibility checks local line consistency, cell degree, affected pearl
possibility, and premature-loop creation.

### White Pearl Candidate Pruning

For each white pearl, the solver enumerates feasible straight-axis candidates. A
white candidate consists of one straight axis, crossed-out perpendicular exits,
and at least one side where the required adjacent turn can still happen.

This rule determines:

- confirmed lines that appear in every feasible white pearl candidate;
- crossed-out exits that appear in no feasible white pearl candidate.

Candidate feasibility checks local line consistency, cell degree, affected pearl
possibility, and whether the white pearl can still satisfy its adjacent-turn
requirement.

### Adjacent White Pearls LookAhead

For adjacent white pearls, the solver compares two local modes:

- both pearls pass straight through on parallel paths;
- one straight line passes through both pearls.

If only one of those modes remains locally feasible, the rule applies that
mode's line and crossed-out-line decisions.

```text
W ? W

Mode 1: one line passes through both pearls.
Mode 2: both pearls use parallel perpendicular paths.
Only the feasible mode is kept.
```

## Tile Color Rules

Tile colors are vertex-centered region markers used for inside/outside
reasoning. In the current UI, yellow represents outside and green represents
inside.

### Masyu Tile Color Propagation

Known Masyu lines and crosses create parity constraints between neighboring
tiles:

- boundary tiles are yellow;
- a confirmed line separates opposite tile colors;
- a crossed-out line connects same-colored tiles.

This rule determines tile colors when those parity constraints imply a unique
green or yellow fill.

```text
Y x Y     same color across a crossed-out line
G | Y     opposite colors across a confirmed line
```

### Masyu Color-Pearl Propagation

A white pearl is passed through straight, so opposite diagonal tiles around that
white pearl must have opposite colors.

If one diagonal tile color is known, this rule determines the opposite diagonal
tile color.

```text
G   ?
  W
?   Y     opposite diagonals around W must differ
```

### Masyu Color-Line Propagation

Known neighboring tile colors can be converted back into line decisions:

- same-colored neighboring tiles force the separating Masyu line to be crossed
  out;
- different-colored neighboring tiles force the separating Masyu line to be a
  confirmed loop segment.

This rule determines line and crossed-out-line segments from tile colors.

### Masyu Tile Connectivity Cut Coloring

The inside and outside tile regions must remain connected through passages that
are not blocked by confirmed loop lines.

This rule determines tile colors in two cases:

- a tile component is an articulation or cut region needed to keep known inside
  regions connected, or needed to keep known outside regions connected;
- a tile component is unreachable from the relevant source, so it is colored as
  the opposite region.

The rule can color both green and yellow tiles.

## Bounded Strong Inference

Strong inference rules run bounded trial branches. They temporarily assume a
local choice, apply the deterministic Masyu rules to a fixpoint or limit, and
reject the assumption if it reaches a hard contradiction.

The trial is capped by candidate count, trial steps, and elapsed time. Hard
contradictions include:

- cell degree contradictions;
- pearl shape contradictions;
- premature or multiple-loop contradictions;
- tile-color parity conflicts;
- assumptions that conflict with already decided lines.

### Black Pearl Strong Inference

For a black pearl, the solver assumes one possible exit direction together with
that exit's required straight extension and the opposite exit crossed out.

If deterministic propagation reaches a contradiction, the assumed first exit is
crossed out in the real puzzle.

This rule determines crossed-out line segments.

### White Pearl Strong Inference

For a white pearl with exactly two feasible straight-axis candidates, the solver
assumes one axis.

If deterministic propagation reaches a contradiction, the opposite axis is
forced in the real puzzle.

This rule determines the confirmed lines and crossed-out lines belonging to the
forced white-pearl axis.
