import type {
  EdgeMark,
  LineMark,
  PuzzleIR,
  SectorConstraintMask,
  VertexCandidate,
} from '../ir/types'

export type EdgeDiff = {
  kind: 'edge'
  edgeKey: string
  from: EdgeMark
  to: EdgeMark
}

export type SectorDiff = {
  kind: 'sector'
  sectorKey: string
  fromMask: SectorConstraintMask
  toMask: SectorConstraintMask
}

export type LineDiff = {
  kind: 'line'
  lineKey: string
  from: LineMark
  to: LineMark
}

export type CellDiff = {
  kind: 'cell'
  cellKey: string
  fromFill: string | null
  toFill: string | null
}

export type TileDiff = {
  kind: 'tile'
  tileKey: string
  fromFill: string | null
  toFill: string | null
}

export type VertexDiff = {
  kind: 'vertex'
  vertexKey: string
  fromCandidates: VertexCandidate[]
  toCandidates: VertexCandidate[]
}

export type RuleDiff =
  | EdgeDiff
  | LineDiff
  | SectorDiff
  | CellDiff
  | TileDiff
  | VertexDiff

export type InferenceFocus = {
  cells?: string[]
  edges?: string[]
  lines?: string[]
  tiles?: string[]
  sectors?: string[]
  vertices?: string[]
}

export type InferenceContradiction = InferenceFocus & {
  kind: string
  message: string
}

export type TrialTraceStep = {
  ruleId: string
  ruleName: string
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedEdges: string[]
  affectedLines?: string[]
  affectedTiles?: string[]
  affectedSectors: string[]
}

export type InferenceBranch = {
  id: string
  label: string
  role?: 'trial' | 'forced-conclusion'
  initialDiffs: RuleDiff[]
  status: 'contradiction' | 'unresolved' | 'exhausted' | 'forced'
  traceSteps: TrialTraceStep[]
  contradiction?: InferenceContradiction
}

export type InferenceDetails = {
  kind:
    | 'slither-strong'
    | 'slither-color-assumption'
    | 'slither-sector-parity'
    | 'masyu-strong'
  conclusion: 'opposite-branch' | 'shared-consequence'
  basePuzzle: PuzzleIR
  defaultBranchId: string
  branches: InferenceBranch[]
}

export type RuleStep = {
  id: string
  ruleId: string
  ruleName: string
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedTiles?: string[]
  affectedEdges: string[]
  affectedLines?: string[]
  affectedSectors: string[]
  timestamp: number
  durationMs: number
  chainDurationMs?: number
  ruleApplyMs?: number
  ruleAttempts?: RuleAttempt[]
  inferenceDetails?: InferenceDetails
}

export type RuleApplication = {
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedTiles?: string[]
  affectedLines?: string[]
  affectedSectors?: string[]
  inferenceDetails?: InferenceDetails
}

export type RuleAttempt = {
  ruleId: string
  ruleName: string
  durationMs: number
  hit: boolean
}

export type RuleAttemptEvent = RuleAttempt & {
  solverStepNumber: number
  producedDiffCount: number
}

export type StrongInferenceOutcome = 'hit' | 'miss' | 'timeout'

export type StrongInferenceCompletedEvent = {
  solverStepNumber: number
  ruleId: string
  ruleName: string
  candidateCount: number
  probeCount: number
  trialStepCount: number
  probeDurationMs: number
  outcome: StrongInferenceOutcome
  producedDiffCount: number
}

export type SolverObserver = {
  onRuleAttemptCompleted?: (event: RuleAttemptEvent) => void
  onStrongInferenceCompleted?: (event: StrongInferenceCompletedEvent) => void
}

export type RunNextRuleOptions = {
  observer?: SolverObserver
}

export type RuleRuntimeContext = {
  cache: Map<string, unknown>
  solverStepNumber: number
  observer?: SolverObserver
}

export type Rule = {
  id: string
  name: string
  apply: (
    puzzle: PuzzleIR,
    runtimeContext?: RuleRuntimeContext,
  ) => RuleApplication | null
}
