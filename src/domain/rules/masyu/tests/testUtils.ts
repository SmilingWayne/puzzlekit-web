import { expect } from 'vitest'
import { cellKey, lineKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { RuleDiff } from '../../types'

export const markLine = (
  puzzle: PuzzleIR,
  key: string,
  mark: LineMark,
): void => {
  puzzle.lines[key] = { ...puzzle.lines[key], mark }
}

export const addPearl = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  color: 'white' | 'black',
): void => {
  puzzle.cells[cellKey(row, col)] = { clue: { kind: 'pearl', color } }
}

export const fillAllTiles = (
  puzzle: PuzzleIR,
  fill: 'green' | 'yellow',
): void => {
  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      puzzle.tiles[tileKey(row, col)] = { fill }
    }
  }
}

export const getLineDegree = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
): number =>
  [
    row > 0 ? lineKey([row - 1, col], [row, col]) : null,
    row < puzzle.rows - 1 ? lineKey([row, col], [row + 1, col]) : null,
    col > 0 ? lineKey([row, col - 1], [row, col]) : null,
    col < puzzle.cols - 1 ? lineKey([row, col], [row, col + 1]) : null,
  ].filter((key) => key !== null && puzzle.lines[key]?.mark === 'line').length

export const expectLineDiffs = (
  diffs: RuleDiff[] | undefined,
  expected: Record<string, LineMark>,
): void => {
  expect(
    Object.fromEntries(
      (diffs ?? []).map((diff) => [
        diff.kind === 'line' ? diff.lineKey : '',
        diff.kind === 'line' ? diff.to : '',
      ]),
    ),
  ).toEqual(expected)
}
