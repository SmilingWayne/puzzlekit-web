import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from '../parsers/puzzlink'
import { decodeSlitherFromPenpa } from '../parsers/penpa'
import { slitherRules } from '../rules/slither/rules'
import type { PuzzleHelpContent, PuzzlePlugin } from './types'

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
        `Unsupported Slitherlink URL. Paste a puzz.link, pzplus.tck.mn, pzv.jp, or Penpa+ Slitherlink URL. puzz.link-compatible: ${puzzlinkMessage} Penpa+: ${penpaMessage}`,
      )
    }
  }
}

const slitherHelp: PuzzleHelpContent = {
  title: 'Slitherlink Rules',
  summary: 'Draw lines along the edges of some cells to form a loop.',
  rules: [
    'The loop cannot branch off or cross itself.',
    'A number indicates the amount of edges surrounding the cell that are visited by the loop.',
  ],
  example: {
    title: 'Before and after',
    before: {
      label: 'Before',
      description: 'Only the given clues are known.',
      rows: 3,
      cols: 3,
      clues: [
        { row: 0, col: 1, value: 3 },
        { row: 1, col: 0, value: 3 },
        { row: 1, col: 1, value: 0 },
        { row: 2, col: 1, value: 3 },
      ],
      edges: [],
    },
    after: {
      label: 'After',
      description: 'One valid loop satisfies every clue.',
      rows: 3,
      cols: 3,
      clues: [
        { row: 0, col: 1, value: 3 },
        { row: 1, col: 0, value: 3 },
        { row: 1, col: 1, value: 0 },
        { row: 2, col: 1, value: 3 },
      ],
      edges: [
        { edge: [[0, 0], [0, 1]], mark: 'blank' },
        { edge: [[0, 1], [0, 2]], mark: 'line' },
        { edge: [[0, 2], [0, 3]], mark: 'blank' },
        { edge: [[1, 0], [1, 1]], mark: 'line' },
        { edge: [[1, 1], [1, 2]], mark: 'blank' },
        { edge: [[1, 2], [1, 3]], mark: 'line' },
        { edge: [[2, 0], [2, 1]], mark: 'line' },
        { edge: [[2, 1], [2, 2]], mark: 'blank' },
        { edge: [[2, 2], [2, 3]], mark: 'line' },
        { edge: [[3, 0], [3, 1]], mark: 'blank' },
        { edge: [[3, 1], [3, 2]], mark: 'line' },
        { edge: [[3, 2], [3, 3]], mark: 'blank' },
        { edge: [[0, 0], [1, 0]], mark: 'blank' },
        { edge: [[0, 1], [1, 1]], mark: 'line' },
        { edge: [[0, 2], [1, 2]], mark: 'line' },
        { edge: [[0, 3], [1, 3]], mark: 'blank' },
        { edge: [[1, 0], [2, 0]], mark: 'line' },
        { edge: [[1, 1], [2, 1]], mark: 'blank' },
        { edge: [[1, 2], [2, 2]], mark: 'blank' },
        { edge: [[1, 3], [2, 3]], mark: 'line' },
        { edge: [[2, 0], [3, 0]], mark: 'blank' },
        { edge: [[2, 1], [3, 1]], mark: 'line' },
        { edge: [[2, 2], [3, 2]], mark: 'line' },
        { edge: [[2, 3], [3, 3]], mark: 'blank' },
      ],
    },
  },
}

export const slitherPlugin: PuzzlePlugin = {
  id: 'slitherlink',
  displayName: 'Slitherlink',
  help: slitherHelp,
  parse: parseSlitherInput,
  encode: encodeSlitherToPuzzlink,
  getRules: () => slitherRules,
}
