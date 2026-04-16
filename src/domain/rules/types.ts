import type { EdgeMark, PuzzleIR, SectorMark } from '../ir/types'

export type EdgeDiff = {
  kind: 'edge'
  edgeKey: string
  from: EdgeMark
  to: EdgeMark
}

export type SectorDiff = {
  kind: 'sector'
  sectorKey: string
  from: SectorMark
  to: SectorMark
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
