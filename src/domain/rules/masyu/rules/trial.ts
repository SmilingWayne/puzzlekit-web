import { cellKey, parseLineKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import { runNextRule } from '../../engine'
import type { Rule } from '../../types'
import { getMasyuLineTileRelation, isMasyuTileColor } from './color'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionalLine,
  getMasyuIncidentDirectionalLines,
  getMasyuTurnCandidateLines,
  getMasyuTwoStepLine,
  MASYU_DIRECTIONS,
  type MasyuDirection,
} from './shared'

export type MasyuTrialContradictionReason = {
  kind:
    | 'cell-degree'
    | 'pearl-shape'
    | 'line-loop'
    | 'tile-color'
    | 'line-assumption'
  message: string
}

export type MasyuTrialResult = {
  contradiction: boolean
  timedOut: boolean
  exhausted: boolean
  puzzle: PuzzleIR
  stepsRun: number
  elapsedMs: number
  contradictionReason?: MasyuTrialContradictionReason
}

type Parity = 0 | 1

export const applyMasyuLineAssumption = (puzzle: PuzzleIR, lineKeyValue: string, to: LineMark): boolean => {
  const current = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown') {
    return current === to
  }
  puzzle.lines[lineKeyValue] = { ...puzzle.lines[lineKeyValue], mark: to }
  return true
}

const getLineDirectionsAtCell = (puzzle: PuzzleIR, key: string): MasyuDirection[] =>
  Object.values(getMasyuIncidentDirectionalLines(puzzle, key)).flatMap((item) =>
    item && item.mark === 'line' ? [item.direction] : [],
  )

const getIncidentCounts = (puzzle: PuzzleIR, key: string): { lineCount: number; unknownCount: number } => {
  let lineCount = 0
  let unknownCount = 0
  for (const item of Object.values(getMasyuIncidentDirectionalLines(puzzle, key))) {
    if (!item) {
      continue
    }
    if (item.mark === 'line') {
      lineCount += 1
    } else if (item.mark === 'unknown') {
      unknownCount += 1
    }
  }
  return { lineCount, unknownCount }
}

const detectCellDegreeContradiction = (puzzle: PuzzleIR): MasyuTrialContradictionReason | null => {
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      const { lineCount, unknownCount } = getIncidentCounts(puzzle, key)
      if (lineCount > 2) {
        return {
          kind: 'cell-degree',
          message: `cell-degree contradiction at ${formatMasyuCellKeyLabel(key)}: ${lineCount} line segments meet there`,
        }
      }
      if (lineCount === 1 && unknownCount === 0) {
        return {
          kind: 'cell-degree',
          message: `cell-degree contradiction at ${formatMasyuCellKeyLabel(key)}: a closed cell has only one line segment`,
        }
      }
    }
  }
  return null
}

const canLineStillBeLine = (puzzle: PuzzleIR, lineKeyValue: string): boolean => {
  const current = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
  if (current === 'blank') {
    return false
  }
  if (current === 'line') {
    return true
  }
  const [left, right] = parseLineKey(lineKeyValue)
  return [left, right].every(([row, col]) => getIncidentCounts(puzzle, cellKey(row, col)).lineCount < 2)
}

const canBlackPearlStillWork = (puzzle: PuzzleIR, key: string): boolean => {
  const lineDirections = new Set(getLineDirectionsAtCell(puzzle, key))
  if (lineDirections.size > 2) {
    return false
  }

  const candidateTurns: Array<[MasyuDirection, MasyuDirection]> = [
    ['N', 'E'],
    ['N', 'W'],
    ['S', 'E'],
    ['S', 'W'],
  ]

  return candidateTurns.some(([leftDirection, rightDirection]) => {
    const exits = new Set<MasyuDirection>([leftDirection, rightDirection])
    for (const direction of lineDirections) {
      if (!exits.has(direction)) {
        return false
      }
    }
    for (const direction of [leftDirection, rightDirection]) {
      const { first, second } = getMasyuTwoStepLine(puzzle, key, direction)
      if (!first || !second || !canLineStillBeLine(puzzle, first.lineKey) || !canLineStillBeLine(puzzle, second.lineKey)) {
        return false
      }
    }
    for (const direction of MASYU_DIRECTIONS) {
      if (exits.has(direction)) {
        continue
      }
      const line = getMasyuDirectionalLine(puzzle, key, direction)
      if (line?.mark === 'line') {
        return false
      }
    }
    return true
  })
}

const canWhiteSideStillTurn = (puzzle: PuzzleIR, key: string, direction: MasyuDirection): boolean => {
  const first = getMasyuDirectionalLine(puzzle, key, direction)
  if (!first || !canLineStillBeLine(puzzle, first.lineKey)) {
    return false
  }
  const straightContinuation = getMasyuDirectionalLine(puzzle, first.neighborKey, direction)
  if (straightContinuation?.mark === 'line') {
    return false
  }
  return getMasyuTurnCandidateLines(puzzle, first.neighborKey, direction).some((turn) =>
    canLineStillBeLine(puzzle, turn.lineKey),
  )
}

const canWhitePearlStillWork = (puzzle: PuzzleIR, key: string): boolean => {
  const lineDirections = new Set(getLineDirectionsAtCell(puzzle, key))
  if (lineDirections.size > 2) {
    return false
  }

  const axes: Array<[MasyuDirection, MasyuDirection]> = [
    ['N', 'S'],
    ['E', 'W'],
  ]
  return axes.some(([leftDirection, rightDirection]) => {
    const axis = new Set<MasyuDirection>([leftDirection, rightDirection])
    for (const direction of lineDirections) {
      if (!axis.has(direction)) {
        return false
      }
    }
    for (const direction of [leftDirection, rightDirection]) {
      const line = getMasyuDirectionalLine(puzzle, key, direction)
      if (!line || !canLineStillBeLine(puzzle, line.lineKey)) {
        return false
      }
    }
    for (const direction of MASYU_DIRECTIONS) {
      if (axis.has(direction)) {
        continue
      }
      const line = getMasyuDirectionalLine(puzzle, key, direction)
      if (line?.mark === 'line') {
        return false
      }
    }
    return canWhiteSideStillTurn(puzzle, key, leftDirection) || canWhiteSideStillTurn(puzzle, key, rightDirection)
  })
}

const detectPearlContradiction = (puzzle: PuzzleIR): MasyuTrialContradictionReason | null => {
  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'pearl') {
      continue
    }
    const lineDirections = getLineDirectionsAtCell(puzzle, key)
    if (lineDirections.length === 2) {
      if (
        cell.clue.color === 'black' &&
        (!areMasyuDirectionsTurn(lineDirections[0], lineDirections[1]) ||
          !lineDirections.every((direction) => getMasyuTwoStepLine(puzzle, key, direction).second?.mark !== 'blank'))
      ) {
        return {
          kind: 'pearl-shape',
          message: `pearl-shape contradiction at ${formatMasyuCellKeyLabel(key)}: a black pearl must turn and continue straight after both exits`,
        }
      }
      if (cell.clue.color === 'white' && !areMasyuDirectionsOpposite(lineDirections[0], lineDirections[1])) {
        return {
          kind: 'pearl-shape',
          message: `pearl-shape contradiction at ${formatMasyuCellKeyLabel(key)}: a white pearl must go straight through`,
        }
      }
    }

    const possible =
      cell.clue.color === 'black' ? canBlackPearlStillWork(puzzle, key) : canWhitePearlStillWork(puzzle, key)
    if (!possible) {
      return {
        kind: 'pearl-shape',
        message: `pearl-shape contradiction at ${formatMasyuCellKeyLabel(key)}: no ${cell.clue.color} pearl continuation remains possible`,
      }
    }
  }
  return null
}

const detectLineLoopContradiction = (puzzle: PuzzleIR): MasyuTrialContradictionReason | null => {
  const lineEntries = Object.entries(puzzle.lines).filter(([, line]) => (line?.mark ?? 'unknown') === 'line')
  if (lineEntries.length === 0) {
    return null
  }

  const cellCount = puzzle.rows * puzzle.cols
  const parent = Array.from({ length: cellCount }, (_, idx) => idx)
  const rank = new Array<number>(cellCount).fill(0)
  const degree = new Map<number, number>()
  const toCellIndex = (row: number, col: number): number => row * puzzle.cols + col
  const find = (idx: number): number => {
    if (parent[idx] !== idx) {
      parent[idx] = find(parent[idx])
    }
    return parent[idx]
  }
  const union = (left: number, right: number): void => {
    const rootLeft = find(left)
    const rootRight = find(right)
    if (rootLeft === rootRight) {
      return
    }
    if (rank[rootLeft] < rank[rootRight]) {
      parent[rootLeft] = rootRight
    } else if (rank[rootLeft] > rank[rootRight]) {
      parent[rootRight] = rootLeft
    } else {
      parent[rootRight] = rootLeft
      rank[rootLeft] += 1
    }
  }

  for (const [lineKeyValue] of lineEntries) {
    const [left, right] = parseLineKey(lineKeyValue)
    const leftIdx = toCellIndex(left[0], left[1])
    const rightIdx = toCellIndex(right[0], right[1])
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  const componentEdgeCount = new Map<number, number>()
  const componentCells = new Map<number, Set<number>>()
  for (const [lineKeyValue] of lineEntries) {
    const [left, right] = parseLineKey(lineKeyValue)
    const leftIdx = toCellIndex(left[0], left[1])
    const rightIdx = toCellIndex(right[0], right[1])
    const root = find(leftIdx)
    componentEdgeCount.set(root, (componentEdgeCount.get(root) ?? 0) + 1)
    const cells = componentCells.get(root) ?? new Set<number>()
    cells.add(leftIdx)
    cells.add(rightIdx)
    componentCells.set(root, cells)
  }

  let closedLoopCount = 0
  let closedLoopLines = 0
  for (const [root, cells] of componentCells.entries()) {
    const edgeCount = componentEdgeCount.get(root) ?? 0
    if (edgeCount !== cells.size) {
      continue
    }
    let allDegreeTwo = true
    for (const cell of cells) {
      if ((degree.get(cell) ?? 0) !== 2) {
        allDegreeTwo = false
        break
      }
    }
    if (!allDegreeTwo) {
      continue
    }
    closedLoopCount += 1
    closedLoopLines += edgeCount
  }

  if (closedLoopCount > 1 || (closedLoopCount === 1 && closedLoopLines < lineEntries.length)) {
    return {
      kind: 'line-loop',
      message:
        closedLoopCount > 1
          ? `line-loop contradiction: ${closedLoopCount} separate closed Masyu loops are present`
          : `line-loop contradiction: a closed Masyu loop of ${closedLoopLines} segments exists while other line segments remain outside it`,
    }
  }
  return null
}

const detectTileColorContradiction = (puzzle: PuzzleIR): MasyuTrialContradictionReason | null => {
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()
  const parityToParent = new Map<string, Parity>()

  const ensure = (key: string): void => {
    if (parent.has(key)) {
      return
    }
    parent.set(key, key)
    rank.set(key, 0)
    parityToParent.set(key, 0)
  }
  const find = (key: string): { root: string; parity: Parity } => {
    ensure(key)
    const currentParent = parent.get(key)
    if (currentParent === undefined || currentParent === key) {
      return { root: key, parity: 0 }
    }
    const found = find(currentParent)
    const parity = ((parityToParent.get(key) ?? 0) ^ found.parity) as Parity
    parent.set(key, found.root)
    parityToParent.set(key, parity)
    return { root: found.root, parity }
  }
  const union = (left: string, right: string, relation: Parity, source: string): MasyuTrialContradictionReason | null => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot.root === rightRoot.root) {
      if ((leftRoot.parity ^ rightRoot.parity) !== relation) {
        return {
          kind: 'tile-color',
          message: `tile-color contradiction at ${formatMasyuLineLabel(source)}: line/tile parity requirements conflict`,
        }
      }
      return null
    }
    const mergedParity = (leftRoot.parity ^ rightRoot.parity ^ relation) as Parity
    const leftRank = rank.get(leftRoot.root) ?? 0
    const rightRank = rank.get(rightRoot.root) ?? 0
    if (leftRank < rightRank) {
      parent.set(leftRoot.root, rightRoot.root)
      parityToParent.set(leftRoot.root, mergedParity)
    } else {
      parent.set(rightRoot.root, leftRoot.root)
      parityToParent.set(rightRoot.root, mergedParity)
      if (leftRank === rightRank) {
        rank.set(leftRoot.root, leftRank + 1)
      }
    }
    return null
  }

  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      ensure(tileKey(row, col))
    }
  }

  for (const [lineKeyValue, line] of Object.entries(puzzle.lines)) {
    const mark = line?.mark ?? 'unknown'
    if (mark !== 'line' && mark !== 'blank') {
      continue
    }
    const relation = getMasyuLineTileRelation(puzzle, lineKeyValue)
    if (!relation) {
      continue
    }
    const contradiction = union(relation.leftTile, relation.rightTile, mark === 'line' ? 1 : 0, lineKeyValue)
    if (contradiction) {
      return contradiction
    }
  }

  const anchoredRootColors = new Map<string, 'green' | 'yellow'>()
  const rememberAnchor = (key: string, color: 'green' | 'yellow'): MasyuTrialContradictionReason | null => {
    const { root, parity } = find(key)
    const rootColor = (parity === 0 ? color : color === 'green' ? 'yellow' : 'green') as 'green' | 'yellow'
    const current = anchoredRootColors.get(root)
    if (current !== undefined && current !== rootColor) {
      return {
        kind: 'tile-color',
        message: `tile-color contradiction at ${key}: fixed Masyu tile colors require both ${current} and ${rootColor}`,
      }
    }
    anchoredRootColors.set(root, rootColor)
    return null
  }

  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      if (row === 0 || row === puzzle.rows || col === 0 || col === puzzle.cols) {
        const contradiction = rememberAnchor(tileKey(row, col), 'yellow')
        if (contradiction) {
          return contradiction
        }
      }
    }
  }
  for (const [key, tile] of Object.entries(puzzle.tiles ?? {})) {
    if (!isMasyuTileColor(tile.fill)) {
      continue
    }
    const contradiction = rememberAnchor(key, tile.fill)
    if (contradiction) {
      return contradiction
    }
  }
  return null
}

export const findMasyuHardContradictionReason = (puzzle: PuzzleIR): MasyuTrialContradictionReason | null =>
  detectCellDegreeContradiction(puzzle) ??
  detectPearlContradiction(puzzle) ??
  detectLineLoopContradiction(puzzle) ??
  detectTileColorContradiction(puzzle)

export const runMasyuTrialUntilFixpoint = (
  puzzle: PuzzleIR,
  deterministicRules: Rule[],
  maxTrialSteps: number,
  deadlineMs: number,
): MasyuTrialResult => {
  const startedAt = performance.now()
  const initialContradictionReason = findMasyuHardContradictionReason(puzzle)
  if (initialContradictionReason) {
    return {
      contradiction: true,
      timedOut: false,
      exhausted: false,
      puzzle,
      stepsRun: 0,
      elapsedMs: Math.max(0, performance.now() - startedAt),
      contradictionReason: initialContradictionReason,
    }
  }

  let trial = puzzle
  for (let stepNumber = 1; stepNumber <= maxTrialSteps; stepNumber += 1) {
    if (Date.now() > deadlineMs) {
      return {
        contradiction: false,
        timedOut: true,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber - 1,
        elapsedMs: Math.max(0, performance.now() - startedAt),
      }
    }
    const { nextPuzzle, step } = runNextRule(trial, deterministicRules, stepNumber)
    if (!step) {
      const contradictionReason = findMasyuHardContradictionReason(trial)
      return {
        contradiction: contradictionReason !== null,
        timedOut: false,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber - 1,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        contradictionReason: contradictionReason ?? undefined,
      }
    }
    trial = nextPuzzle
    const contradictionReason = findMasyuHardContradictionReason(trial)
    if (contradictionReason) {
      return {
        contradiction: true,
        timedOut: false,
        exhausted: false,
        puzzle: trial,
        stepsRun: stepNumber,
        elapsedMs: Math.max(0, performance.now() - startedAt),
        contradictionReason,
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
  }
}
