import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from '../parsers/puzzlink'
import { decodeSlitherFromPenpa } from '../parsers/penpa'
import { slitherRules } from '../rules/slither/rules'
import type { PuzzleHelpContent, PuzzleLegendContent, PuzzlePlugin } from './types'

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

const slitherLegend: PuzzleLegendContent = {
  title: 'Slitherlink Legend',
  items: [
    {
      label: 'Only One',
      description: 'Two edges in this sector can and will ONLY have ONE connected.',
      example: {
        rows: 3,
        cols: 3,
        clues: [{ row: 1, col: 1, value: 3 }],
        edges: [
          { edge: [[2, 1], [2, 2]], mark: 'line' },
          { edge: [[1, 2], [2, 2]], mark: 'line' },
        ],
        sectors: [{ row: 1, col: 1, corner: 'nw', kind: 'onlyOne' }],
      },
    },
    {
      label: 'NOT ONE',
      description:
        'Two edges in this sector cannot have exactly one connected; they must have ZERO or TWO connected.',
      example: {
        rows: 3,
        cols: 3,
        edges: [
          { edge: [[1, 1], [2, 1]], mark: 'blank' },
          { edge: [[1, 1], [1, 2]], mark: 'blank' },
        ],
        sectors: [{ row: 0, col: 0, corner: 'se', kind: 'notOne' }],
      },
    },
    {
      label: 'NOT ZERO',
      description:
        'Two edges in this sector cannot have ZERO connected; they must have ONE or TWO connected.',
      example: {
        rows: 3,
        cols: 3,
        clues: [{ row: 1, col: 1, value: 3 }],
        sectors: [
          { row: 1, col: 1, corner: 'nw', kind: 'notZero' },
          { row: 1, col: 1, corner: 'ne', kind: 'notZero' },
          { row: 1, col: 1, corner: 'sw', kind: 'notZero' },
          { row: 1, col: 1, corner: 'se', kind: 'notZero' },
        ],
      },
    },
    {
      label: 'NOT TWO',
      description:
        'Two edges in this sector cannot both be connected; they must have ZERO or ONE connected.',
      example: {
        rows: 3,
        cols: 3,
        edges: [{ edge: [[1, 2], [2, 2]], mark: 'blank' }],
        sectors: [{ row: 1, col: 1, corner: 'se', kind: 'notTwo' }],
      },
    },
    {
      label: 'YELLOW',
      description: 'This YELLOW cell is outside the final loop.',
      example: {
        rows: 3,
        cols: 3,
        filledCells: [{ row: 0, col: 1, fill: 'yellow' }],
        edges: [
          { edge: [[0, 0], [0, 1]], mark: 'line' },
          { edge: [[0, 1], [1, 1]], mark: 'line' },
          { edge: [[1, 1], [1, 2]], mark: 'line' },
          { edge: [[0, 2], [1, 2]], mark: 'line' },
          { edge: [[0, 2], [0, 3]], mark: 'line' },
        ],
      },
    },
    {
      label: 'GREEN',
      description: 'These GREEN cells are inside the final loop.',
      example: {
        rows: 3,
        cols: 3,
        clues: [
          { row: 0, col: 1, value: 3 },
          { row: 1, col: 0, value: 3 },
          { row: 1, col: 1, value: 0 },
          { row: 2, col: 1, value: 3 },
        ],
        filledCells: [
          { row: 0, col: 1, fill: 'green' },
          { row: 1, col: 0, fill: 'green' },
          { row: 1, col: 1, fill: 'green' },
          { row: 1, col: 2, fill: 'green' },
          { row: 2, col: 1, fill: 'green' },
        ],
        edges: [
          { edge: [[0, 1], [0, 2]], mark: 'line' },
          { edge: [[0, 1], [1, 1]], mark: 'line' },
          { edge: [[0, 2], [1, 2]], mark: 'line' },
          { edge: [[1, 0], [1, 1]], mark: 'line' },
          { edge: [[1, 0], [2, 0]], mark: 'line' },
          { edge: [[1, 2], [1, 3]], mark: 'line' },
          { edge: [[1, 3], [2, 3]], mark: 'line' },
          { edge: [[2, 0], [2, 1]], mark: 'line' },
          { edge: [[2, 1], [3, 1]], mark: 'line' },
          { edge: [[2, 2], [2, 3]], mark: 'line' },
          { edge: [[2, 2], [3, 2]], mark: 'line' },
          { edge: [[3, 1], [3, 2]], mark: 'line' },
        ],
      },
    },
  ],
}

export const slitherPlugin: PuzzlePlugin = {
  id: 'slitherlink',
  displayName: 'Slitherlink',
  help: slitherHelp,
  legend: slitherLegend,
  parse: parseSlitherInput,
  encode: encodeSlitherToPuzzlink,
  getRules: () => slitherRules,
}
