import { cellKey, getCellLineKeys, lineKey, parseCellKey, parseLineKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { LineDiff } from '../../types'

export type MasyuDirection = 'N' | 'E' | 'S' | 'W'

export const MASYU_DIRECTIONS: MasyuDirection[] = ['N', 'E', 'S', 'W']

export const oppositeMasyuDirection = (direction: MasyuDirection): MasyuDirection => {
  if (direction === 'N') return 'S'
  if (direction === 'S') return 'N'
  if (direction === 'E') return 'W'
  return 'E'
}

export const areMasyuDirectionsOpposite = (
  left: MasyuDirection,
  right: MasyuDirection,
): boolean => oppositeMasyuDirection(left) === right

export const areMasyuDirectionsTurn = (
  left: MasyuDirection,
  right: MasyuDirection,
): boolean => left !== right && !areMasyuDirectionsOpposite(left, right)

const directionOffsets: Record<MasyuDirection, [rowDelta: number, colDelta: number]> = {
  N: [-1, 0],
  E: [0, 1],
  S: [1, 0],
  W: [0, -1],
}

export const getMasyuDirectionOffset = (
  direction: MasyuDirection,
): [rowDelta: number, colDelta: number] => directionOffsets[direction]

export const formatMasyuCellLabel = (row: number, col: number): string => `(R${row + 1}, C${col + 1})`

export const formatMasyuCellKeyLabel = (key: string): string => {
  const [row, col] = parseCellKey(key)
  return formatMasyuCellLabel(row, col)
}

export const formatMasyuLineLabel = (key: string): string => {
  const [left, right] = parseLineKey(key)
  return `${formatMasyuCellLabel(left[0], left[1])}-${formatMasyuCellLabel(right[0], right[1])}`
}

export type MasyuDirectionalLine = {
  direction: MasyuDirection
  lineKey: string
  mark: LineMark
  neighborKey: string
}

export const getMasyuLineDirectionFromCell = (
  cell: string,
  targetLineKey: string,
): MasyuDirection | null => {
  const [row, col] = parseCellKey(cell)
  const [left, right] = parseLineKey(targetLineKey)
  const other =
    left[0] === row && left[1] === col
      ? right
      : right[0] === row && right[1] === col
        ? left
        : null
  if (!other) {
    return null
  }
  if (other[0] === row - 1 && other[1] === col) return 'N'
  if (other[0] === row + 1 && other[1] === col) return 'S'
  if (other[0] === row && other[1] === col + 1) return 'E'
  if (other[0] === row && other[1] === col - 1) return 'W'
  return null
}

export const getMasyuDirectionalLine = (
  puzzle: PuzzleIR,
  originKey: string,
  direction: MasyuDirection,
): MasyuDirectionalLine | null => {
  const [row, col] = parseCellKey(originKey)
  const [rowDelta, colDelta] = directionOffsets[direction]
  const neighborRow = row + rowDelta
  const neighborCol = col + colDelta
  if (neighborRow < 0 || neighborRow >= puzzle.rows || neighborCol < 0 || neighborCol >= puzzle.cols) {
    return null
  }
  const neighborKey = cellKey(neighborRow, neighborCol)
  const lineKeyValue = lineKey([row, col], [neighborRow, neighborCol])
  return {
    direction,
    lineKey: lineKeyValue,
    mark: puzzle.lines[lineKeyValue]?.mark ?? 'unknown',
    neighborKey,
  }
}

export const getMasyuIncidentDirectionalLines = (
  puzzle: PuzzleIR,
  key: string,
): Record<MasyuDirection, MasyuDirectionalLine | null> => ({
  N: getMasyuDirectionalLine(puzzle, key, 'N'),
  E: getMasyuDirectionalLine(puzzle, key, 'E'),
  S: getMasyuDirectionalLine(puzzle, key, 'S'),
  W: getMasyuDirectionalLine(puzzle, key, 'W'),
})

export const getMasyuForwardLine = (
  puzzle: PuzzleIR,
  key: string,
  direction: MasyuDirection,
): MasyuDirectionalLine | null => {
  const first = getMasyuDirectionalLine(puzzle, key, direction)
  if (!first) {
    return null
  }
  return getMasyuDirectionalLine(puzzle, first.neighborKey, direction)
}

export type MasyuTwoStepLine = {
  first: MasyuDirectionalLine | null
  second: MasyuDirectionalLine | null
}

export const getMasyuTwoStepLine = (
  puzzle: PuzzleIR,
  key: string,
  direction: MasyuDirection,
): MasyuTwoStepLine => {
  const first = getMasyuDirectionalLine(puzzle, key, direction)
  return {
    first,
    second: first ? getMasyuDirectionalLine(puzzle, first.neighborKey, direction) : null,
  }
}

export const isMasyuLineAvailable = (line: MasyuDirectionalLine | null): boolean =>
  line !== null && line.mark !== 'blank'

export const getMasyuTurnCandidateLines = (
  puzzle: PuzzleIR,
  key: string,
  throughDirection: MasyuDirection,
): MasyuDirectionalLine[] => {
  const turnDirections: MasyuDirection[] =
    throughDirection === 'N' || throughDirection === 'S' ? ['E', 'W'] : ['N', 'S']
  return turnDirections.flatMap((direction) => {
    const item = getMasyuDirectionalLine(puzzle, key, direction)
    return item ? [item] : []
  })
}

export const collectMasyuLineDecision = (
  decisions: Map<string, LineMark>,
  puzzle: PuzzleIR,
  key: string,
  to: LineMark,
): boolean => {
  const current = puzzle.lines[key]?.mark ?? 'unknown'
  if (current === to) {
    return true
  }
  if (current !== 'unknown') {
    return false
  }
  const existing = decisions.get(key)
  if (existing !== undefined) {
    return existing === to
  }
  decisions.set(key, to)
  return true
}

export const getMasyuCellLineDegree = (
  puzzle: PuzzleIR,
  key: string,
  decisions: ReadonlyMap<string, LineMark> = new Map(),
): number => {
  const [row, col] = parseCellKey(key)
  return getCellLineKeys(row, col, puzzle.rows, puzzle.cols).filter(
    (lineKeyValue) => (decisions.get(lineKeyValue) ?? puzzle.lines[lineKeyValue]?.mark ?? 'unknown') === 'line',
  ).length
}

export const canMasyuLineBeAddedWithoutDegreeOverflow = (
  puzzle: PuzzleIR,
  key: string,
  decisions: ReadonlyMap<string, LineMark> = new Map(),
): boolean => {
  const current = decisions.get(key) ?? puzzle.lines[key]?.mark ?? 'unknown'
  if (current === 'line') {
    return true
  }
  if (current !== 'unknown') {
    return false
  }
  const [left, right] = parseLineKey(key)
  return [left, right].every(([row, col]) => getMasyuCellLineDegree(puzzle, cellKey(row, col), decisions) < 2)
}

export const collectMasyuLineDecisionWithoutDegreeOverflow = (
  decisions: Map<string, LineMark>,
  puzzle: PuzzleIR,
  key: string,
  to: LineMark,
): boolean => {
  if (to === 'line' && !canMasyuLineBeAddedWithoutDegreeOverflow(puzzle, key, decisions)) {
    return false
  }
  return collectMasyuLineDecision(decisions, puzzle, key, to)
}

export const buildMasyuLineDiffs = (
  decisions: Map<string, LineMark>,
  puzzle: PuzzleIR,
): LineDiff[] =>
  [...decisions.entries()].map(([key, to]) => ({
    kind: 'line' as const,
    lineKey: key,
    from: puzzle.lines[key]?.mark ?? 'unknown',
    to,
  }))
