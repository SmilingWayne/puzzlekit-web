import { cellKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  buildMasyuLineDiffs,
  collectMasyuLineDecision,
  formatMasyuCellKeyLabel,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
} from './shared'

export const createCellCompletionRule = (): Rule => ({
  id: 'cell-completion',
  name: 'Cell Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = new Map<string, LineMark>()
    const affectedCells = new Set<string>()
    let firstCell: string | null = null
    let firstReason: string | null = null

    const remember = (key: string, lineKey: string, to: LineMark, reason: string): void => {
      if (!collectMasyuLineDecision(decisions, puzzle, lineKey, to)) {
        return
      }
      affectedCells.add(key)
      if (firstCell === null) {
        firstCell = key
        firstReason = reason
      }
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const clue = puzzle.cells[key]?.clue
        if (clue?.kind === 'pearl') {
          continue
        }
        const directional = getMasyuIncidentDirectionalLines(puzzle, key)
        const incident = MASYU_DIRECTIONS.flatMap((direction) => {
          const item = directional[direction]
          return item ? [item] : []
        })
        const lineEntries = incident.filter((item) => item.mark === 'line')
        const unknownEntries = incident.filter((item) => item.mark === 'unknown')
        if (unknownEntries.length === 0) {
          continue
        }

        if (lineEntries.length === 2) {
          for (const item of unknownEntries) {
            remember(key, item.lineKey, 'blank', 'it already has degree 2, so every other exit is blank')
          }
          continue
        }

        if (lineEntries.length !== 1) {
          if (lineEntries.length === 0 && unknownEntries.length === 1) {
            remember(
              key,
              unknownEntries[0].lineKey,
              'blank',
              'using the only remaining candidate would create a dead end',
            )
          }
          continue
        }

        if (unknownEntries.length === 1) {
          remember(
            key,
            unknownEntries[0].lineKey,
            'line',
            'one line must continue through the only remaining candidate',
          )
        }
      }
    }

    if (decisions.size === 0) {
      return null
    }

    const diffs = buildMasyuLineDiffs(decisions, puzzle)
    return {
      message:
        firstCell && firstReason
          ? `Cell ${formatMasyuCellKeyLabel(firstCell)}: ${firstReason}${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Cell completion applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})
