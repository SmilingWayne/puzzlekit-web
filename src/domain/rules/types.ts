import type { EdgeMark, PuzzleIR } from '../ir/types'

export type EdgeDiff = {
  edgeKey: string
  from: EdgeMark
  to: EdgeMark
}

export type RuleStep = {
  id: string
  ruleId: string
  ruleName: string
  message: string
  diffs: EdgeDiff[]
  affectedCells: string[]
  affectedEdges: string[]
  timestamp: number
}

export type RuleApplication = {
  message: string
  diffs: EdgeDiff[]
  affectedCells: string[]
}

export type Rule = {
  id: string
  name: string
  apply: (puzzle: PuzzleIR) => RuleApplication | null
}
