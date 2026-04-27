import { getCellEdgeKeys, parseCellKey, parseEdgeKey } from '../../ir/keys'
import type { PuzzleIR } from '../../ir/types'

export type SlitherCompletionStatus = 'solved' | 'stalled'

export type SlitherCompletionStats = {
  totalEdges: number
  lineEdges: number
  blankEdges: number
  unknownEdges: number
  decidedEdges: number
  decidedEdgeRatio: number
}

export type SlitherCompletionReport = {
  status: SlitherCompletionStatus
  stats: SlitherCompletionStats
  reasons: string[]
}

const buildEdgeStats = (puzzle: PuzzleIR): SlitherCompletionStats => {
  let lineEdges = 0
  let blankEdges = 0
  let unknownEdges = 0

  for (const edge of Object.values(puzzle.edges)) {
    const mark = edge?.mark ?? 'unknown'
    if (mark === 'line') lineEdges += 1
    else if (mark === 'blank') blankEdges += 1
    else unknownEdges += 1
  }

  const totalEdges = lineEdges + blankEdges + unknownEdges
  const decidedEdges = lineEdges + blankEdges

  return {
    totalEdges,
    lineEdges,
    blankEdges,
    unknownEdges,
    decidedEdges,
    decidedEdgeRatio: totalEdges === 0 ? 0 : decidedEdges / totalEdges,
  }
}

const collectClueReasons = (puzzle: PuzzleIR): string[] => {
  let mismatchCount = 0
  let firstMismatch: string | null = null

  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'number' || cell.clue.value === '?') {
      continue
    }
    const clue = Number(cell.clue.value)
    const [row, col] = parseCellKey(key)
    const lineCount = getCellEdgeKeys(row, col).filter(
      (edgeKey) => (puzzle.edges[edgeKey]?.mark ?? 'unknown') === 'line',
    ).length
    if (lineCount === clue) {
      continue
    }
    mismatchCount += 1
    if (firstMismatch === null) {
      firstMismatch = `cell (${row}, ${col}) expects ${clue} line(s) but has ${lineCount}`
    }
  }

  if (mismatchCount === 0) {
    return []
  }
  return [
    `${mismatchCount} clue cell(s) are not satisfied${firstMismatch ? `; first: ${firstMismatch}.` : '.'}`,
  ]
}

const collectLoopReasons = (puzzle: PuzzleIR, lineEdgeCount: number): string[] => {
  if (lineEdgeCount === 0) {
    return ['No line edges have been drawn.']
  }

  const vertexCols = puzzle.cols + 1
  const vertexCount = (puzzle.rows + 1) * vertexCols
  const parent = Array.from({ length: vertexCount }, (_, idx) => idx)
  const rank = new Array<number>(vertexCount).fill(0)
  const degree = new Map<number, number>()
  const lineRoots = new Set<number>()
  const toVertexIndex = (row: number, col: number): number => row * vertexCols + col
  const toVertexLabel = (idx: number): string => {
    const row = Math.floor(idx / vertexCols)
    const col = idx % vertexCols
    return `(${row}, ${col})`
  }

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

  const lineEdges = Object.entries(puzzle.edges).filter(
    ([, edgeState]) => (edgeState?.mark ?? 'unknown') === 'line',
  )

  for (const [edgeKey] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKey)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  for (const [edgeKey] of lineEdges) {
    const [left] = parseEdgeKey(edgeKey)
    lineRoots.add(find(toVertexIndex(left[0], left[1])))
  }

  const reasons: string[] = []
  if (lineRoots.size !== 1) {
    reasons.push(`Line edges are split across ${lineRoots.size} connected component(s).`)
  }

  let invalidDegreeCount = 0
  let firstEndpoint: string | null = null
  let firstBranch: string | null = null
  let firstOther: string | null = null
  for (const [vertexIdx, count] of degree.entries()) {
    if (count === 2) {
      continue
    }
    invalidDegreeCount += 1
    if (count === 1 && firstEndpoint === null) {
      firstEndpoint = toVertexLabel(vertexIdx)
    } else if (count > 2 && firstBranch === null) {
      firstBranch = toVertexLabel(vertexIdx)
    } else if (firstOther === null) {
      firstOther = `${toVertexLabel(vertexIdx)} has degree ${count}`
    }
  }

  if (invalidDegreeCount > 0) {
    const examples = [firstEndpoint && `endpoint ${firstEndpoint}`, firstBranch && `branch ${firstBranch}`, firstOther]
      .filter(Boolean)
      .join(', ')
    reasons.push(
      `${invalidDegreeCount} line vertex/vertices do not have degree 2${examples ? `; first: ${examples}.` : '.'}`,
    )
  }

  return reasons
}

export const analyzeSlitherCompletion = (puzzle: PuzzleIR): SlitherCompletionReport => {
  const stats = buildEdgeStats(puzzle)
  const reasons = [...collectClueReasons(puzzle), ...collectLoopReasons(puzzle, stats.lineEdges)]

  return {
    status: reasons.length === 0 ? 'solved' : 'stalled',
    stats,
    reasons,
  }
}
