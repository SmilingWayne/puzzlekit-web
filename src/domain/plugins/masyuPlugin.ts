import { decodeMasyuFromPuzzlink, encodeMasyuToPuzzlink } from '../parsers/puzzlink'
import { masyuRules } from '../rules/masyu/rules'
import type { PuzzleIR } from '../ir/types'
import type { PuzzlePlugin } from './types'
import type { PuzzleHelpContent, PuzzleLegendContent, PuzzleStatsContent } from './types'

const formatPercent = (count: number, total: number): string => {
  if (total <= 0) {
    return '0.0%'
  }
  return `${((count / total) * 100).toFixed(1)}%`
}

const masyuHelp: PuzzleHelpContent = {
  title: 'Masyu Rules',
  summary: 'Draw lines through orthogonally adjacent cells to form a loop that goes through every circle.',
  rules: [
    'The loop cannot branch off or cross itself.',
    'The loop must turn on black circles and travel straight through the cells before and after the circle.',
    'The loop must go straight through white circles, and turn in at least one of the cells on either side.',
  ],
  notes: ['Rule examples are planned for a later Masyu update.'],
}

const masyuLegend: PuzzleLegendContent = {
  title: 'Masyu Legend',
  items: [
    {
      label: 'Pearls',
      description: 'White and black pearls are shown in the centers of cells.',
      example: {
        rows: 3,
        cols: 3,
      },
    },
    {
      label: 'Lines and Crosses',
      description: 'Lines connect cell centers. Crosses mark center connections that cannot be used.',
      example: {
        rows: 3,
        cols: 3,
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
  help: masyuHelp,
  legend: masyuLegend,
  getStats: getMasyuStats,
  parse: decodeMasyuFromPuzzlink,
  encode: encodeMasyuToPuzzlink,
  getRules: () => masyuRules,
}
