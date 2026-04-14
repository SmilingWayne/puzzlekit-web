import type { PuzzleIR } from '../../ir/types'
import type { PuzzleFormatAdapter } from '../types'

export const penpaAdapter: PuzzleFormatAdapter = {
  decode: (): PuzzleIR => {
    throw new Error('Penpa URL parsing is reserved and not implemented yet.')
  },
  encode: (): string => {
    throw new Error('Penpa URL encoding is reserved and not implemented yet.')
  },
}
