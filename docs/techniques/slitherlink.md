# Slitherlink

Current implementation location:

- Rule aggregator: `src/domain/rules/slither/rules.ts`
- Rule modules: `src/domain/rules/slither/rules/`
- Completion analysis: `src/domain/rules/slither/completion.ts`
- Tests: `src/domain/rules/slither/rules.test.ts`

Current rule organization:

- `patterns.ts`: clue pattern rules, such as contiguous 3-runs and diagonal
  adjacent 3s.
- `core.ts`: generic Slitherlink constraints, including clue edge counts,
  vertex degree, and premature loop prevention.
- `color.ts`: cell color seeding and propagation.
- `sectorInference.ts`: corner-sector inference from local edge, vertex, and
  cell evidence.
- `sectorPropagation.ts`: sector-to-sector and sector-to-edge propagation.
- `colorAssumptionInference.ts`: conservative color-branch contradiction
  inference.
- `sectorParityInference.ts`: conservative sector-parity contradiction
  inference.
- `strongInference.ts`: conservative branch-based contradiction inference.
- `shared.ts`: reusable geometry, clue, color, and mask helpers.

Important Slitherlink model note:

- Sector state is a bitmask of allowed corner line counts `{0,1,2}`.
- Sector diffs use `fromMask -> toMask`.
- Rule semantics narrow masks by intersection and then propagate strict masks.
- Do not revert sectors to old single-label semantics.

Branch inference note:

- Branch-based rules should not self-reference the exported `slitherRules`
  array.
- Use dependency injection, for example
  `createStrongInferenceRule(() => deterministicSlitherRules)`.
