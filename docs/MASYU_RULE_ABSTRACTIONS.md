# Masyu Rule Abstractions

This document is an implementation-oriented rule taxonomy for adding deterministic Masyu solving to PuzzleKit. It abstracts the current Puzzlink Assistance strategy notes into rules that do not depend on that userscript's object model.

The target reader is a developer or AI agent implementing `src/domain/rules/masyu/*` rules that return replay-safe `RuleDiff`s. Use `docs/MASYU_ASSIST_STRATEGIES_CN.md` only as provenance for the original strategy source; use this document as the implementation spec.

## Current PuzzleKit Model

Masyu currently uses a center-line model:

- `PuzzleIR.cells`: stores pearl clues as `{ kind: "pearl", color: "white" | "black" }`.
- `PuzzleIR.lines`: stores center-to-center loop decisions using `LineState.mark`.
- `LineMark`: `unknown`, `line`, or `blank`.
- `PuzzleIR.tiles`: reserved for future region/corner coloring units.
- `PuzzleIR.edges`: remains available for Slitherlink-style vertex-to-vertex edges, but should not be the canonical Masyu loop state.

Implementation should prefer small helpers that hide geometry details:

- `getMasyuNeighborCells(puzzle, cellKey)`: orthogonal in-bounds neighbor cell keys.
- `getMasyuIncidentLineKeys(puzzle, cellKey)`: up to four center-line keys incident to a cell.
- `getMasyuDirectionalLine(puzzle, cellKey, direction, distance)`: the line at a directional offset, for pearl-local rules.
- `getMasyuCellDegree(puzzle, cellKey)`: count incident lines marked `line`.
- `getMasyuUnknownExits(puzzle, cellKey)`: incident lines still marked `unknown`.
- `buildMasyuLineComponents(puzzle)`: connected components of cells joined by `line` marks.
- `buildMasyuCandidateGraph(puzzle)`: graph of cells connected by lines that are not `blank`.

Rules should produce explicit diffs:

- Use `LineDiff` for loop decisions.
- Use `CellDiff` only if a future rule stores visible cell color/fill state.
- If Masyu coloring is added as a first-class hidden or visible state, prefer a dedicated IR field only after deciding how replay and rendering should expose it. Until then, treat coloring rules in this document as design guidance.

## Rule Design Principles

Each rule should be deterministic, local where possible, and replay-safe.

- Do not mutate `PuzzleIR` while inspecting it.
- Collect all compatible updates in local maps, then return diffs.
- If a rule can infer both `line` and `blank`, reject or skip contradictory updates instead of masking them.
- Report a concise message with the first clear example and a total count.
- Keep each rule narrow enough that a failing test points to one reasoning idea.

Recommended rule card fields:

- Intent: what the rule proves.
- Input state: what facts it reads.
- Algorithm: implementation steps.
- Output diffs: what it can write.
- Explanation message: user-facing wording pattern.
- Tests: focused fixtures that prove the rule and replay.

## Rule Family 1: Generic Single Loop In Cell

These rules are puzzle-generic for loops that pass through cell centers. They should be implemented before pearl-specific rules because black and white pearl deductions depend on them.

### Rule: Pearl Pass-Through Degree

Intent: every pearl cell must have loop degree 2.

Input state:

- Pearl cells from `PuzzleIR.cells`.
- Incident center lines from `PuzzleIR.lines`.

Algorithm:

1. For each pearl cell, count incident `line`, `blank`, and `unknown` lines.
2. If two incident lines are already `line`, mark all remaining unknown incident lines `blank`.
3. If exactly two incident lines are not `blank`, mark both as `line`.
4. If fewer than two incident lines are available, return no inference; completion analysis should report invalidity later.

Output diffs: `LineDiff` from `unknown` to `line` or `blank`.

Explanation message: `Pearl (Rr, Cc) must have degree 2, so the only two available exits are lines.`

Tests:

- Pearl with two unknown exits and two blanks.
- Pearl with two lines and two unknown exits.
- Border/corner pearl with only two possible exits.

### Rule: Center-Line Degree

Intent: the loop has degree 0 or 2 at every cell center, and degree 2 at pearl cells.

Input state:

- All cells, not only pearls.
- Incident center lines.

Algorithm:

1. For each cell, count incident `line` and `unknown` lines.
2. If `lineCount === 2`, mark remaining unknown incident lines `blank`.
3. If `lineCount === 1 && unknownCount === 1`, mark the only unknown line `line`.
4. If `lineCount === 0 && unknownCount === 1` for a non-pearl cell, mark the only unknown line `blank`; using it would create a dead end.
5. For pearl cells, delegate forced two-exit logic to `Pearl Pass-Through Degree` or share a helper.

Output diffs: `LineDiff`.

Explanation message: `Cell (Rr, Cc) already has two loop lines, so every other exit is blank.`

Tests:

- A path entering a cell with only one unknown continuation.
- A completed degree-2 cell.
- A non-pearl dead-end candidate.

### Rule: Premature Loop Prevention

Intent: do not close a smaller loop before all required pearls are in the final loop.

Input state:

- Current `line` graph on cell centers.
- Unknown center lines.
- Pearl cells that still need to be included.

Algorithm:

1. Build a union-find over cell centers connected by existing `line` marks.
2. For each unknown line between cells `a` and `b`, check whether `a` and `b` are already in the same component.
3. If they are in the same component, adding this line closes a cycle.
4. Mark the line `blank` unless this closure would be the final valid loop containing all required pearl cells and no unresolved line component remains. A first implementation can conservatively blank same-component closures whenever any pearl has degree less than 2 or there is more than one active line component.

Output diffs: `LineDiff` to `blank`.

Explanation message: `Line (Rr, Cc)-(Rr2, Cc2) would close the current path before all pearls are connected, so it is blank.`

Tests:

- A nearly closed small loop with an outside pearl.
- A same-component candidate when multiple active components exist.
- A fully solved final loop should not be processed by this rule as a new inference.

Implementation analogy: this is the center-line counterpart of Slitherlink's `createPreventPrematureLoopRule()`, but vertices become cell centers and `edges` become `lines`.

### Rule: Candidate-Graph Bridge Line

Intent: if all required loop material can stay connected only through a candidate line, that line must be used.

Input state:

- Candidate graph where every non-blank line is an edge.
- Source nodes: pearl cells and cells already incident to a line.
- Current known line components.

Algorithm:

1. Build the candidate graph from all cell centers and lines whose mark is not `blank`.
2. Treat existing line components and pearl cells as required sources.
3. Run Tarjan low-link analysis to find bridges or articulation structures that separate required sources.
4. If a candidate line is the only connection between two required-source sides, mark it `line`.
5. Keep the first version conservative: only infer when a single unknown line is the bridge between two source-containing components.

Output diffs: `LineDiff` to `line`.

Explanation message: `Line (Rr, Cc)-(Rr2, Cc2) is the only candidate connection between required loop regions, so it is a line.`

Tests:

- Two pearl groups connected by a one-cell-wide corridor.
- Existing line endpoint that can reach the rest of the puzzle through only one unknown line.
- No inference when two independent candidate corridors exist.

Implementation analogy: this rule uses the same low-link idea as Slitherlink color connectivity cut coloring, but the graph is the Masyu candidate line graph rather than a colored-cell region graph.

## Rule Family 2: Pearl-Local Rules

These rules encode the Masyu clue semantics directly. They should work from directional axes rather than from copied pattern diagrams.

Use directions `N`, `E`, `S`, `W`. An axis is an opposite pair, such as `E-W` or `N-S`.

### Rule: Black Pearl Turn

Intent: a black pearl must turn at the pearl cell.

Input state:

- Black pearl cell.
- Incident lines and blanks.
- Two axis groups: north-south and east-west.

Algorithm:

1. For each axis group, count incident `line` and non-blank candidate exits.
2. A valid black pearl uses exactly one exit from each axis group.
3. If one direction in an axis group is already `line`, mark the opposite direction in that axis group `blank`.
4. If an axis group has exactly one non-blank candidate and no line yet, mark that candidate `line`.
5. If an axis group has zero candidates, return no inference; completion analysis should report the contradiction.

Output diffs: `LineDiff` to `blank` or `line`.

Explanation message: `Black pearl (Rr, Cc) must use one vertical and one horizontal exit, so the only remaining vertical candidate is a line.`

Tests:

- Black pearl with an east line forces west blank.
- Black pearl with only one vertical candidate forces that vertical candidate to line.
- Black pearl with no vertical candidates produces no diff and is left for completion analysis.

### Rule: Black Pearl Straight Extension

Intent: after leaving a black pearl, the loop must continue straight for at least one more cell.

Input state:

- Black pearl cell.
- A known incident line in direction `d`.
- The next line in direction `d` from the neighboring cell.

Algorithm:

1. For each black pearl and direction `d`, if the incident line in `d` is `line`, find the next forward line beyond the adjacent cell.
2. If that next line is unknown, mark it `line`.
3. If that next line is already `blank`, do not infer here; invalidity belongs to completion analysis.

Output diffs: `LineDiff` to `line`.

Explanation message: `Black pearl (Rr, Cc) exits east, so the line must continue straight through the next cell.`

Tests:

- Each direction extension.
- Extension at board boundary should produce no diff.
- Existing extension line should be ignored.

### Rule: Black Pearl Impossible Exit

Intent: remove any black-pearl exit direction that cannot satisfy the turn-and-extension constraint.

Input state:

- Black pearl cell.
- Candidate incident direction `d`.
- Neighbor cell and forward extension line in direction `d`.
- Side lines through the neighbor cell.
- Nearby pearl clues.

Algorithm:

For each candidate direction `d`, mark the incident line `blank` if any of these are true:

- The incident line is already unavailable.
- The forward extension line beyond the neighbor is unavailable.
- The neighbor already has a perpendicular line that would prevent straight extension.
- The neighbor is another black pearl, making the required straight continuation incompatible with that pearl's turn.
- Taking direction `d` would force the black pearl to go straight through the pearl cell.

After blanking an impossible exit, ordinary degree rules can force the remaining exits.

Output diffs: `LineDiff` to `blank`.

Explanation message: `Black pearl (Rr, Cc) cannot exit east because the required straight extension is blocked.`

Tests:

- Blocked forward extension.
- Neighboring black pearl.
- Perpendicular line at the required extension cell.

### Rule: White Pearl Straight Through

Intent: a white pearl must go straight through the pearl cell.

Input state:

- White pearl cell.
- Incident lines and blanks.

Algorithm:

1. If an incident line on one side of an axis is `line`, mark the opposite side of that axis `line`.
2. Mark both perpendicular incident lines `blank`.
3. If both sides of one axis are unavailable, mark both sides of the other axis `line`.
4. If exactly one axis remains possible, force it.

Output diffs: `LineDiff` to `line` and `blank`.

Explanation message: `White pearl (Rr, Cc) must go straight, so the opposite exit is also a line and perpendicular exits are blank.`

Tests:

- Known east line forces west line and north/south blank.
- North/south blocked forces east-west line.
- One remaining possible axis.

### Rule: White Pearl Adjacent Turn Requirement

Intent: a white pearl must turn in at least one adjacent cell immediately before or after the pearl.

Input state:

- White pearl cell.
- A chosen or implied straight axis.
- Lines one and two steps away along each side of that axis.

Algorithm:

1. If one side of the white pearl already continues straight through the adjacent cell, then the opposite side must provide the required adjacent turn.
2. Concretely, if the line entering the pearl from west and the line west of the neighboring west cell are both `line`, mark the far east continuation line `blank`.
3. Apply symmetrically for all axes and directions.

Output diffs: `LineDiff` to `blank`.

Explanation message: `White pearl (Rr, Cc) already continues straight on one side, so the other adjacent cell must turn.`

Tests:

- Two consecutive line segments on one side of a white pearl.
- Symmetry across all four directions.

### Rule: White Pearl Axis Elimination

Intent: eliminate a white-pearl straight axis when either side cannot provide a valid adjacent turn condition.

Input state:

- White pearl cell.
- Candidate axis.
- Neighbor cells on both sides of the axis.
- Local line/blank states around those neighbors.
- Nearby pearl clues that constrain those neighbors.

Algorithm:

1. For each side of a candidate axis, determine whether that side can still satisfy the white pearl's adjacent-turn requirement.
2. A side cannot satisfy the requirement if the adjacent cell is forced to continue straight, is blocked from turning, or is itself a pearl whose constraints conflict with the required turn.
3. If both sides of an axis cannot satisfy the requirement, mark the two incident lines of that axis `blank` and force the perpendicular axis through `White Pearl Straight Through`.
4. Keep individual blockers as separate helper predicates so explanations stay short.

Output diffs: `LineDiff` to `blank` and possibly `line`.

Explanation message: `White pearl (Rr, Cc) cannot use the east-west axis because neither adjacent side can turn, so it must use the north-south axis.`

Tests:

- Adjacent white pearl blocks an axis.
- Existing far straight line blocks the adjacent-turn requirement.
- Both adjacent turn positions blocked.

## Rule Family 3: Local Pattern Rules

These are deterministic pattern rules derived from common Masyu shapes. Implement them after the core pearl-local rules, and keep each one optional and independently tested.

### Rule: Double-Black Squeeze

Intent: two black pearls on opposite sides of a cell can eliminate a perpendicular singleton exit.

Input state:

- A middle cell.
- Two black pearls on opposite sides along an axis.
- One perpendicular incident line from the middle cell already blank.

Algorithm:

1. For each cell and axis, check whether the two opposite neighbor cells are black pearls.
2. If one perpendicular line from the middle cell is `blank`, mark the other perpendicular line `blank`.
3. Rely on degree and black-pearl extension rules to handle any forced axis lines afterward.

Output diffs: `LineDiff` to `blank`.

Explanation message: `The cell between two black pearls cannot use a single perpendicular exit, so the opposite perpendicular exit is blank.`

Tests:

- Horizontal black pair with north blocked implies south blank.
- Vertical black pair with east blocked implies west blank.

### Rule: Black Facing Consecutive Whites

Intent: a black pearl may be forced away from a direction that leads into two consecutive white pearls.

Input state:

- Black pearl.
- Two white pearls at offsets two and three cells in direction `d`.

Algorithm:

1. For each black pearl and direction `d`, inspect the two cells at distance 2 and 3.
2. If both are white pearls, mark the opposite incident line from the black pearl `line`.
3. Let black pearl turn and extension rules clean up the remaining exits.

Output diffs: `LineDiff` to `line`.

Explanation message: `Black pearl (Rr, Cc) cannot satisfy its exit toward two consecutive white pearls, so it must extend the opposite way.`

Tests:

- Horizontal and vertical examples.
- No inference when only one white pearl exists.

### Rule: Black Diagonal-White Pinch

Intent: two diagonal white pearls on the same side of a black pearl force the black pearl away from that side.

Input state:

- Black pearl.
- Two white pearls at the diagonal cells on one side.

Algorithm:

1. For each black pearl and side `s`, inspect the two diagonal cells in front-left and front-right of that side.
2. If both are white pearls, mark the incident line opposite side `s` as `line`.
3. Use normal black-pearl rules to infer the turn partner and extension.

Output diffs: `LineDiff` to `line`.

Explanation message: `Two diagonal white pearls pinch black pearl (Rr, Cc), forcing it to leave away from them.`

Tests:

- All four orientations.
- No inference when one diagonal is empty or black.

### Rule: White Neighbor Axis Exclusion

Intent: neighboring white pearls and blocked turn cells can eliminate a white pearl axis.

Input state:

- White pearl.
- Candidate straight axis.
- Adjacent cells along that axis.
- Pearl clues and line states around those adjacent cells.

Algorithm:

1. For each candidate axis, evaluate both adjacent side cells.
2. Mark a side as axis-hostile when it is a white pearl in a position that would require incompatible straight-through behavior, or when both turn exits around that side are blocked.
3. If both sides are axis-hostile, blank the candidate axis and force the perpendicular axis.

Output diffs: `LineDiff`.

Explanation message: `White pearl (Rr, Cc) cannot use the east-west axis because both neighboring turn positions are unavailable.`

Tests:

- Consecutive white pearls on both sides.
- Turn exits blocked by blanks.
- Mixed blockers on the two sides.

### Rule: L-Path Pearl Continuation

Intent: an existing L-shaped partial path plus nearby pearl constraints can force continuation lines.

Input state:

- A local L shape made of four known center lines around a corner.
- Nearby white or black pearls at fixed offsets.
- More than one active line component, or an otherwise unresolved loop.

Algorithm:

1. Detect a local L-shaped path segment using center-line geometry.
2. Check for specific pearl configurations around the open ends:
   - two white pearls near the diagonal continuation,
   - a black pearl near one end and a white pearl near the other,
   - a black pearl that must extend away from the L shape.
3. Add the continuation lines that are forced by pearl semantics and by avoiding a premature local loop.
4. Implement each pearl configuration as a named subrule rather than one large pattern.

Output diffs: `LineDiff` to `line`.

Explanation message: `The L-shaped path around (Rr, Cc) and nearby pearls force this continuation to keep the loop connected.`

Tests:

- One fixture per subrule.
- Regression test ensuring the rule does not fire after the loop is already complete.

## Rule Family 4: Masyu Coloring

Masyu can use a coloring strategy analogous to Slitherlink, but the colored objects differ.

In Slitherlink, the loop runs on grid edges, so coloring cells as inside/outside works directly: same-colored adjacent cells imply a blank edge; opposite-colored adjacent cells imply a line edge.

In Masyu, the loop runs between cell centers. The natural colored objects are the small regions around grid corners, not the puzzle cells themselves. This project already reserves `PuzzleIR.tiles` for future vertex-centered coloring units. A Masyu coloring implementation should decide whether `tiles` represent these corner regions.

### Coloring State

Use two colors:

- `inside`
- `outside`

For implementation parity with Slitherlink, these could be stored as tile fills such as `green` and `yellow`, but the semantic names in rule code should remain `inside` and `outside`.

Adjacency relation:

- Two neighboring corner regions separated by no loop crossing have the same color.
- Two neighboring corner regions separated by a Masyu center line have opposite colors.

Line relation:

- If adjacent regions are same color, the separating center-line candidate is `blank`.
- If adjacent regions are opposite colors, the separating center-line candidate is `line`.
- If a center line is `line`, adjacent regions become opposite colors.
- If a center line is `blank`, adjacent regions become same color.

This is the Masyu counterpart of `createColorEdgePropagationRule()`.

### Rule: Masyu Outside Seeding

Intent: seed the unbounded exterior region as outside.

Input state:

- Tile/corner-region graph.
- Border-adjacent regions.

Algorithm:

1. Identify corner regions connected to the board exterior without crossing a known line.
2. Mark them `outside`.
3. Propagate through known blank separations if those are represented.

Output diffs: future tile/color diffs, or no implementation until the IR supports them.

Explanation message: `The exterior region is outside, so connected border regions are outside.`

Implementation analogy: Slitherlink `createColorOutsideSeedingRule()`.

### Rule: Masyu Line-Color Propagation

Intent: known line and blank marks propagate region color parity.

Input state:

- Known line marks.
- Known region colors.
- Region adjacency separated by each center-line candidate.

Algorithm:

1. For each known line, require opposite colors on its adjacent regions.
2. For each known blank, require same colors on its adjacent regions.
3. Use a parity union-find if many implications are processed together.

Output diffs: future tile/color diffs.

Explanation message: `This line is part of the loop, so the regions on its sides have opposite colors.`

Implementation analogy: the second half of `createColorEdgePropagationRule()`.

### Rule: Masyu Color-Line Propagation

Intent: known region colors decide line marks.

Input state:

- Adjacent region colors.
- Unknown center-line candidate separating them.

Algorithm:

1. If two adjacent regions have the same color, mark the separating line `blank`.
2. If two adjacent regions have opposite colors, mark the separating line `line`.

Output diffs: `LineDiff`.

Explanation message: `The regions on both sides have opposite colors, so the separating Masyu line is part of the loop.`

Implementation analogy: the first half of `createColorEdgePropagationRule()`.

### Rule: Pearl-Local Color Implications

Intent: pearl semantics can imply region color parity even before line marks are known.

Input state:

- Pearl type.
- Local region colors around the pearl.
- Candidate pearl axes.

Algorithm:

1. White pearl straight-through behavior implies consistent parity between diagonal corner regions around its straight axis.
2. Black pearl turn behavior implies parity relations across the turn quadrant and straight-extension cells.
3. Encode each implication as a small local color rule only when the geometry is unambiguous.

Output diffs: future tile/color diffs, or `LineDiff` if colors decide lines immediately.

Explanation message: `White pearl (Rr, Cc) must go straight, so these two corner regions have opposite parity.`

Note: these are the algorithmic version of the original assist script's pearl-specific `in/out` propagation. Implement them after basic coloring works.

### Rule: Masyu Connectivity Cut Coloring

Intent: Tarjan cut analysis can force unknown regions to become inside or outside when they are required to preserve color-region connectivity.

Input state:

- Region graph where known lines are barriers and known blanks are passable connections.
- Known inside or outside source regions.
- Optional exterior source for outside.

Algorithm:

1. Compress already-connected same-color regions with union-find.
2. Build a candidate connectivity graph between color components through non-barrier adjacencies.
3. For a target color, treat known target-colored components as sources.
4. Run Tarjan DFS with `discovery` and `low` values.
5. If a component is an articulation point separating target-color sources, color it with the target color.
6. If a component is unreachable from any target source, color it with the opposite color.
7. Run once for inside and once for outside.

Output diffs: future tile/color diffs.

Explanation message: `Region connectivity forces this component to be inside because it is a cut between inside sources.`

Implementation analogy: this is the direct Masyu-region version of Slitherlink's `createColorConnectivityCutColoringRule()` and `findConnectivityColorUpdates()`.

## Suggested Rule Order

Start with rules that use only current IR fields:

1. `masyu-pearl-pass-through-degree`
2. `masyu-center-line-degree`
3. `masyu-white-straight-through`
4. `masyu-black-turn`
5. `masyu-black-straight-extension`
6. `masyu-black-impossible-exit`
7. `masyu-white-adjacent-turn`
8. `masyu-white-axis-elimination`
9. `masyu-premature-loop-prevention`
10. `masyu-candidate-graph-bridge-line`
11. Selected local pattern rules

Add coloring after the IR has an agreed representation for Masyu regions:

1. `masyu-outside-seeding`
2. `masyu-line-color-propagation`
3. `masyu-color-line-propagation`
4. `masyu-pearl-local-color-implications`
5. `masyu-connectivity-cut-coloring`

Keep branch-based or contradiction-based inference out of the first implementation pass. Masyu should first reach parity with deterministic local and graph rules.

## Implementation Milestones

Milestone 1: geometry helpers.

- Add Masyu line-direction helpers.
- Add degree and candidate-exit helpers.
- Add line component builder.
- Add formatter helpers for cells and center lines.

Milestone 2: generic loop rules.

- Implement degree rules and premature loop prevention.
- Add focused unit tests for each.
- Register rules through `masyuPlugin.getRules()`.

Milestone 3: pearl-local rules.

- Implement black and white pearl rules as separate files or separate factory functions.
- Use small fixtures for each direction and axis.
- Keep explanation messages specific.

Milestone 4: graph connectivity.

- Implement candidate-graph bridge/cut inference.
- Use Tarjan low-link helpers if they can be shared cleanly with Slitherlink; otherwise keep a Masyu-local graph helper.

Milestone 5: optional coloring.

- Decide whether `PuzzleIR.tiles` should store Masyu region colors.
- Implement color propagation and cut coloring only after replay and rendering semantics are clear.

## Test Strategy

Every rule should have tests that cover:

- One minimal positive fixture.
- One non-firing fixture with a near miss.
- Replay safety: apply the rule, undo via engine replay, and reapply deterministically where existing test harnesses support this.
- Directional symmetry for local rules.
- Conflict avoidance: a rule must not emit a diff from a non-unknown line to a different mark.

For graph rules, include:

- A single forced bridge.
- Two alternative corridors where no bridge is forced.
- A same-component premature loop candidate.
- A final-loop-like position that should not be incorrectly blanked.

For coloring rules, include:

- Same color implies blank.
- Opposite color implies line.
- Line implies opposite color.
- Blank implies same color.
- Tarjan cut component between two target-color sources.
- Unreachable component becomes the opposite color.

## Mapping From Strategy Notes To Rule Names

Use these names when migrating from the older strategy document:

- `珠子必须被回路经过`: `masyu-pearl-pass-through-degree`
- `度数为二`: `masyu-center-line-degree`
- `无死端`: `masyu-center-line-degree`
- `双出口强制成线`: `masyu-pearl-pass-through-degree`
- `禁止提前闭环`: `masyu-premature-loop-prevention`
- `单环连通桥成线`: `masyu-candidate-graph-bridge-line`
- `白珠被迫直行`: `masyu-white-straight-through`
- `白珠至少一侧转弯`: `masyu-white-adjacent-turn`
- `白珠轴线排除`: `masyu-white-axis-elimination`
- `黑珠非法出口排除`: `masyu-black-impossible-exit`
- `黑珠出口延伸`: `masyu-black-straight-extension`
- `黑珠避开连续白珠`: `masyu-black-facing-consecutive-whites`
- `黑珠斜白夹逼`: `masyu-black-diagonal-white-pinch`
- `双黑夹格垂直禁线`: `masyu-double-black-squeeze`
- `白珠同路径改轴`: `masyu-white-same-component-axis-elimination`
- `黑珠同路径避闭环`: `masyu-black-same-component-exit-elimination`
- `L形路径连通补线`: `masyu-l-path-pearl-continuation`
- `内外异色成线`: `masyu-color-line-propagation`
- `内外同色禁线`: `masyu-color-line-propagation`
- `线段翻转内外`: `masyu-line-color-propagation`
- `禁线保持内外`: `masyu-line-color-propagation`

## Notes On Reusing Slitherlink Infrastructure

The Slitherlink color rules are useful templates, not drop-in Masyu rules.

Reusable ideas:

- Parity union-find for color constraints.
- Low-link Tarjan traversal for articulation/cut coloring.
- Rule factories that collect local decisions before returning diffs.
- First-example explanation messages with aggregate counts.

Do not reuse directly without adapting geometry:

- Slitherlink `edges` are vertex-to-vertex loop edges; Masyu loop decisions are `lines` between cell centers.
- Slitherlink cell colors represent regions separated by grid edges; Masyu region colors should represent corner/tile regions separated by center lines.
- Slitherlink vertex degree is not the same as Masyu cell-center degree.

The desired end state is conceptual reuse with Masyu-specific helpers, not shared code that hides different geometry behind misleading names.
