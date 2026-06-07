import { cellKey, edgeKey, getCellEdgeKeys, getCornerEdgeKeys, getVertexIncidentEdges, parseEdgeKey, parseSectorKey, vertexKey } from '../../../ir/keys'
import { runNextRule } from '../../engine'
import type { InferenceBranch, InferenceContradiction, Rule, TrialTraceStep } from '../../types'
import {
  SECTOR_MASK_ALL,
  sectorMaskAllows,
  sectorMaskIsValid,
  type EdgeMark,
  type PuzzleIR,
} from '../../../ir/types'
import {
  formatCellKeyLabel,
  formatCellLabel,
  formatEdgeLabel,
  formatSectorKeyLabel,
  formatVertexLabel,
  getEdgeAdjacentCellKeys,
  isSlitherCellColor,
} from './shared'

export type TrialContradictionReason = InferenceContradiction & {
  kind:
    | 'vertex-degree'
    | 'cell-clue'
    | 'sector-mask'
    | 'vertex-candidates'
    | 'color-edge'
    | 'line-loop'
    | 'disconnected-green'
  message: string
}

export type TrialResult = {
  contradiction: boolean
  timedOut: boolean
  exhausted: boolean
  puzzle: PuzzleIR
  stepsRun: number
  elapsedMs: number
  contradictionReason?: TrialContradictionReason
  traceSteps: TrialTraceStep[]
}

export const buildSlitherInferenceBranch = (
  id: string,
  label: string,
  assumptionDiffs: InferenceBranch['assumptionDiffs'],
  result: TrialResult,
): InferenceBranch => ({
  id,
  label,
  assumptionDiffs,
  status: result.contradiction ? 'contradiction' : result.exhausted ? 'exhausted' : 'unresolved',
  traceSteps: result.traceSteps,
  contradiction: result.contradictionReason,
})

export const applyEdgeAssumption = (puzzle: PuzzleIR, edgeKeyValue: string, to: EdgeMark): boolean => {
  const current = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown') {
    return current === to
  }
  puzzle.edges[edgeKeyValue].mark = to
  return true
}

const detectVertexContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  for (let r = 0; r <= puzzle.rows; r += 1) {
    for (let c = 0; c <= puzzle.cols; c += 1) {
      const incident = getVertexIncidentEdges(r, c, puzzle.rows, puzzle.cols)
      if (incident.length === 0) {
        continue
      }
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of incident) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > 2) {
        return {
          kind: 'vertex-degree',
          message: `vertex-degree contradiction at ${formatVertexLabel(r, c)}: ${lineCount} line edges meet there`,
          vertices: [vertexKey(r, c)],
        }
      }
      if (unknownCount === 0 && lineCount !== 0 && lineCount !== 2) {
        return {
          kind: 'vertex-degree',
          message: `vertex-degree contradiction at ${formatVertexLabel(r, c)}: closed vertex has ${lineCount} line edge`,
          vertices: [vertexKey(r, c)],
        }
      }
    }
  }
  return null
}

const detectCellClueContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const clue = puzzle.cells[cellKey(r, c)]?.clue
      if (clue?.kind !== 'number' || clue.value === '?') {
        continue
      }
      const target = Number(clue.value)
      const cellEdges = getCellEdgeKeys(r, c)
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of cellEdges) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > target) {
        return {
          kind: 'cell-clue',
          message: `cell-clue contradiction at ${formatCellLabel(r, c)}: clue ${target} already has ${lineCount} line edges`,
          cells: [cellKey(r, c)],
        }
      }
      if (lineCount + unknownCount < target) {
        return {
          kind: 'cell-clue',
          message: `cell-clue contradiction at ${formatCellLabel(r, c)}: clue ${target} can reach at most ${lineCount + unknownCount} line edges`,
          cells: [cellKey(r, c)],
        }
      }
    }
  }
  return null
}

const detectSectorContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (!sectorMaskIsValid(mask)) {
      return {
        kind: 'sector-mask',
        message: `sector-mask contradiction at ${formatSectorKeyLabel(sectorKeyValue)}: no corner line count remains allowed`,
        sectors: [sectorKeyValue],
      }
    }
    const [row, col, corner] = parseSectorKey(sectorKeyValue)
    const sectorEdges = getCornerEdgeKeys(row, col, corner)
    let lineCount = 0
    let unknownCount = 0
    for (const edgeKeyValue of sectorEdges) {
      const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
      if (mark === 'line') lineCount += 1
      else if (mark === 'unknown') unknownCount += 1
    }
    if (unknownCount === 0 && !sectorMaskAllows(mask, lineCount as 0 | 1 | 2)) {
      return {
        kind: 'sector-mask',
        message: `sector-mask contradiction at ${formatSectorKeyLabel(sectorKeyValue)}: fixed corner has ${lineCount} line edges, which the sector mask forbids`,
        sectors: [sectorKeyValue],
      }
    }
    let hasFeasible = false
    for (let value = lineCount; value <= lineCount + unknownCount; value += 1) {
      if (value <= 2 && sectorMaskAllows(mask, value as 0 | 1 | 2)) {
        hasFeasible = true
        break
      }
    }
    if (!hasFeasible) {
      return {
        kind: 'sector-mask',
        message: `sector-mask contradiction at ${formatSectorKeyLabel(sectorKeyValue)}: ${lineCount} fixed line edges and ${unknownCount} unknown edges leave no allowed corner count`,
        sectors: [sectorKeyValue],
      }
    }
  }
  return null
}

const detectVertexCandidateContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  for (const [vertexKeyValue, vertexState] of Object.entries(puzzle.vertices ?? {})) {
    if (vertexState.candidateEdgeSets.length === 0) {
      const [row, col] = vertexKeyValue.split(',').map(Number)
      return {
        kind: 'vertex-candidates',
        message: `vertex-candidates contradiction at ${formatVertexLabel(row, col)}: no feasible degree state remains`,
        vertices: [vertexKeyValue],
      }
    }
  }
  return null
}

const detectColorEdgeContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    const mark = edgeState?.mark ?? 'unknown'
    if (mark !== 'line' && mark !== 'blank') {
      continue
    }
    const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
    if (adjacentCells.length === 1) {
      const color = puzzle.cells[adjacentCells[0]]?.fill
      if (!isSlitherCellColor(color)) {
        continue
      }
      const expected = mark === 'line' ? 'green' : 'yellow'
      if (color !== expected) {
        return {
          kind: 'color-edge',
          message: `color-edge contradiction at ${formatEdgeLabel(edgeKeyValue)}: boundary ${mark} requires ${formatCellKeyLabel(adjacentCells[0])} to be ${expected}, but it is ${color}`,
          edges: [edgeKeyValue],
          cells: adjacentCells,
        }
      }
      continue
    }
    if (adjacentCells.length !== 2) {
      continue
    }
    const colorA = puzzle.cells[adjacentCells[0]]?.fill
    const colorB = puzzle.cells[adjacentCells[1]]?.fill
    if (!isSlitherCellColor(colorA) || !isSlitherCellColor(colorB)) {
      continue
    }
    if (mark === 'line' && colorA === colorB) {
      return {
        kind: 'color-edge',
        message: `color-edge contradiction at ${formatEdgeLabel(edgeKeyValue)}: a line edge separates equal-colored cells ${formatCellKeyLabel(adjacentCells[0])} and ${formatCellKeyLabel(adjacentCells[1])}`,
        edges: [edgeKeyValue],
        cells: adjacentCells,
      }
    }
    if (mark === 'blank' && colorA !== colorB) {
      return {
        kind: 'color-edge',
        message: `color-edge contradiction at ${formatEdgeLabel(edgeKeyValue)}: a blank edge connects different-colored cells ${formatCellKeyLabel(adjacentCells[0])} and ${formatCellKeyLabel(adjacentCells[1])}`,
        edges: [edgeKeyValue],
        cells: adjacentCells,
      }
    }
  }
  return null
}

const detectLineLoopContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  const lineEdges = Object.entries(puzzle.edges).filter(([, edgeState]) => (edgeState?.mark ?? 'unknown') === 'line')
  if (lineEdges.length === 0) {
    return null
  }
  const vertexCols = puzzle.cols + 1
  const vertexCount = (puzzle.rows + 1) * vertexCols
  const toVertexIndex = (row: number, col: number): number => row * vertexCols + col
  const parent = Array.from({ length: vertexCount }, (_, idx) => idx)
  const rank = new Array<number>(vertexCount).fill(0)
  const degree = new Map<number, number>()
  const find = (idx: number): number => {
    if (parent[idx] !== idx) {
      parent[idx] = find(parent[idx])
    }
    return parent[idx]
  }
  const union = (a: number, b: number): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA
    } else {
      parent[rootB] = rootA
      rank[rootA] += 1
    }
  }

  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  const componentEdgeCount = new Map<number, number>()
  const componentVertices = new Map<number, Set<number>>()
  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    const root = find(leftIdx)
    componentEdgeCount.set(root, (componentEdgeCount.get(root) ?? 0) + 1)
    const vertices = componentVertices.get(root) ?? new Set<number>()
    vertices.add(leftIdx)
    vertices.add(rightIdx)
    componentVertices.set(root, vertices)
  }

  let closedLoopEdges = 0
  let closedLoopComponents = 0
  for (const [root, vertices] of componentVertices.entries()) {
    const edgeCount = componentEdgeCount.get(root) ?? 0
    if (edgeCount !== vertices.size) {
      continue
    }
    let allDegreeTwo = true
    for (const vertexIdx of vertices) {
      if ((degree.get(vertexIdx) ?? 0) !== 2) {
        allDegreeTwo = false
        break
      }
    }
    if (!allDegreeTwo) {
      continue
    }
    closedLoopEdges += edgeCount
    closedLoopComponents += 1
  }
  if (closedLoopComponents > 1 || (closedLoopComponents === 1 && closedLoopEdges < lineEdges.length)) {
    return {
      kind: 'line-loop',
      message:
        closedLoopComponents > 1
          ? `line-loop contradiction: ${closedLoopComponents} separate closed loops are present`
          : `line-loop contradiction: a closed loop of ${closedLoopEdges} edges exists while other line edges remain outside it`,
      edges: lineEdges.map(([edgeKeyValue]) => edgeKeyValue),
    }
  }
  return null
}

const detectDisconnectedGreenContradiction = (puzzle: PuzzleIR): TrialContradictionReason | null => {
  const greenCells: string[] = []
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      if (puzzle.cells[key]?.fill === 'green') {
        greenCells.push(key)
      }
    }
  }
  if (greenCells.length < 2) {
    return null
  }

  const inBounds = (row: number, col: number): boolean =>
    row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols
  const passable = (key: string): boolean => puzzle.cells[key]?.fill !== 'yellow'
  const neighborSpecs: Array<{ dr: number; dc: number; edge: (row: number, col: number) => string }> = [
    { dr: -1, dc: 0, edge: (row, col) => edgeKey([row, col], [row, col + 1]) },
    { dr: 1, dc: 0, edge: (row, col) => edgeKey([row + 1, col], [row + 1, col + 1]) },
    { dr: 0, dc: -1, edge: (row, col) => edgeKey([row, col], [row + 1, col]) },
    { dr: 0, dc: 1, edge: (row, col) => edgeKey([row, col + 1], [row + 1, col + 1]) },
  ]

  const reachable = new Set<string>()
  const queue = [greenCells[0]]
  reachable.add(greenCells[0])
  for (let idx = 0; idx < queue.length; idx += 1) {
    const [row, col] = queue[idx].split(',').map(Number)
    for (const spec of neighborSpecs) {
      const neighborRow = row + spec.dr
      const neighborCol = col + spec.dc
      if (!inBounds(neighborRow, neighborCol)) {
        continue
      }
      if ((puzzle.edges[spec.edge(row, col)]?.mark ?? 'unknown') === 'line') {
        continue
      }
      const neighborKey = cellKey(neighborRow, neighborCol)
      if (!passable(neighborKey) || reachable.has(neighborKey)) {
        continue
      }
      reachable.add(neighborKey)
      queue.push(neighborKey)
    }
  }

  const disconnectedCell = greenCells.find((key) => !reachable.has(key))
  if (!disconnectedCell) {
    return null
  }
  return {
    kind: 'disconnected-green',
    message: `disconnected-green contradiction: ${formatCellKeyLabel(disconnectedCell)} cannot connect to ${formatCellKeyLabel(greenCells[0])} through non-line edges`,
    cells: [disconnectedCell, greenCells[0]],
  }
}

export const findHardContradictionReason = (puzzle: PuzzleIR): TrialContradictionReason | null =>
  detectVertexContradiction(puzzle) ??
  detectCellClueContradiction(puzzle) ??
  detectSectorContradiction(puzzle) ??
  detectVertexCandidateContradiction(puzzle) ??
  detectColorEdgeContradiction(puzzle) ??
  detectLineLoopContradiction(puzzle) ??
  detectDisconnectedGreenContradiction(puzzle)

export const detectHardContradiction = (puzzle: PuzzleIR): boolean =>
  findHardContradictionReason(puzzle) !== null

export const runTrialUntilFixpoint = (
  puzzle: PuzzleIR,
  deterministicRules: Rule[],
  maxTrialSteps: number,
  deadlineMs: number,
): TrialResult => {
  const startedAt = performance.now()
  const initialContradictionReason = findHardContradictionReason(puzzle)
  if (initialContradictionReason) {
    return {
      contradiction: true,
      timedOut: false,
      exhausted: false,
      puzzle,
      stepsRun: 0,
      elapsedMs: Math.max(0, performance.now() - startedAt),
      contradictionReason: initialContradictionReason,
      traceSteps: [],
    }
  }

  let trial = puzzle
  const traceSteps: TrialTraceStep[] = []
  for (let stepNumber = 1; stepNumber <= maxTrialSteps; stepNumber += 1) {
    if (Date.now() > deadlineMs) {
      return {
        contradiction: false,
        timedOut: true,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber - 1,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        traceSteps,
      }
    }
    const { nextPuzzle, step } = runNextRule(trial, deterministicRules, stepNumber)
    if (!step) {
      const contradictionReason = findHardContradictionReason(trial)
      return {
        contradiction: contradictionReason !== null,
        timedOut: false,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber - 1,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        contradictionReason: contradictionReason ?? undefined,
        traceSteps,
      }
    }
    trial = nextPuzzle
    traceSteps.push({
      ruleId: step.ruleId,
      ruleName: step.ruleName,
      message: step.message,
      diffs: step.diffs,
      affectedCells: step.affectedCells,
      affectedEdges: step.affectedEdges,
      affectedSectors: step.affectedSectors,
    })
    const contradictionReason = findHardContradictionReason(trial)
    if (contradictionReason) {
      return {
        contradiction: true,
        timedOut: false,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        contradictionReason,
        traceSteps,
      }
    }
  }
  return {
    contradiction: false,
    timedOut: false,
    exhausted: true,
    puzzle: trial,
    stepsRun: maxTrialSteps,
    elapsedMs: Math.max(0, performance.now() - startedAt),
    traceSteps,
  }
}
