import type { EdgeMark, PuzzleIR, SectorConstraintMask } from '../ir/types'

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

export type RuleDiff = EdgeDiff | SectorDiff

export type RuleStep = {
  id: string
  ruleId: string
  ruleName: string
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedEdges: string[]
  affectedSectors: string[]
  timestamp: number
}

export type RuleApplication = {
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedSectors?: string[]
}

export type Rule = {
  id: string
  name: string
  apply: (puzzle: PuzzleIR) => RuleApplication | null
}
