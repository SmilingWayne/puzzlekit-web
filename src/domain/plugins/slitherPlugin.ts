import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from '../parsers/puzzlink'
import { decodeSlitherFromPenpa } from '../parsers/penpa'
import { slitherRules } from '../rules/slither/rules'
import type { PuzzleIR } from '../ir/types'
import type {
  PuzzleHelpContent,
  PuzzleLegendContent,
  PuzzlePlugin,
  PuzzleStatsContent,
} from './types'

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
        `Unsupported Slitherlink URL. Paste a puzz.link, pzplus.tck.mn, pzprxs.vercel.app, pzv.jp, or Penpa+ Slitherlink URL. puzz.link-compatible: ${puzzlinkMessage} Penpa+: ${penpaMessage}`,
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

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) {
    return '0.0%'
  }
  return `${((count / total) * 100).toFixed(1)}%`
}

export const getSlitherStats = (puzzle: PuzzleIR): PuzzleStatsContent => {
  const clueCounts = new Map<number, number>([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ])
  let numberedCellCount = 0

  Object.values(puzzle.cells).forEach((cell) => {
    if (cell.clue?.kind !== 'number' || typeof cell.clue.value !== 'number') {
      return
    }
    numberedCellCount += 1
    if (clueCounts.has(cell.clue.value)) {
      clueCounts.set(cell.clue.value, (clueCounts.get(cell.clue.value) ?? 0) + 1)
    }
  })

  const totalCells = puzzle.rows * puzzle.cols

  return {
    title: 'Puzzle Stats',
    summary: `Numbered cells ${numberedCellCount} / ${totalCells} (${formatPercent(numberedCellCount, totalCells)})`,
    groups: [
      {
        title: 'Numbered Cells',
        items: [
          {
            label: 'Total',
            value: `${numberedCellCount} / ${totalCells}`,
            detail: formatPercent(numberedCellCount, totalCells),
          },
        ],
      },
      {
        title: 'Clue Distribution',
        items: [0, 1, 2, 3].map((clue) => {
          const count = clueCounts.get(clue) ?? 0
          return {
            label: `Clue ${clue}`,
            value: String(count),
            detail: formatPercent(count, numberedCellCount),
          }
        }),
      },
    ],
  }
}

export const slitherPlugin: PuzzlePlugin = {
  id: 'slitherlink',
  displayName: 'Slitherlink',
  help: slitherHelp,
  legend: slitherLegend,
  displayOptions: [
    { id: 'showCoordinates', label: 'Show Coordinates', enabledByDefault: false },
    { id: 'showCellColors', label: 'Show Cell Colors', enabledByDefault: true },
    { id: 'showEdgeCrosses', label: 'Show Edge Crosses', enabledByDefault: true },
    { id: 'showSectorMarks', label: 'Show Sector Marks', enabledByDefault: true },
    { id: 'showVertices', label: 'Show Vertices', enabledByDefault: true },
    { id: 'showHighlights', label: 'Show Highlights', enabledByDefault: true },
    { id: 'showGridLabels', label: 'Show Grid Labels', enabledByDefault: true },
  ],
  getStats: getSlitherStats,
  parse: parseSlitherInput,
  encode: encodeSlitherToPuzzlink,
  getRules: () => slitherRules,
}
