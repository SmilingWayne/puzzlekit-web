import type { EdgeMark, LineMark, PuzzleIR, SectorConstraintMask, VertexCandidate } from '../ir/types'

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

export type RuleDiff = EdgeDiff | LineDiff | SectorDiff | CellDiff | TileDiff | VertexDiff

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
}

export type RuleApplication = {
  message: string
  diffs: RuleDiff[]
  affectedCells: string[]
  affectedTiles?: string[]
  affectedLines?: string[]
  affectedSectors?: string[]
}

export type Rule = {
  id: string
  name: string
  apply: (puzzle: PuzzleIR) => RuleApplication | null
}
