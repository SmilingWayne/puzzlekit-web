import type { PuzzleIR } from '../ir/types'

export interface PuzzleFormatAdapter {
  decode: (input: string) => PuzzleIR
  encode: (puzzle: PuzzleIR) => string
}
