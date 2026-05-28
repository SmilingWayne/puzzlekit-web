import { cellKey, parseCellKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  createMasyuLineDecisionCollector,
  type MasyuLineDecisionCollector,
} from './decisionCollector'
import { getMasyuBlackPearlKeys, isMasyuPearl } from './pearlSelectors'
import {
  MASYU_DIRECTIONS,
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionOffset,
  getMasyuDirectionalLine,
  oppositeMasyuDirection,
  type MasyuDirection,
} from './shared'

const isInBounds = (puzzle: PuzzleIR, row: number, col: number): boolean =>
  row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols

const offsetCellKey = (
  puzzle: PuzzleIR,
  originKey: string,
  rowDelta: number,
  colDelta: number,
  distance = 1,
): string | null => {
  const [row, col] = parseCellKey(originKey)
  const targetRow = row + rowDelta * distance
  const targetCol = col + colDelta * distance
  return isInBounds(puzzle, targetRow, targetCol)
    ? cellKey(targetRow, targetCol)
    : null
}

export const createBlackFacingConsecutiveWhitesRule = (): Rule => ({
  id: 'masyu-black-facing-consecutive-whites',
  name: 'Black Facing Consecutive Whites',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null

    for (const pearlKey of getMasyuBlackPearlKeys(puzzle)) {
      for (const direction of MASYU_DIRECTIONS) {
        const [rowDelta, colDelta] = getMasyuDirectionOffset(direction)
        const gap = offsetCellKey(puzzle, pearlKey, rowDelta, colDelta)
        const firstWhite = offsetCellKey(
          puzzle,
          pearlKey,
          rowDelta,
          colDelta,
          2,
        )
        const secondWhite = offsetCellKey(
          puzzle,
          pearlKey,
          rowDelta,
          colDelta,
          3,
        )
        if (
          !gap ||
          !isMasyuPearl(puzzle, firstWhite, 'white') ||
          !isMasyuPearl(puzzle, secondWhite, 'white')
        ) {
          continue
        }

        const forced = getMasyuDirectionalLine(
          puzzle,
          pearlKey,
          oppositeMasyuDirection(direction),
        )
        if (!forced || !decisions.addNew(forced.lineKey, 'line')) {
          continue
        }
        affectedCells.add(pearlKey)
        if (firstPearl === null) {
          firstPearl = pearlKey
          firstLine = forced.lineKey
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstPearl && firstLine
          ? `Black pearl ${formatMasyuCellKeyLabel(firstPearl)} faces two consecutive white pearls, so ${formatMasyuLineLabel(firstLine)} is forced${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Black facing consecutive whites pattern applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})

const getSideDiagonalKeys = (
  puzzle: PuzzleIR,
  originKey: string,
  side: MasyuDirection,
): [string | null, string | null] => {
  const [sideRowDelta, sideColDelta] = getMasyuDirectionOffset(side)
  const perpendicularOffsets: [number, number][] =
    side === 'N' || side === 'S'
      ? [
          [0, -1],
          [0, 1],
        ]
      : [
          [-1, 0],
          [1, 0],
        ]
  return perpendicularOffsets.map(([rowDelta, colDelta]) =>
    offsetCellKey(
      puzzle,
      originKey,
      sideRowDelta + rowDelta,
      sideColDelta + colDelta,
    ),
  ) as [string | null, string | null]
}

export const createBlackDiagonalWhitePinchRule = (): Rule => ({
  id: 'masyu-black-diagonal-white-pinch',
  name: 'Black Diagonal White Pinch',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null

    for (const pearlKey of getMasyuBlackPearlKeys(puzzle)) {
      for (const side of MASYU_DIRECTIONS) {
        const [leftDiagonal, rightDiagonal] = getSideDiagonalKeys(
          puzzle,
          pearlKey,
          side,
        )
        if (
          !isMasyuPearl(puzzle, leftDiagonal, 'white') ||
          !isMasyuPearl(puzzle, rightDiagonal, 'white')
        ) {
          continue
        }

        const forced = getMasyuDirectionalLine(
          puzzle,
          pearlKey,
          oppositeMasyuDirection(side),
        )
        if (!forced || !decisions.addNew(forced.lineKey, 'line')) {
          continue
        }
        affectedCells.add(pearlKey)
        if (firstPearl === null) {
          firstPearl = pearlKey
          firstLine = forced.lineKey
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstPearl && firstLine
          ? `Two diagonal white pearls pinch black pearl ${formatMasyuCellKeyLabel(firstPearl)}, so ${formatMasyuLineLabel(firstLine)} is forced${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Black diagonal white pinch pattern applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})

const collectWhitePearlRun = (
  puzzle: PuzzleIR,
  startRow: number,
  startCol: number,
  rowDelta: number,
  colDelta: number,
): string[] => {
  const run: string[] = []
  let row = startRow
  let col = startCol
  while (isInBounds(puzzle, row, col)) {
    const key = cellKey(row, col)
    if (!isMasyuPearl(puzzle, key, 'white')) {
      break
    }
    run.push(key)
    row += rowDelta
    col += colDelta
  }
  return run
}

const forceWhitePearlRunLines = (
  puzzle: PuzzleIR,
  decisions: MasyuLineDecisionCollector,
  affectedCells: Set<string>,
  run: string[],
  forcedDirections: [MasyuDirection, MasyuDirection],
): string | null => {
  let firstLine: string | null = null
  for (const pearlKey of run) {
    let addedForCell = false
    for (const direction of forcedDirections) {
      const line = getMasyuDirectionalLine(puzzle, pearlKey, direction)
      if (!line || !decisions.addNew(line.lineKey, 'line')) {
        continue
      }
      addedForCell = true
      if (firstLine === null) {
        firstLine = line.lineKey
      }
    }
    if (addedForCell) {
      affectedCells.add(pearlKey)
    }
  }
  return firstLine
}

export const createConsecutiveWhitePearlsStraightRule = (): Rule => ({
  id: 'masyu-consecutive-white-pearls-straight',
  name: 'Consecutive White Pearls Straight',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null

    for (let row = 0; row < puzzle.rows; row += 1) {
      let col = 0
      while (col < puzzle.cols) {
        const run = collectWhitePearlRun(puzzle, row, col, 0, 1)
        if (run.length >= 3) {
          const line = forceWhitePearlRunLines(
            puzzle,
            decisions,
            affectedCells,
            run,
            ['N', 'S'],
          )
          if (firstPearl === null && line) {
            firstPearl = run[0]
            firstLine = line
          }
        }
        col += Math.max(run.length, 1)
      }
    }

    for (let col = 0; col < puzzle.cols; col += 1) {
      let row = 0
      while (row < puzzle.rows) {
        const run = collectWhitePearlRun(puzzle, row, col, 1, 0)
        if (run.length >= 3) {
          const line = forceWhitePearlRunLines(
            puzzle,
            decisions,
            affectedCells,
            run,
            ['E', 'W'],
          )
          if (firstPearl === null && line) {
            firstPearl = run[0]
            firstLine = line
          }
        }
        row += Math.max(run.length, 1)
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstPearl && firstLine
          ? `Three or more consecutive white pearls force ${formatMasyuCellKeyLabel(firstPearl)} to pass perpendicular to the run, so ${formatMasyuLineLabel(firstLine)} is a line${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Consecutive white pearls straight pattern applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})

const squeezeAxes: {
  blackDirections: [MasyuDirection, MasyuDirection]
  perpendicularDirections: [MasyuDirection, MasyuDirection]
}[] = [
  {
    blackDirections: ['E', 'W'],
    perpendicularDirections: ['N', 'S'],
  },
  {
    blackDirections: ['N', 'S'],
    perpendicularDirections: ['E', 'W'],
  },
]

const collectDoubleBlackSqueeze = (
  puzzle: PuzzleIR,
  decisions: MasyuLineDecisionCollector,
  middleKey: string,
  perpendicularDirections: [MasyuDirection, MasyuDirection],
): string | null => {
  const first = getMasyuDirectionalLine(
    puzzle,
    middleKey,
    perpendicularDirections[0],
  )
  const second = getMasyuDirectionalLine(
    puzzle,
    middleKey,
    perpendicularDirections[1],
  )
  if (!first && !second) {
    return null
  }
  if (!first) {
    const onlyExit = second
    return onlyExit?.mark === 'unknown' &&
      decisions.addNew(onlyExit.lineKey, 'blank')
      ? onlyExit.lineKey
      : null
  }
  if (!second) {
    return first.mark === 'unknown' && decisions.addNew(first.lineKey, 'blank')
      ? first.lineKey
      : null
  }
  if (first.mark === 'blank') {
    return decisions.addNew(second.lineKey, 'blank') ? second.lineKey : null
  }
  if (second.mark === 'blank') {
    return decisions.addNew(first.lineKey, 'blank') ? first.lineKey : null
  }
  return null
}

export const createDoubleBlackSqueezeRule = (): Rule => ({
  id: 'masyu-double-black-squeeze',
  name: 'Double Black Squeeze',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstMiddle: string | null = null
    let firstLine: string | null = null

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const middleKey = cellKey(row, col)
        for (const {
          blackDirections,
          perpendicularDirections,
        } of squeezeAxes) {
          const blackCells = blackDirections.map((direction) => {
            const [rowDelta, colDelta] = getMasyuDirectionOffset(direction)
            return offsetCellKey(puzzle, middleKey, rowDelta, colDelta)
          })
          if (!blackCells.every((key) => isMasyuPearl(puzzle, key, 'black'))) {
            continue
          }
          const line = collectDoubleBlackSqueeze(
            puzzle,
            decisions,
            middleKey,
            perpendicularDirections,
          )
          if (!line) {
            continue
          }
          affectedCells.add(middleKey)
          if (firstMiddle === null) {
            firstMiddle = middleKey
            firstLine = line
          }
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstMiddle && firstLine
          ? `The cell ${formatMasyuCellKeyLabel(firstMiddle)} between two black pearls cannot use a single perpendicular exit, so ${formatMasyuLineLabel(firstLine)} is blank${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Double black squeeze pattern applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})
