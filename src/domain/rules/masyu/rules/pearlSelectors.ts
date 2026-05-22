import type { PuzzleIR } from '../../../ir/types'
import { formatMasyuCellKeyLabel } from './shared'

export type MasyuPearlColor = 'white' | 'black'

export type MasyuPearlEntry = {
  key: string
  color: MasyuPearlColor
}

export const getMasyuPearlColor = (
  puzzle: PuzzleIR,
  key: string,
): MasyuPearlColor | null => {
  const clue = puzzle.cells[key]?.clue
  return clue?.kind === 'pearl' ? clue.color : null
}

export const getMasyuPearls = (puzzle: PuzzleIR): MasyuPearlEntry[] =>
  Object.entries(puzzle.cells).flatMap(([key, cell]) =>
    cell.clue?.kind === 'pearl' ? [{ key, color: cell.clue.color }] : [],
  )

export const getMasyuPearlKeys = (
  puzzle: PuzzleIR,
  color?: MasyuPearlColor,
): string[] =>
  getMasyuPearls(puzzle).flatMap((pearl) =>
    color === undefined || pearl.color === color ? [pearl.key] : [],
  )

export const getMasyuWhitePearlKeys = (puzzle: PuzzleIR): string[] =>
  getMasyuPearlKeys(puzzle, 'white')

export const getMasyuBlackPearlKeys = (puzzle: PuzzleIR): string[] =>
  getMasyuPearlKeys(puzzle, 'black')

export const isMasyuPearl = (
  puzzle: PuzzleIR,
  key: string | null,
  color?: MasyuPearlColor,
): boolean =>
  key !== null &&
  getMasyuPearlColor(puzzle, key) !== null &&
  (color === undefined || getMasyuPearlColor(puzzle, key) === color)

export const formatMasyuPearlLabel = (
  puzzle: PuzzleIR,
  key: string,
): string => {
  const color = getMasyuPearlColor(puzzle, key)
  const colorLabel =
    color === 'white' ? 'White' : color === 'black' ? 'Black' : 'Masyu'
  return `${colorLabel} pearl ${formatMasyuCellKeyLabel(key)}`
}
