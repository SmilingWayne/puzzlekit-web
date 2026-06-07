import { cellKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import { slitherRules } from '../rules'

export const setClue = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  value: number,
): void => {
  puzzle.cells[cellKey(row, col)] = {
    clue: { kind: 'number', value },
  }
}

export const getEdgeDiffKeys = (
  result: ReturnType<(typeof slitherRules)[number]['apply']>,
): string[] =>
  result?.diffs.flatMap((diff) =>
    diff.kind === 'edge' ? [diff.edgeKey] : [],
  ) ?? []
