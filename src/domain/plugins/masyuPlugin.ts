import { decodeMasyuFromPenpa } from '../parsers/penpa'
import {
  decodeMasyuFromPuzzlink,
  encodeMasyuToPuzzlink,
} from '../parsers/puzzlink'
import { masyuRules } from '../rules/masyu/rules'
import type { PuzzleIR } from '../ir/types'
import type { PuzzlePlugin } from './types'
import type {
  PuzzleHelpContent,
  PuzzleLegendContent,
  PuzzleStatsContent,
} from './types'

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) {
    return '0.0%'
  }
  return `${((count / total) * 100).toFixed(1)}%`
}

const parseMasyuInput = (input: string) => {
  try {
    return decodeMasyuFromPuzzlink(input)
  } catch (puzzlinkError) {
    try {
      return decodeMasyuFromPenpa(input)
    } catch (penpaError) {
      const puzzlinkMessage =
        puzzlinkError instanceof Error
          ? puzzlinkError.message
          : String(puzzlinkError)
      const penpaMessage =
        penpaError instanceof Error ? penpaError.message : String(penpaError)
      throw new Error(
        `Unsupported Masyu URL. Paste a puzz.link, pzplus.tck.mn, pzprxs.vercel.app, pzv.jp, or Penpa+ Masyu URL. puzz.link-compatible: ${puzzlinkMessage} Penpa+: ${penpaMessage}`,
      )
    }
  }
}

const masyuHelp: PuzzleHelpContent = {
  title: 'Masyu Rules',
  summary:
    'Draw lines through orthogonally adjacent cells to form a loop that goes through every pearl.',
  rules: [
    'The loop cannot branch off or cross itself.',
    'The loop must turn on black pearls and travel straight through the cells before and after the pearl.',
    'The loop must go straight through white pearls, and turn in at least one of the cells on either side.',
  ],
  notes: ['Rule examples are planned for a later Masyu update.'],
}

const masyuLegend: PuzzleLegendContent = {
  title: 'Masyu Legend',
  items: [
    {
      label: 'Black & White',
      description:
        'White pearls go straight through; black pearls turn and continue straight after the turn.',
      example: {
        rows: 3,
        cols: 3,
        pearls: [
          { row: 1, col: 0, color: 'white' },
          { row: 2, col: 2, color: 'black' },
        ],
        lines: [
          { edge: [[0, 0], [1, 0]], mark: 'line' },
          { edge: [[1, 0], [2, 0]], mark: 'line' },
          { edge: [[2, 1], [2, 2]], mark: 'line' },
          { edge: [[2, 0], [2, 1]], mark: 'line' },
          { edge: [[1, 2], [2, 2]], mark: 'line' },
          { edge: [[0, 2], [1, 2]], mark: 'line' },
        ],
      },
    },
    {
      label: 'Cross & Line',
      description:
        'Player marks draw center lines and cross out center connections that cannot be used.',
      example: {
        rows: 3,
        cols: 3,
        pearls: [{ row: 1, col: 1, color: 'white' }],
        lines: [
          { edge: [[0, 1], [1, 1]], mark: 'line' },
          { edge: [[1, 1], [2, 1]], mark: 'line' },
          { edge: [[1, 0], [1, 1]], mark: 'blank' },
          { edge: [[1, 1], [1, 2]], mark: 'blank' },
        ],
      },
    },
    {
      label: 'Green Tile',
      description: 'Green tiles mark the inside of the final loop.',
      example: {
        rows: 3,
        cols: 3,
        filledTiles: [
          { row: 1, col: 1, fill: 'green' },
          { row: 1, col: 2, fill: 'green' },
          { row: 2, col: 1, fill: 'green' },
          { row: 2, col: 2, fill: 'green' },
        ],
        lines: [
          { edge: [[0, 0], [0, 1]], mark: 'line' },
          { edge: [[0, 1], [0, 2]], mark: 'line' },
          { edge: [[0, 2], [1, 2]], mark: 'line' },
          { edge: [[1, 2], [2, 2]], mark: 'line' },
          { edge: [[2, 2], [2, 1]], mark: 'line' },
          { edge: [[2, 1], [2, 0]], mark: 'line' },
          { edge: [[2, 0], [1, 0]], mark: 'line' },
          { edge: [[1, 0], [0, 0]], mark: 'line' },
        ],
      },
    },
    {
      label: 'Yellow Tile',
      description: 'Yellow tiles mark the outside of the final loop.',
      example: {
        rows: 3,
        cols: 3,
        filledTiles: [
          { row: 0, col: 1, fill: 'yellow' },
          { row: 0, col: 2, fill: 'yellow' },
          { row: 1, col: 0, fill: 'yellow' },
          { row: 2, col: 0, fill: 'yellow' },
          { row: 3, col: 1, fill: 'yellow' },
          { row: 3, col: 2, fill: 'yellow' },
        ],
        lines: [
          { edge: [[0, 0], [0, 1]], mark: 'line' },
          { edge: [[0, 1], [0, 2]], mark: 'line' },
          { edge: [[0, 2], [1, 2]], mark: 'line' },
          { edge: [[1, 2], [2, 2]], mark: 'line' },
          { edge: [[2, 2], [2, 1]], mark: 'line' },
          { edge: [[2, 1], [2, 0]], mark: 'line' },
          { edge: [[2, 0], [1, 0]], mark: 'line' },
          { edge: [[1, 0], [0, 0]], mark: 'line' },
        ],
      },
    },
  ],
}

export const getMasyuStats = (puzzle: PuzzleIR): PuzzleStatsContent => {
  let whitePearls = 0
  let blackPearls = 0

  Object.values(puzzle.cells).forEach((cell) => {
    if (cell.clue?.kind !== 'pearl') {
      return
    }
    if (cell.clue.color === 'white') {
      whitePearls += 1
    } else {
      blackPearls += 1
    }
  })

  const pearlCount = whitePearls + blackPearls
  const totalCells = puzzle.rows * puzzle.cols

  return {
    title: 'Puzzle Stats',
    summary: `Pearls ${pearlCount} / ${totalCells} (${formatPercent(pearlCount, totalCells)})`,
    groups: [
      {
        title: 'Board Size',
        items: [{ label: 'Grid', value: `${puzzle.rows} × ${puzzle.cols}` }],
      },
      {
        title: 'Pearls',
        items: [
          {
            label: 'Total',
            value: `${pearlCount} / ${totalCells}`,
            detail: formatPercent(pearlCount, totalCells),
          },
          {
            label: 'White',
            value: String(whitePearls),
            detail: formatPercent(whitePearls, pearlCount),
          },
          {
            label: 'Black',
            value: String(blackPearls),
            detail: formatPercent(blackPearls, pearlCount),
          },
        ],
      },
    ],
  }
}

export const masyuPlugin: PuzzlePlugin = {
  id: 'masyu',
  displayName: 'Masyu',
  strongTelemetry: {
    rules: [
      {
        ruleId: 'masyu-black-pearl-strong-inference',
        ruleName: 'Black Pearl Strong Inference',
        supported: true,
      },
      {
        ruleId: 'masyu-line-component-endpoint-strong-inference',
        ruleName: 'Masyu Line Component Endpoint Strong Inference',
        supported: true,
      },
      {
        ruleId: 'masyu-white-pearl-strong-inference',
        ruleName: 'White Pearl Strong Inference',
        supported: true,
      },
    ],
  },
  liveStats: {
    coverageTitle: 'Inference Coverage',
    coverageDescription: 'Decided or colored Masyu state',
    coverageSeries: [
      { source: 'line', label: 'Line Decisions', color: '#2563eb' },
      { source: 'tile', label: 'Tile Colors', color: '#16a34a' },
    ],
  },
  help: masyuHelp,
  legend: masyuLegend,
  displayOptions: [
    { id: 'showTiles', label: 'Show Tiles', enabledByDefault: true },
    {
      id: 'showLineCrosses',
      label: 'Show Line Crosses',
      enabledByDefault: true,
    },
    { id: 'showHighlights', label: 'Show Highlights', enabledByDefault: true },
    { id: 'showGridLabels', label: 'Show Grid Labels', enabledByDefault: true },
    { id: 'showGrid', label: 'Show Grid', enabledByDefault: true },
  ],
  getStats: getMasyuStats,
  parse: parseMasyuInput,
  encode: encodeMasyuToPuzzlink,
  getRules: () => masyuRules,
}
