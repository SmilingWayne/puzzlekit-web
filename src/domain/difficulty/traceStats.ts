import type { PuzzleIR, VertexCandidate } from '../ir/types'
import type { RuleDiff, RuleStep } from '../rules/types'

export type RuleTraceDiffCounts = Record<RuleDiff['kind'], number>

export type RuleTraceSummary = {
  ruleId: string
  ruleName: string
  count: number
  percent: number
  durationMs: number
  steps: number[]
}

export type RuleTraceStats = {
  pointer: number
  totalSteps: number
  traceProgressRatio: number
  totalRuleApplications: number
  totalDurationMs: number
  totalDiffs: number
  uniqueRulesUsed: number
  diffCounts: RuleTraceDiffCounts
  ruleUsage: Record<string, number>
  ruleSteps: Record<string, number[]>
  rules: RuleTraceSummary[]
}

export type TraceChartPoint = {
  step: number
  boardProgressRatio: number
  edgeCoverageRatio: number
  cellCoverageRatio: number
  vertexCoverageRatio: number
}

export type TraceChartStats = {
  pointer: number
  totalSteps: number
  totalEdges: number
  totalCells: number
  totalVertices: number
  current: TraceChartPoint
  points: TraceChartPoint[]
}

export const emptyDiffCounts = (): RuleTraceDiffCounts => ({
  edge: 0,
  sector: 0,
  cell: 0,
  vertex: 0,
})

export const addRuleUsage = (
  ruleUsage: Record<string, number>,
  ruleSteps: Record<string, number[]>,
  step: RuleStep,
  stepNumber: number,
): void => {
  ruleUsage[step.ruleId] = (ruleUsage[step.ruleId] ?? 0) + 1
  ruleSteps[step.ruleId] = [...(ruleSteps[step.ruleId] ?? []), stepNumber]
}

const clampPointer = (pointer: number, totalSteps: number): number => {
  if (!Number.isFinite(pointer)) {
    return 0
  }
  return Math.min(totalSteps, Math.max(0, Math.floor(pointer)))
}

export const buildRuleTraceStats = (steps: RuleStep[], pointer: number): RuleTraceStats => {
  const currentPointer = clampPointer(pointer, steps.length)
  const activeSteps = steps.slice(0, currentPointer)
  const ruleOrder: string[] = []
  const ruleNames: Record<string, string> = {}
  const ruleUsage: Record<string, number> = {}
  const ruleSteps: Record<string, number[]> = {}
  const ruleDurations: Record<string, number> = {}
  const diffCounts = emptyDiffCounts()
  let totalDurationMs = 0
  let totalDiffs = 0

  for (const step of steps) {
    if (ruleNames[step.ruleId] === undefined) {
      ruleOrder.push(step.ruleId)
      ruleNames[step.ruleId] = step.ruleName
    }
  }

  activeSteps.forEach((step, index) => {
    const stepNumber = index + 1
    addRuleUsage(ruleUsage, ruleSteps, step, stepNumber)
    const durationMs = step.durationMs ?? 0
    ruleDurations[step.ruleId] = (ruleDurations[step.ruleId] ?? 0) + durationMs
    totalDurationMs += durationMs

    for (const diff of step.diffs) {
      diffCounts[diff.kind] += 1
      totalDiffs += 1
    }
  })

  const rules = ruleOrder.map((ruleId) => {
    const count = ruleUsage[ruleId] ?? 0
    return {
      ruleId,
      ruleName: ruleNames[ruleId] ?? ruleId,
      count,
      percent: currentPointer > 0 ? count / currentPointer : 0,
      durationMs: ruleDurations[ruleId] ?? 0,
      steps: ruleSteps[ruleId] ?? [],
    }
  })

  return {
    pointer: currentPointer,
    totalSteps: steps.length,
    traceProgressRatio: steps.length > 0 ? currentPointer / steps.length : 0,
    totalRuleApplications: currentPointer,
    totalDurationMs,
    totalDiffs,
    uniqueRulesUsed: Object.keys(ruleUsage).length,
    diffCounts,
    ruleUsage,
    ruleSteps,
    rules,
  }
}

const ratio = (count: number, total: number): number => (total <= 0 ? 0 : count / total)

const vertexSignature = (candidates: VertexCandidate[] | undefined): string =>
  JSON.stringify(
    (candidates ?? [])
      .map((candidate) => [...candidate].sort())
      .sort((a, b) => a.length - b.length || a.join('|').localeCompare(b.join('|'))),
  )

export const buildTraceChartStats = (
  initialPuzzle: PuzzleIR,
  steps: RuleStep[],
  pointer: number,
): TraceChartStats => {
  const currentPointer = clampPointer(pointer, steps.length)
  const totalEdges = Object.keys(initialPuzzle.edges).length
  const totalCells = initialPuzzle.rows * initialPuzzle.cols
  const totalVertices = Object.keys(initialPuzzle.vertices).length

  const edgeMarks: Record<string, string> = {}
  const cellFills: Record<string, string | null> = {}
  const initialVertexCandidateCounts: Record<string, number> = {}
  const initialVertexSignatures: Record<string, string> = {}
  const vertexCandidates: Record<string, VertexCandidate[]> = {}

  for (const [key, edge] of Object.entries(initialPuzzle.edges)) {
    edgeMarks[key] = edge?.mark ?? 'unknown'
  }
  for (const [key, cell] of Object.entries(initialPuzzle.cells)) {
    cellFills[key] = cell.fill ?? null
  }
  for (const [key, vertex] of Object.entries(initialPuzzle.vertices)) {
    const candidates = vertex?.candidateEdgeSets ?? []
    initialVertexCandidateCounts[key] = candidates.length
    initialVertexSignatures[key] = vertexSignature(candidates)
    vertexCandidates[key] = candidates.map((candidate) => [...candidate])
  }

  const makePoint = (step: number): TraceChartPoint => {
    const decidedEdges = Object.values(edgeMarks).filter((mark) => mark !== 'unknown').length
    const filledCells = Object.values(cellFills).filter((fill) => fill !== null).length
    const narrowedVertices = Object.entries(vertexCandidates).filter(([key, candidates]) => {
      const initialCount = initialVertexCandidateCounts[key] ?? 0
      return candidates.length < initialCount || vertexSignature(candidates) !== initialVertexSignatures[key]
    }).length

    return {
      step,
      boardProgressRatio: ratio(decidedEdges, totalEdges),
      edgeCoverageRatio: ratio(decidedEdges, totalEdges),
      cellCoverageRatio: ratio(filledCells, totalCells),
      vertexCoverageRatio: ratio(narrowedVertices, totalVertices),
    }
  }

  const points: TraceChartPoint[] = [makePoint(0)]
  steps.forEach((step, index) => {
    for (const diff of step.diffs) {
      if (diff.kind === 'edge') {
        edgeMarks[diff.edgeKey] = diff.to
      } else if (diff.kind === 'cell') {
        cellFills[diff.cellKey] = diff.toFill
      } else if (diff.kind === 'vertex') {
        vertexCandidates[diff.vertexKey] = diff.toCandidates.map((candidate) => [...candidate])
      }
    }
    points.push(makePoint(index + 1))
  })

  return {
    pointer: currentPointer,
    totalSteps: steps.length,
    totalEdges,
    totalCells,
    totalVertices,
    current: points[currentPointer] ?? points[0],
    points,
  }
}
