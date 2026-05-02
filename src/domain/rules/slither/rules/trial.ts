import { cellKey, edgeKey, getCellEdgeKeys, getCornerEdgeKeys, getVertexIncidentEdges, parseEdgeKey, parseSectorKey } from '../../../ir/keys'
import { runNextRule } from '../../engine'
import type { Rule } from '../../types'
import {
  SECTOR_MASK_ALL,
  sectorMaskAllows,
  sectorMaskIsValid,
  type EdgeMark,
  type PuzzleIR,
} from '../../../ir/types'
import { getEdgeAdjacentCellKeys, isSlitherCellColor } from './shared'

export type TrialResult = {
  contradiction: boolean
  timedOut: boolean
  exhausted: boolean
  puzzle: PuzzleIR
}

export const applyEdgeAssumption = (puzzle: PuzzleIR, edgeKeyValue: string, to: EdgeMark): boolean => {
  const current = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown') {
    return current === to
  }
  puzzle.edges[edgeKeyValue].mark = to
  return true
}

const detectVertexContradiction = (puzzle: PuzzleIR): boolean => {
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
        return true
      }
      if (unknownCount === 0 && lineCount !== 0 && lineCount !== 2) {
        return true
      }
    }
  }
  return false
}

const detectCellClueContradiction = (puzzle: PuzzleIR): boolean => {
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
      if (lineCount > target || lineCount + unknownCount < target) {
        return true
      }
    }
  }
  return false
}

const detectSectorContradiction = (puzzle: PuzzleIR): boolean => {
  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (!sectorMaskIsValid(mask)) {
      return true
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
      return true
    }
    let hasFeasible = false
    for (let value = lineCount; value <= lineCount + unknownCount; value += 1) {
      if (value <= 2 && sectorMaskAllows(mask, value as 0 | 1 | 2)) {
        hasFeasible = true
        break
      }
    }
    if (!hasFeasible) {
      return true
    }
  }
  return false
}

const detectColorEdgeContradiction = (puzzle: PuzzleIR): boolean => {
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
        return true
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
      return true
    }
    if (mark === 'blank' && colorA !== colorB) {
      return true
    }
  }
  return false
}

const detectLineLoopContradiction = (puzzle: PuzzleIR): boolean => {
  const lineEdges = Object.entries(puzzle.edges).filter(([, edgeState]) => (edgeState?.mark ?? 'unknown') === 'line')
  if (lineEdges.length === 0) {
    return false
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
  if (closedLoopComponents > 1) {
    return true
  }
  if (closedLoopComponents === 1 && closedLoopEdges < lineEdges.length) {
    return true
  }
  return false
}

const detectDisconnectedGreenContradiction = (puzzle: PuzzleIR): boolean => {
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
    return false
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

  return greenCells.some((key) => !reachable.has(key))
}

export const detectHardContradiction = (puzzle: PuzzleIR): boolean =>
  detectVertexContradiction(puzzle) ||
  detectCellClueContradiction(puzzle) ||
  detectSectorContradiction(puzzle) ||
  detectColorEdgeContradiction(puzzle) ||
  detectLineLoopContradiction(puzzle) ||
  detectDisconnectedGreenContradiction(puzzle)

export const runTrialUntilFixpoint = (
  puzzle: PuzzleIR,
  deterministicRules: Rule[],
  maxTrialSteps: number,
  deadlineMs: number,
): TrialResult => {
  if (detectHardContradiction(puzzle)) {
    return { contradiction: true, timedOut: false, exhausted: false, puzzle }
  }

  let trial = puzzle
  for (let stepNumber = 1; stepNumber <= maxTrialSteps; stepNumber += 1) {
    if (Date.now() > deadlineMs) {
      return { contradiction: false, timedOut: true, exhausted: false, puzzle: trial }
    }
    const { nextPuzzle, step } = runNextRule(trial, deterministicRules, stepNumber)
    if (!step) {
      return {
        contradiction: detectHardContradiction(trial),
        timedOut: false,
        exhausted: false,
        puzzle: trial,
      }
    }
    trial = nextPuzzle
    if (detectHardContradiction(trial)) {
      return { contradiction: true, timedOut: false, exhausted: false, puzzle: trial }
    }
  }
  return { contradiction: false, timedOut: false, exhausted: true, puzzle: trial }
}
