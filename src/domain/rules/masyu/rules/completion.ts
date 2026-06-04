import { cellKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import { getMasyuPearlColor, type MasyuPearlColor } from './pearlSelectors'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
  oppositeMasyuDirection,
  type MasyuDirection,
  type MasyuDirectionalLine,
} from './shared'

const isLegalPearlPair = (
  color: MasyuPearlColor,
  left: MasyuDirection,
  right: MasyuDirection,
): boolean =>
  color === 'white'
    ? areMasyuDirectionsOpposite(left, right)
    : areMasyuDirectionsTurn(left, right)

const getLegalPearlPairs = (
  color: MasyuPearlColor,
  entries: MasyuDirectionalLine[],
): [MasyuDirectionalLine, MasyuDirectionalLine][] => {
  const pairs: [MasyuDirectionalLine, MasyuDirectionalLine][] = []
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < entries.length;
      rightIndex += 1
    ) {
      const left = entries[leftIndex]
      const right = entries[rightIndex]
      if (isLegalPearlPair(color, left.direction, right.direction)) {
        pairs.push([left, right])
      }
    }
  }
  return pairs
}

const directionsInclude = (
  directions: readonly MasyuDirection[],
  direction: MasyuDirection,
): boolean => directions.includes(direction)

export const createCellExitCompletionRule = (): Rule => ({
  id: 'cell-exit-completion',
  name: 'Cell Exit Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstCell: string | null = null
    let firstLine: string | null = null
    let firstReason: string | null = null

    const remember = (
      key: string,
      lineKey: string,
      to: LineMark,
      reason: string,
    ): void => {
      if (!decisions.addNew(lineKey, to)) {
        return
      }
      affectedCells.add(key)
      if (firstCell === null) {
        firstCell = key
        firstLine = lineKey
        firstReason = reason
      }
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const color = getMasyuPearlColor(puzzle, key)
        const directional = getMasyuIncidentDirectionalLines(puzzle, key)
        const incident = MASYU_DIRECTIONS.flatMap((direction) => {
          const item = directional[direction]
          return item ? [item] : []
        })
        const lineEntries = incident.filter((item) => item.mark === 'line')
        const unknownEntries = incident.filter(
          (item) => item.mark === 'unknown',
        )
        if (unknownEntries.length === 0) {
          continue
        }

        if (!color) {
          if (lineEntries.length === 2) {
            for (const item of unknownEntries) {
              remember(
                key,
                item.lineKey,
                'blank',
                'it already has degree 2, so every other exit is blank',
              )
            }
            continue
          }

          if (lineEntries.length === 1 && unknownEntries.length === 1) {
            remember(
              key,
              unknownEntries[0].lineKey,
              'line',
              'one line must continue through the only remaining candidate',
            )
            continue
          }

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

        if (lineEntries.length === 2) {
          if (
            !isLegalPearlPair(
              color,
              lineEntries[0].direction,
              lineEntries[1].direction,
            )
          ) {
            continue
          }
          const lineDirections = lineEntries.map((item) => item.direction)
          for (const item of unknownEntries) {
            if (directionsInclude(lineDirections, item.direction)) {
              continue
            }
            remember(
              key,
              item.lineKey,
              'blank',
              color === 'white'
                ? 'it already has its straight-through exits, so every other exit is blank'
                : 'it already has its turning exits, so every other exit is blank',
            )
          }
          continue
        }

        if (lineEntries.length === 1) {
          const knownDirection = lineEntries[0].direction
          if (color === 'white') {
            const opposite = oppositeMasyuDirection(knownDirection)
            for (const item of unknownEntries) {
              remember(
                key,
                item.lineKey,
                item.direction === opposite ? 'line' : 'blank',
                'a white pearl must continue straight through the opposite exit',
              )
            }
            continue
          }

          const opposite = oppositeMasyuDirection(knownDirection)
          const legalCandidates = unknownEntries.filter((item) =>
            areMasyuDirectionsTurn(knownDirection, item.direction),
          )
          for (const item of unknownEntries) {
            if (item.direction !== opposite) {
              continue
            }
            remember(
              key,
              item.lineKey,
              'blank',
              'a black pearl must turn, so the opposite exit is blank',
            )
          }
          if (legalCandidates.length === 1) {
            remember(
              key,
              legalCandidates[0].lineKey,
              'line',
              'a black pearl has only one turning exit left',
            )
          }
          continue
        }

        if (lineEntries.length !== 0) {
          continue
        }

        const availableEntries = incident.filter((item) => item.mark !== 'blank')
        const legalPairs = getLegalPearlPairs(color, availableEntries)
        if (legalPairs.length !== 1) {
          continue
        }

        const [left, right] = legalPairs[0]
        const pairDirections = [left.direction, right.direction] as const
        for (const item of unknownEntries) {
          remember(
            key,
            item.lineKey,
            directionsInclude(pairDirections, item.direction) ? 'line' : 'blank',
            color === 'white'
              ? 'only one straight-through axis remains'
              : 'only one turning pair remains',
          )
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstCell && firstLine && firstReason
          ? `Cell ${formatMasyuCellKeyLabel(firstCell)}: ${firstReason}, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Cell exit completion applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})
