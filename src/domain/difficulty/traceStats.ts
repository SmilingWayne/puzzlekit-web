import type { PuzzleIR, VertexCandidate } from '../ir/types'
import { SECTOR_MASK_ALL } from '../ir/types'
import type { LiveStatsCoverageSource } from '../plugins/types'
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
  coverageRatios: Record<LiveStatsCoverageSource, number>
  stepDurationMs: number
  ruleApplyMs: number
}

export type TraceChartStats = {
  pointer: number
  totalSteps: number
  coverageTotals: Record<LiveStatsCoverageSource, number>
  current: TraceChartPoint
  points: TraceChartPoint[]
}

export type RuleTraceOccurrence = {
  ruleId: string
  ruleName: string
  steps: number[]
  durationPrefixMs: number[]
}

export type TraceStatsCache = {
  coverageTotals: Record<LiveStatsCoverageSource, number>
  coverageCounts: Record<LiveStatsCoverageSource, number>
  points: TraceChartPoint[]
  ruleOrder: string[]
  ruleOccurrences: Record<string, RuleTraceOccurrence>
  totalDurationPrefixMs: number[]
  totalDiffPrefixCounts: number[]
  diffPrefixCounts: Record<RuleDiff['kind'], number[]>
  edgeMarks: Record<string, string>
  lineMarks: Record<string, string>
  cellFills: Record<string, string | null>
  tileFills: Record<string, string | null>
  sectorMasks: Record<string, number>
  narrowedSectorKeys: Record<string, boolean>
  vertexCandidateSignatures: Record<string, string>
  initialVertexCandidateCounts: Record<string, number>
  initialVertexCandidateSignatures: Record<string, string>
  narrowedVertexKeys: Record<string, boolean>
}

export const emptyDiffCounts = (): RuleTraceDiffCounts => ({
  edge: 0,
  line: 0,
  sector: 0,
  cell: 0,
  tile: 0,
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

const getStepChainDurationMs = (step: RuleStep): number =>
  step.chainDurationMs ?? step.durationMs ?? 0

const getStepRuleApplyMs = (step: RuleStep): number =>
  step.ruleApplyMs ?? step.durationMs ?? 0

const clampPointer = (pointer: number, totalSteps: number): number => {
  if (!Number.isFinite(pointer)) {
    return 0
  }
  return Math.min(totalSteps, Math.max(0, Math.floor(pointer)))
}

export const buildRuleTraceStats = (
  steps: RuleStep[],
  pointer: number,
): RuleTraceStats => {
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
    const ruleApplyMs = getStepRuleApplyMs(step)
    ruleDurations[step.ruleId] = (ruleDurations[step.ruleId] ?? 0) + ruleApplyMs
    totalDurationMs += getStepChainDurationMs(step)

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

const ratio = (count: number, total: number): number =>
  total <= 0 ? 0 : count / total

const vertexSignature = (candidates: VertexCandidate[] | undefined): string =>
  JSON.stringify(
    (candidates ?? [])
      .map((candidate) => [...candidate].sort())
      .sort(
        (a, b) => a.length - b.length || a.join('|').localeCompare(b.join('|')),
      ),
  )

const makeChartPoint = (
  step: number,
  cache: Pick<TraceStatsCache, 'coverageCounts' | 'coverageTotals'>,
  stepDurationMs = 0,
  ruleApplyMs = 0,
): TraceChartPoint => ({
  step,
  coverageRatios: Object.fromEntries(
    (Object.keys(cache.coverageTotals) as LiveStatsCoverageSource[]).map((source) => [
      source,
      ratio(cache.coverageCounts[source], cache.coverageTotals[source]),
    ]),
  ) as Record<LiveStatsCoverageSource, number>,
  stepDurationMs,
  ruleApplyMs,
})

const countInitialFilledCells = (puzzle: PuzzleIR): number =>
  Object.values(puzzle.cells).filter(
    (cell) => cell.fill !== undefined && cell.fill !== null,
  ).length

const countDecidedMarks = (
  marks: Record<string, { mark: string }>,
): number => Object.values(marks).filter((item) => item.mark !== 'unknown').length

const emptyCoverageRecord = (): Record<LiveStatsCoverageSource, number> => ({
  edge: 0,
  line: 0,
  cell: 0,
  tile: 0,
  vertex: 0,
  sector: 0,
})

const upperBound = (values: number[], target: number): number => {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (values[mid] <= target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

export const createTraceStatsCache = (
  initialPuzzle: PuzzleIR,
): TraceStatsCache => {
  const edgeMarks: Record<string, string> = {}
  const lineMarks: Record<string, string> = {}
  const cellFills: Record<string, string | null> = {}
  const tileFills: Record<string, string | null> = {}
  const sectorMasks: Record<string, number> = {}
  const narrowedSectorKeys: Record<string, boolean> = {}
  const vertexCandidateSignatures: Record<string, string> = {}
  const initialVertexCandidateCounts: Record<string, number> = {}
  const initialVertexCandidateSignatures: Record<string, string> = {}
  const narrowedVertexKeys: Record<string, boolean> = {}

  for (const [key, edge] of Object.entries(initialPuzzle.edges)) {
    edgeMarks[key] = edge?.mark ?? 'unknown'
  }
  for (const [key, line] of Object.entries(initialPuzzle.lines)) {
    lineMarks[key] = line?.mark ?? 'unknown'
  }
  for (const [key, cell] of Object.entries(initialPuzzle.cells)) {
    cellFills[key] = cell.fill ?? null
  }
  for (const [key, tile] of Object.entries(initialPuzzle.tiles)) {
    tileFills[key] = tile.fill ?? null
  }
  for (const [key, sector] of Object.entries(initialPuzzle.sectors)) {
    const mask = sector.constraintsMask ?? SECTOR_MASK_ALL
    sectorMasks[key] = mask
    narrowedSectorKeys[key] = mask !== SECTOR_MASK_ALL
  }
  for (const [key, vertex] of Object.entries(initialPuzzle.vertices)) {
    const candidates = vertex?.candidateEdgeSets ?? []
    const signature = vertexSignature(candidates)
    vertexCandidateSignatures[key] = signature
    initialVertexCandidateCounts[key] = candidates.length
    initialVertexCandidateSignatures[key] = signature
    narrowedVertexKeys[key] = false
  }

  const coverageTotals: Record<LiveStatsCoverageSource, number> = {
    edge: Object.keys(initialPuzzle.edges).length,
    line: Object.keys(initialPuzzle.lines).length,
    cell: initialPuzzle.rows * initialPuzzle.cols,
    tile: Object.keys(initialPuzzle.tiles).length,
    vertex: Object.keys(initialPuzzle.vertices).length,
    sector: Object.keys(initialPuzzle.sectors).length,
  }
  const coverageCounts: Record<LiveStatsCoverageSource, number> = {
    ...emptyCoverageRecord(),
    edge: countDecidedMarks(initialPuzzle.edges),
    line: countDecidedMarks(initialPuzzle.lines),
    cell: countInitialFilledCells(initialPuzzle),
    tile: Object.values(initialPuzzle.tiles).filter((tile) => tile.fill != null).length,
    sector: Object.values(initialPuzzle.sectors).filter(
      (sector) => sector.constraintsMask !== SECTOR_MASK_ALL,
    ).length,
  }

  const cacheBase = {
    coverageTotals,
    coverageCounts,
    edgeMarks,
    lineMarks,
    cellFills,
    tileFills,
    sectorMasks,
    narrowedSectorKeys,
    vertexCandidateSignatures,
    initialVertexCandidateCounts,
    initialVertexCandidateSignatures,
    narrowedVertexKeys,
  }

  return {
    ...cacheBase,
    points: [makeChartPoint(0, cacheBase)],
    ruleOrder: [],
    ruleOccurrences: {},
    totalDurationPrefixMs: [0],
    totalDiffPrefixCounts: [0],
    diffPrefixCounts: {
      edge: [0],
      line: [0],
      sector: [0],
      cell: [0],
      tile: [0],
      vertex: [0],
    },
  }
}

export const appendTraceStatsStep = (
  cache: TraceStatsCache,
  step: RuleStep,
): TraceStatsCache => {
  const stepNumber = cache.points.length
  const next: TraceStatsCache = {
    ...cache,
  }

  let edgeDiffs = 0
  let lineDiffs = 0
  let sectorDiffs = 0
  let cellDiffs = 0
  let tileDiffs = 0
  let vertexDiffs = 0

  for (const diff of step.diffs) {
    if (diff.kind === 'edge' || diff.kind === 'line') {
      const key = diff.kind === 'edge' ? diff.edgeKey : diff.lineKey
      const source = diff.kind
      const marks = diff.kind === 'edge' ? next.edgeMarks : next.lineMarks
      if (diff.kind === 'edge') {
        edgeDiffs += 1
      } else {
        lineDiffs += 1
      }
      const previous = marks[key] ?? diff.from ?? 'unknown'
      const previousDecided = previous !== 'unknown'
      const nextDecided = diff.to !== 'unknown'
      if (!previousDecided && nextDecided) {
        next.coverageCounts[source] += 1
      } else if (previousDecided && !nextDecided) {
        next.coverageCounts[source] -= 1
      }
      marks[key] = diff.to
    } else if (diff.kind === 'cell') {
      cellDiffs += 1
      const previous = next.cellFills[diff.cellKey] ?? null
      const previousFilled = previous !== null
      const nextFilled = diff.toFill !== null
      if (!previousFilled && nextFilled) {
        next.coverageCounts.cell += 1
      } else if (previousFilled && !nextFilled) {
        next.coverageCounts.cell -= 1
      }
      next.cellFills[diff.cellKey] = diff.toFill
    } else if (diff.kind === 'tile') {
      tileDiffs += 1
      const previous = next.tileFills[diff.tileKey] ?? null
      const previousFilled = previous !== null
      const nextFilled = diff.toFill !== null
      if (!previousFilled && nextFilled) {
        next.coverageCounts.tile += 1
      } else if (previousFilled && !nextFilled) {
        next.coverageCounts.tile -= 1
      }
      next.tileFills[diff.tileKey] = diff.toFill
    } else if (diff.kind === 'vertex') {
      vertexDiffs += 1
      const signature = vertexSignature(diff.toCandidates)
      const initialCount =
        next.initialVertexCandidateCounts[diff.vertexKey] ?? 0
      const initialSignature =
        next.initialVertexCandidateSignatures[diff.vertexKey] ?? '[]'
      const wasNarrowed = next.narrowedVertexKeys[diff.vertexKey] ?? false
      const isNarrowed =
        diff.toCandidates.length < initialCount ||
        signature !== initialSignature
      if (!wasNarrowed && isNarrowed) {
        next.coverageCounts.vertex += 1
      } else if (wasNarrowed && !isNarrowed) {
        next.coverageCounts.vertex -= 1
      }
      next.narrowedVertexKeys[diff.vertexKey] = isNarrowed
      next.vertexCandidateSignatures[diff.vertexKey] = signature
    } else {
      sectorDiffs += 1
      const wasNarrowed = next.narrowedSectorKeys[diff.sectorKey] ?? false
      const isNarrowed = diff.toMask !== SECTOR_MASK_ALL
      if (!wasNarrowed && isNarrowed) {
        next.coverageCounts.sector += 1
      } else if (wasNarrowed && !isNarrowed) {
        next.coverageCounts.sector -= 1
      }
      next.narrowedSectorKeys[diff.sectorKey] = isNarrowed
      next.sectorMasks[diff.sectorKey] = diff.toMask
    }
  }

  if (next.ruleOccurrences[step.ruleId] === undefined) {
    next.ruleOrder.push(step.ruleId)
    next.ruleOccurrences[step.ruleId] = {
      ruleId: step.ruleId,
      ruleName: step.ruleName,
      steps: [],
      durationPrefixMs: [0],
    }
  }
  const occurrence = next.ruleOccurrences[step.ruleId]
  occurrence.steps.push(stepNumber)
  occurrence.durationPrefixMs.push(
    occurrence.durationPrefixMs[occurrence.durationPrefixMs.length - 1] +
      getStepRuleApplyMs(step),
  )

  next.totalDurationPrefixMs.push(
    next.totalDurationPrefixMs[next.totalDurationPrefixMs.length - 1] +
      getStepChainDurationMs(step),
  )
  next.totalDiffPrefixCounts.push(
    next.totalDiffPrefixCounts[next.totalDiffPrefixCounts.length - 1] +
      step.diffs.length,
  )
  next.diffPrefixCounts.edge.push(
    next.diffPrefixCounts.edge[next.diffPrefixCounts.edge.length - 1] +
      edgeDiffs,
  )
  next.diffPrefixCounts.line.push(
    next.diffPrefixCounts.line[next.diffPrefixCounts.line.length - 1] +
      lineDiffs,
  )
  next.diffPrefixCounts.sector.push(
    next.diffPrefixCounts.sector[next.diffPrefixCounts.sector.length - 1] +
      sectorDiffs,
  )
  next.diffPrefixCounts.cell.push(
    next.diffPrefixCounts.cell[next.diffPrefixCounts.cell.length - 1] +
      cellDiffs,
  )
  next.diffPrefixCounts.tile.push(
    next.diffPrefixCounts.tile[next.diffPrefixCounts.tile.length - 1] +
      tileDiffs,
  )
  next.diffPrefixCounts.vertex.push(
    next.diffPrefixCounts.vertex[next.diffPrefixCounts.vertex.length - 1] +
      vertexDiffs,
  )
  next.points.push(
    makeChartPoint(
      stepNumber,
      next,
      getStepChainDurationMs(step),
      getStepRuleApplyMs(step),
    ),
  )

  return { ...next }
}

export const rebuildTraceStatsCache = (
  initialPuzzle: PuzzleIR,
  steps: RuleStep[] = [],
): TraceStatsCache =>
  steps.reduce(appendTraceStatsStep, createTraceStatsCache(initialPuzzle))

export const truncateTraceStatsCache = (
  initialPuzzle: PuzzleIR,
  cache: TraceStatsCache,
  steps: RuleStep[],
  pointer: number,
): TraceStatsCache => {
  const clampedPointer = clampPointer(pointer, steps.length)
  if (
    clampedPointer === steps.length &&
    cache.points.length === steps.length + 1
  ) {
    return cache
  }
  return rebuildTraceStatsCache(initialPuzzle, steps.slice(0, clampedPointer))
}

export const buildTraceStatsView = (
  cache: TraceStatsCache,
  pointer: number,
): RuleTraceStats & TraceChartStats => {
  const totalSteps = Math.max(0, cache.points.length - 1)
  const currentPointer = clampPointer(pointer, totalSteps)
  const ruleUsage: Record<string, number> = {}
  const ruleSteps: Record<string, number[]> = {}
  const rules = cache.ruleOrder.map((ruleId) => {
    const occurrence = cache.ruleOccurrences[ruleId]
    const count = upperBound(occurrence.steps, currentPointer)
    const steps = occurrence.steps.slice(0, count)
    const durationMs = occurrence.durationPrefixMs[count] ?? 0
    ruleUsage[ruleId] = count
    ruleSteps[ruleId] = steps
    return {
      ruleId,
      ruleName: occurrence.ruleName,
      count,
      percent: currentPointer > 0 ? count / currentPointer : 0,
      durationMs,
      steps,
    }
  })

  const activeRuleUsage = Object.fromEntries(
    Object.entries(ruleUsage).filter(([, count]) => count > 0),
  )

  return {
    pointer: currentPointer,
    totalSteps,
    traceProgressRatio: totalSteps > 0 ? currentPointer / totalSteps : 0,
    totalRuleApplications: currentPointer,
    totalDurationMs: cache.totalDurationPrefixMs[currentPointer] ?? 0,
    totalDiffs: cache.totalDiffPrefixCounts[currentPointer] ?? 0,
    uniqueRulesUsed: Object.keys(activeRuleUsage).length,
    diffCounts: {
      edge: cache.diffPrefixCounts.edge[currentPointer] ?? 0,
      line: cache.diffPrefixCounts.line[currentPointer] ?? 0,
      sector: cache.diffPrefixCounts.sector[currentPointer] ?? 0,
      cell: cache.diffPrefixCounts.cell[currentPointer] ?? 0,
      tile: cache.diffPrefixCounts.tile[currentPointer] ?? 0,
      vertex: cache.diffPrefixCounts.vertex[currentPointer] ?? 0,
    },
    ruleUsage,
    ruleSteps,
    rules,
    coverageTotals: cache.coverageTotals,
    current: cache.points[currentPointer] ?? cache.points[0],
    points: cache.points,
  }
}

export const buildTraceChartStats = (
  initialPuzzle: PuzzleIR,
  steps: RuleStep[],
  pointer: number,
): TraceChartStats => {
  const cache = rebuildTraceStatsCache(initialPuzzle, steps)
  const view = buildTraceStatsView(cache, pointer)
  return {
    pointer: view.pointer,
    totalSteps: view.totalSteps,
    coverageTotals: view.coverageTotals,
    current: view.current,
    points: view.points,
  }
}
