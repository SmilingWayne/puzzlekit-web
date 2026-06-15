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
6. Existing MDX documents under `docs/content/<puzzle>/rules/`

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

Classify the rule before creating example data.

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

#### B. Strong-inference rule: do not add an example yet

Do not create a Before/After Canvas example for strong inference, assumption
inference, contradiction probing, or branch-comparison rules. A static pair
hides the reasoning chain and can misrepresent why the conclusion is valid.

Document the rule in MDX and report:

```text
Canvas example deferred: this is a strong-inference rule whose explanation
requires branch or contradiction history.
```

#### C. Complex or multi-case rule: defer when unclear

Defer the Canvas example when the rule has several materially different trigger
paths, produces different conclusion types, or needs a sequence of intermediate
states to be understood.

Do not invent an oversimplified example. Report:

```text
Canvas example needs author input: the rule covers <brief list of cases>.
Please choose the representative case or approve a multi-stage explanation.
```

When uncertain between A and C, choose C.

### 5. Register the Documentation

For a completed rule:

1. Add the MDX file under `docs/content/<puzzle>/rules/`.
2. Import it in `src/features/docs/ruleDocRegistry.tsx`.
3. Add a concise one-sentence summary describing the rule's practical result.
4. Add `RuleExampleData` only when the Canvas decision is category A.
5. Keep the existing rule ID as the registry key and documentation deep-link
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
- Strong-inference and deferred examples are explicitly reported to the author.
- No solver logic, rule order, rule ID, or factory name changed unintentionally.

Run focused existing tests, formatting, lint, and build. Do not add tests solely
for prose. Update existing assertions only when an approved display name or
solver message changes.

## Delivery Report

End the task with a compact report:

```text
Documented:
- <rule display name> (`<rule-id>`)

Naming:
- <kept or changed display name and why>
- Rule ID and factory function preserved.

Canvas:
- Added: <what Before and After show>
or
- Deferred: <strong-inference or complexity reason>

Verification:
- <commands and results>

Needs author input:
- <only unresolved Canvas or terminology decisions; omit when none>
```

## Reusable Prompt Chain

Use these prompts sequentially when assigning the work to an AI agent.

### Prompt 1: Analyze

```text
Read the production implementation, registration, helpers, and focused tests
for <rule factory or rule ID>. Produce a rule fact sheet using
docs/RULE_DOCUMENTATION_AGENT_WORKFLOW.md. Do not edit files yet. Flag any
disagreement between the implementation and the apparent intended technique.
```

### Prompt 2: Propose

```text
Using the approved fact sheet, propose the user-facing display name, solver-step
message, three-section English MDX outline, and Canvas classification (simple,
strong inference, or complex/multi-case). Preserve the rule ID and factory
function unless explicitly approved otherwise.
```

### Prompt 3: Implement

```text
Implement the approved rule documentation according to
docs/RULE_DOCUMENTATION_AGENT_WORKFLOW.md. Add a Canvas example only for a
simple deterministic rule. For strong-inference or complex rules, document the
rule and explicitly report why the Canvas example was deferred. Run focused
existing tests, formatting, lint, and build.
```

### Prompt 4: Review

```text
Review the completed rule documentation against the production implementation
and docs/RULE_DOCUMENTATION_AGENT_WORKFLOW.md. Prioritize logical inaccuracies,
ambiguous trigger wording, misleading Canvas states, duplicated prose, and
unintentional compatibility changes.
```
