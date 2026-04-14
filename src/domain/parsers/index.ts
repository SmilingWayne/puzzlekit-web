import type { PuzzleIR } from '../ir/types'
import { penpaAdapter } from './penpa'
import { slitherPuzzlinkAdapter } from './puzzlink'

export type ParserFormat = 'puzzlink' | 'penpa'

export const parsePuzzleFromUrl = (input: string): PuzzleIR => {
  if (input.includes('penpa-edit')) {
    return penpaAdapter.decode(input)
  }
  return slitherPuzzlinkAdapter.decode(input)
}

export const encodePuzzleToUrl = (puzzle: PuzzleIR, format: ParserFormat): string => {
  if (format === 'penpa') {
    return penpaAdapter.encode(puzzle)
  }
  return slitherPuzzlinkAdapter.encode(puzzle)
}
