import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from '../parsers/puzzlink'
import { decodeSlitherFromPenpa } from '../parsers/penpa'
import { slitherRules } from '../rules/slither/rules'
import type { PuzzlePlugin } from './types'

const parseSlitherInput = (input: string) => {
  try {
    return decodeSlitherFromPuzzlink(input)
  } catch (puzzlinkError) {
    try {
      return decodeSlitherFromPenpa(input)
    } catch (penpaError) {
      const puzzlinkMessage =
        puzzlinkError instanceof Error ? puzzlinkError.message : String(puzzlinkError)
      const penpaMessage = penpaError instanceof Error ? penpaError.message : String(penpaError)
      throw new Error(
        `Unsupported Slitherlink URL. Paste a puzz.link Slitherlink URL or a Penpa+ Slitherlink URL. puzz.link: ${puzzlinkMessage} Penpa+: ${penpaMessage}`,
      )
    }
  }
}

export const slitherPlugin: PuzzlePlugin = {
  id: 'slitherlink',
  displayName: 'Slitherlink',
  parse: parseSlitherInput,
  encode: encodeSlitherToPuzzlink,
  getRules: () => slitherRules,
}
