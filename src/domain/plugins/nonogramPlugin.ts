import type { PuzzlePlugin } from './types'

export const nonogramPlugin: PuzzlePlugin = {
  id: 'nonogram',
  displayName: 'Nonogram (planned)',
  parse: () => {
    throw new Error('Nonogram parser not implemented yet.')
  },
  encode: () => {
    throw new Error('Nonogram encoder not implemented yet.')
  },
  getRules: () => [],
}
