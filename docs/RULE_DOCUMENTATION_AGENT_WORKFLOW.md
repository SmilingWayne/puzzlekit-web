# Rule Documentation Agent Workflow

Use this workflow when documenting registered PuzzleKit solver rules. It is
designed for AI agents that must read the production implementation, explain the
deduction accurately, and add an in-app rule page without changing solver
behavior.

## Goal

For each selected rule, produce documentation that lets a player answer three
questions:

1. **What it does:** What decisions can this rule add to the board?
2. **When it triggers:** What exact board state allows the deduction?
3. **Why it works:** Why would every alternative violate a puzzle rule?

The production rule implementation is the source of truth. Existing names,
messages, tests, technique notes, and external terminology are supporting
evidence only.

## Required Reading

Read these files before documenting a rule:

1. The rule factory and every helper that materially affects its trigger or
   conclusion.
2. The rule registration file to understand its order and puzzle family.
3. Existing focused tests to see supported orientations, boundary cases, and
   multi-match behavior.
4. `src/features/docs/ruleDocRegistry.tsx`
5. `src/features/docs/ruleExamples.ts`
6. `src/features/docs/RuleExample.tsx`
7. The `.rule-example*` styles in `src/app/workspace.css`
8. Existing MDX documents under `docs/content/<puzzle>/rules/`

Do not infer behavior from the rule name alone.

## Workflow

### 1. Build a Rule Fact Sheet

Before editing, write a private fact sheet from the implementation:

```text
Rule ID:
Current display name:
Factory function:
Puzzle family:
Trigger:
Conclusions:
Orientations or mirrored forms:
Existing-state requirements:
Boundary behavior:
Multiple matches in one application:
Reason the deduction is valid:
Related implementation helpers:
```

Resolve discrepancies by trusting current production code. If the code appears
logically incorrect or broader than the intended technique, stop documenting
and report the suspected rule issue separately.

### 2. Review the User-Facing Name

Prefer a short, recognizable technique name that describes the pattern or
reasoning concept.

- Change the display name when the current name is overly implementation-driven,
  verbose, or ambiguous.
- Preserve the rule ID and factory function by default. They may be referenced
  by deep links, traces, tests, benchmarks, or external notes.
- Update the solver-step message when the existing wording no longer matches the
  improved name or explanation.
- Keep the message concise and state the trigger plus conclusion. Do not attempt
  to reproduce the full MDX explanation in the solver trace.

### 3. Write the MDX Document

Write in clear English. Every rule document must contain exactly these three
sections:

```md
## What it does

State the visible deductions the rule makes. Include distinct conclusion types
in this section.

## When it triggers

State the minimum board conditions required before the rule can act. Explicitly
say when no prior decisions are required.

## Why it works

Give the shortest complete logical argument. Explain which puzzle constraint
would be violated by the alternatives.
```

Writing rules:

- Use player-facing puzzle terms, not implementation variables.
- Be precise about `line`, `crossed out`, `inside`, `outside`, clue values,
  pearls, vertices, and cells.
- Describe rotations and mirrored forms only when they materially clarify the
  trigger.
- Mention multiple subcases only when they share one compact explanation.
- Avoid restating the same sentence in more than one section.
- Do not add `Conclusions`, `Limits and related techniques`, or generic
  background sections.
- Do not claim a deduction is unconditional when it relies on the single-loop
  rule, a non-empty remainder, uniqueness, or another global assumption.

### 4. Decide Whether to Add a Canvas Example

Classify the rule before creating example data. A rule does not need to fit into
one Canvas to qualify. Prefer a small multi-Canvas group over omitting a useful
deterministic explanation merely because the rule has several separable cases.

The classifications are:

- **Simple deterministic:** use one Canvas case.
- **Separable deterministic:** use multiple Canvas cases.
- **Strong inference:** never add Canvas cases.
- **Too complex or too coupled:** defer the Canvas and leave an explicit
  reminder for the author.

#### A. Simple deterministic rule: add an example

Add a Before/After Canvas example when all of these are true:

- The trigger fits on one small board.
- One static Before state makes the reason recognizable.
- The complete conclusion is understandable in one After state.
- The example does not need branch history, hidden candidates, or several
  sequential deductions.

Example requirements:

- Use the smallest board that leaves comfortable visual padding.
- Center the relevant pattern when practical.
- Put prerequisite decisions in `before`.
- Put only this rule's new decisions in `after`.
- Do not highlight clue cells or add colored cell backgrounds.
- Do not use inference overlays or dashed conclusion marks.
- In the After view, highlight only newly decided edges or lines through the
  standard board decision rendering. New lines remain solid; new crosses remain
  visually distinct.
- The caption should state the deduction, not repeat the full proof.

#### B. Separable deterministic rule: add multiple Canvas cases

A somewhat complex rule should still receive Canvas documentation when its
important triggers or conclusions can be divided into independent,
direct Before/After cases. Do not defer merely because one board cannot express
the whole rule clearly.

Use one case per distinct point that a reader needs to compare, such as:

- Two equally important completion branches.
- Distinct deterministic trigger shapes with the same underlying rule.
- Different direct conclusion types that would be confusing on one board.

Case-selection rules:

- Prefer an even number of cases, normally `2` or `4`, because the desktop
  layout uses two columns.
- Do not invent a redundant or weak case solely to make the count even. A clear
  three-case group is better than four cases with filler.
- Normally stop at four representative cases. More than four is a strong signal
  that the rule should be deferred or redesigned with author input.
- Give every case a stable, descriptive `id`.
- Give every case in a multi-case group a short, parallel title.
- Use similarly sized puzzles where practical. Prefer matching dimensions; small
  differences are acceptable when the Canvas cards still feel balanced.
- Avoid grouping boards when the largest is roughly more than twice the width
  or height of the smallest.
- Keep every case independent. A reader must not need to understand one case as
  an intermediate step or hidden prerequisite of another.

Each case must still satisfy all visual and diff requirements from category A.

#### C. Strong-inference rule: never add a Canvas example

Do not create a Before/After Canvas example for strong inference, assumption
inference, contradiction probing, or branch-comparison rules. A static pair
hides the reasoning chain and can misrepresent why the conclusion is valid.

This restriction overrides every other Canvas guideline. Even if a
strong-inference rule appears easy to illustrate or can be divided into several
small boards, leave its Canvas example empty. Document the rule in MDX and
report:

```text
Canvas example deferred: this is a strong-inference rule whose explanation
requires branch or contradiction history.
```

#### D. Complex rule: defer when unclear

Defer the Canvas example when cases require intermediate history, branch
reasoning, hidden candidate state, more than four representative cases, or
cannot be understood as independent Before/After states. Also defer when the
cases are too coupled, the necessary split is unclear, or implementing the
group confidently would be disproportionately difficult.

Do not invent an oversimplified example. Leave the rule's example registration
empty and make the missing Canvas obvious:

- Add a concise `TODO(rule-doc-canvas)` comment beside the relevant location in
  `src/features/docs/ruleExamples.ts`. Include the puzzle ID, rule ID, and exact
  blocker so a future author can find and resume the work.
- Always state the deferral and exact blocker in the delivery report under
  `Needs author input`.

Use this wording:

```text
Canvas example deferred: <rule name> needs <number or description of cases>,
but <coupling, hidden state, sequence, or case-count blocker>. Author input is
needed before the Canvas group can be added.
```

#### E. Understand the Current Multi-Canvas Implementation

All examples use one unified data shape in
`src/features/docs/ruleExamples.ts`:

```ts
export type RuleExampleCaseData = {
  id: string
  title?: string
  puzzle: PuzzleIR
  before?: RuleDiff[]
  after: RuleDiff[]
  explanation: string
}

export type RuleExampleData = {
  cases: [RuleExampleCaseData, ...RuleExampleCaseData[]]
}
```

The `cases` tuple must contain at least one case. Existing single-Canvas
examples are simply one-case groups; do not introduce a separate single-case
shape or compatibility layer.

A typical multi-case registration looks like:

```ts
{
  cases: [
    {
      id: 'first-direct-branch',
      title: 'First direct branch',
      puzzle: firstPuzzle,
      before: firstPrerequisiteDiffs,
      after: firstConclusionDiffs,
      explanation: '...',
    },
    {
      id: 'second-direct-branch',
      title: 'Second direct branch',
      puzzle: secondPuzzle,
      before: secondPrerequisiteDiffs,
      after: secondConclusionDiffs,
      explanation: '...',
    },
  ],
}
```

`RuleExample` owns the complete example group's shared interaction:

- One shared `view` switches every case between Before and After.
- One shared playback timer moves every case from Before to After.
- One shared `Before / After / Play deduction` toolbar is rendered for the
  complete group.
- Manual Before or After selection cancels active playback.

The internal `RuleExampleCase` component owns one `<figure>`:

- It applies that case's `before` diffs to its base puzzle.
- It applies that case's `after` diffs on top of the Before state.
- It highlights only that case's newly decided edges or lines in After.
- It renders the optional title, one `CanvasBoard`, and one caption.
- It derives a unique accessible Canvas label from the case title or ID.

Layout behavior is already provided by `src/app/workspace.css`:

- One case spans the full example width.
- Two and four cases use a maximum of two columns on desktop.
- An odd final case spans the next row and is centered.
- At or below `820px`, every case becomes one full-width vertical item.
- Case cards in one row stretch to equal height.
- Each board is centered inside its card without resizing the Canvas.
- Large boards scroll inside their own shells instead of widening the page.

Do not change `CanvasBoard` rendering behavior to author an example. Build each
case from a small `PuzzleIR`, prerequisite `before` diffs, and conclusion
`after` diffs.

### 5. Register the Documentation

For a completed rule:

1. Add the MDX file under `docs/content/<puzzle>/rules/`.
2. Import it in `src/features/docs/ruleDocRegistry.tsx`.
3. Add a concise one-sentence summary describing the rule's practical result.
4. Add `RuleExampleData` only when the Canvas decision is category A or B.
5. For a deferred category C or D Canvas, leave the example registration empty
   and add the required reminder and delivery-report note.
6. Keep the existing rule ID as the registry key and documentation deep-link
   identifier.

## Quality Review

Before finishing, verify:

- The MDX trigger matches the exact implementation conditions.
- Every diff type the rule can produce is described.
- The proof explains necessity, not merely observed behavior.
- The display name and solver message use the same terminology as the MDX.
- The document has exactly `What it does`, `When it triggers`, and
  `Why it works`.
- A Canvas example, if present, shows real board state rather than decorative
  overlays.
- Multi-case examples use independent cases with stable IDs, short titles,
  similarly sized boards, and preferably an even case count.
- All cases share exactly one Before, one After, and one Play deduction control.
- Every case Canvas has a unique accessible label.
- Strong-inference rules have no Canvas example, without exception.
- Strong-inference and deferred examples are explicitly reported to the author.
- No solver logic, rule order, rule ID, or factory name changed unintentionally.

Run focused existing tests, formatting, lint, and build. When adding a
multi-case example, verify the shared controls and inspect desktop and narrow
layouts in the browser. Do not add tests solely for prose. Update existing
assertions only when an approved display name or solver message changes.

## Delivery Report

End the task with a compact report:

```text
Documented:
- <rule display name> (`<rule-id>`)

Naming:
- <kept or changed display name and why>
- Rule ID and factory function preserved.

Canvas:
- Added: <case count and what each Before and After shows>
or
- Deferred: <strong-inference or complexity reason>

Verification:
- <commands and results>

Needs author input:
- <only unresolved Canvas or terminology decisions; omit when none>
```

