import type { PuzzlePlugin } from './types'

export const masyuPlugin: PuzzlePlugin = {
  id: 'masyu',
  displayName: 'Masyu (planned)',
  parse: () => {
    throw new Error('Masyu parser not implemented yet.')
  },
  encode: () => {
    throw new Error('Masyu encoder not implemented yet.')
  },
  getRules: () => [],
}
