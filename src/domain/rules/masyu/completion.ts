import { cellKey, parseCellKey, parseLineKey } from '../../ir/keys'
import type { PuzzleIR } from '../../ir/types'
import type { CompletionReport, CompletionStats, CompletionStatus } from '../completion'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  formatMasyuCellKeyLabel,
  getMasyuDirectionalLine,
  getMasyuIncidentDirectionalLines,
  getMasyuTwoStepLine,
  type MasyuDirection,
} from './rules/shared'

export type MasyuCompletionStatus = CompletionStatus

export type MasyuCompletionStats = CompletionStats & {
  totalLines: number
  lineLines: number
  blankLines: number
  unknownLines: number
  decidedLines: number
  decidedLineRatio: number
}

export type MasyuCompletionReport = CompletionReport & { stats: MasyuCompletionStats }

const buildLineStats = (puzzle: PuzzleIR): MasyuCompletionStats => {
  let lineLines = 0
  let blankLines = 0
  let unknownLines = 0

  for (const line of Object.values(puzzle.lines)) {
    const mark = line?.mark ?? 'unknown'
    if (mark === 'line') lineLines += 1
    else if (mark === 'blank') blankLines += 1
    else unknownLines += 1
  }

  const totalLines = lineLines + blankLines + unknownLines
  const decidedLines = lineLines + blankLines
  const decidedLineRatio = totalLines === 0 ? 0 : decidedLines / totalLines

  return {
    totalUnits: totalLines,
    lineUnits: lineLines,
    blankUnits: blankLines,
    unknownUnits: unknownLines,
    decidedUnits: decidedLines,
    decidedRatio: decidedLineRatio,
    unitLabel: 'Lines',
    totalLines,
    lineLines,
    blankLines,
    unknownLines,
    decidedLines,
    decidedLineRatio,
  }
}

const toCellIndex = (puzzle: PuzzleIR, key: string): number => {
  const [row, col] = parseCellKey(key)
  return row * puzzle.cols + col
}

const toCellLabel = (puzzle: PuzzleIR, idx: number): string => {
  const row = Math.floor(idx / puzzle.cols)
  const col = idx % puzzle.cols
  return formatMasyuCellKeyLabel(cellKey(row, col))
}

const collectLoopReasons = (puzzle: PuzzleIR, lineCount: number): string[] => {
  if (lineCount === 0) {
    return ['No line segments have been drawn.']
  }

  const cellCount = puzzle.rows * puzzle.cols
  const parent = Array.from({ length: cellCount }, (_, idx) => idx)
  const rank = new Array<number>(cellCount).fill(0)
  const degree = new Map<number, number>()
  const lineRoots = new Set<number>()
  const lineEntries = Object.entries(puzzle.lines).filter(([, line]) => (line?.mark ?? 'unknown') === 'line')

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

  for (const [lineKey] of lineEntries) {
    const [left, right] = parseLineKey(lineKey)
    const leftKey = cellKey(left[0], left[1])
    const rightKey = cellKey(right[0], right[1])
    const leftIdx = toCellIndex(puzzle, leftKey)
    const rightIdx = toCellIndex(puzzle, rightKey)
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  for (const [lineKey] of lineEntries) {
    const [left] = parseLineKey(lineKey)
    lineRoots.add(find(toCellIndex(puzzle, cellKey(left[0], left[1]))))
  }

  const reasons: string[] = []
  if (lineRoots.size !== 1) {
    reasons.push(`Line segments are split across ${lineRoots.size} connected component(s), indicating disconnected paths or sub-loops.`)
  }

  let invalidDegreeCount = 0
  let firstEndpoint: string | null = null
  let firstBranch: string | null = null
  let firstOther: string | null = null
  for (const [cellIdx, count] of degree.entries()) {
    if (count === 2) {
      continue
    }
    invalidDegreeCount += 1
    if (count === 1 && firstEndpoint === null) {
      firstEndpoint = toCellLabel(puzzle, cellIdx)
    } else if (count > 2 && firstBranch === null) {
      firstBranch = toCellLabel(puzzle, cellIdx)
    } else if (firstOther === null) {
      firstOther = `${toCellLabel(puzzle, cellIdx)} has degree ${count}`
    }
  }

  if (invalidDegreeCount > 0) {
    const examples = [firstEndpoint && `endpoint ${firstEndpoint}`, firstBranch && `branch ${firstBranch}`, firstOther]
      .filter(Boolean)
      .join(', ')
    reasons.push(
      `${invalidDegreeCount} line cell(s) do not have degree 2${examples ? `; first: ${examples}.` : '.'}`,
    )
  }

  return reasons
}

const getLineDirectionsAtCell = (puzzle: PuzzleIR, key: string): MasyuDirection[] =>
  Object.values(getMasyuIncidentDirectionalLines(puzzle, key)).flatMap((item) =>
    item && item.mark === 'line' ? [item.direction] : [],
  )

const sideTurnsAfterWhitePearl = (
  puzzle: PuzzleIR,
  pearlKey: string,
  direction: MasyuDirection,
): boolean => {
  const first = getMasyuDirectionalLine(puzzle, pearlKey, direction)
  if (!first || first.mark !== 'line') {
    return false
  }
  return getLineDirectionsAtCell(puzzle, first.neighborKey).some((neighborDirection) =>
    areMasyuDirectionsTurn(neighborDirection, direction),
  )
}

const collectPearlReasons = (puzzle: PuzzleIR): string[] => {
  let invalidBlackCount = 0
  let firstInvalidBlack: string | null = null
  let invalidWhiteCount = 0
  let firstInvalidWhite: string | null = null

  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'pearl') {
      continue
    }
    const lineDirections = getLineDirectionsAtCell(puzzle, key)

    if (cell.clue.color === 'black') {
      const valid =
        lineDirections.length === 2 &&
        areMasyuDirectionsTurn(lineDirections[0], lineDirections[1]) &&
        lineDirections.every((direction) => getMasyuTwoStepLine(puzzle, key, direction).second?.mark === 'line')
      if (!valid) {
        invalidBlackCount += 1
        firstInvalidBlack ??= `${formatMasyuCellKeyLabel(key)} must turn and continue straight after both exits`
      }
      continue
    }

    const valid =
      lineDirections.length === 2 &&
      areMasyuDirectionsOpposite(lineDirections[0], lineDirections[1]) &&
      lineDirections.some((direction) => sideTurnsAfterWhitePearl(puzzle, key, direction))
    if (!valid) {
      invalidWhiteCount += 1
      firstInvalidWhite ??= `${formatMasyuCellKeyLabel(key)} must go straight and turn on at least one adjacent side`
    }
  }

  const reasons: string[] = []
  if (invalidBlackCount > 0) {
    reasons.push(
      `${invalidBlackCount} black pearl(s) are not satisfied${firstInvalidBlack ? `; first: ${firstInvalidBlack}.` : '.'}`,
    )
  }
  if (invalidWhiteCount > 0) {
    reasons.push(
      `${invalidWhiteCount} white pearl(s) are not satisfied${firstInvalidWhite ? `; first: ${firstInvalidWhite}.` : '.'}`,
    )
  }
  return reasons
}

export const analyzeMasyuCompletion = (puzzle: PuzzleIR): MasyuCompletionReport => {
  const stats = buildLineStats(puzzle)
  const reasons = [...collectLoopReasons(puzzle, stats.lineLines), ...collectPearlReasons(puzzle)]

  return {
    status: reasons.length === 0 ? 'solved' : 'stalled',
    stats,
    reasons,
  }
}
