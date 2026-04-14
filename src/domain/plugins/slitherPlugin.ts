import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from '../parsers/puzzlink'
import { slitherRules } from '../rules/slither/rules'
import type { PuzzlePlugin } from './types'

export const slitherPlugin: PuzzlePlugin = {
  id: 'slitherlink',
  displayName: 'Slitherlink',
  parse: decodeSlitherFromPuzzlink,
  encode: encodeSlitherToPuzzlink,
  getRules: () => slitherRules,
}
