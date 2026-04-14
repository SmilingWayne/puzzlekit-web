import type { PuzzleIR } from '../ir/types'
import type { Rule } from '../rules/types'

export interface PuzzlePlugin {
  id: string
  displayName: string
  parse: (input: string) => PuzzleIR
  encode: (puzzle: PuzzleIR) => string
  getRules: () => Rule[]
}
