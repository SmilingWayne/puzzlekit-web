import { cellKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  buildMasyuLineDiffs,
  collectMasyuLineDecision,
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuIncidentDirectionalLines,
  getMasyuTwoStepLine,
  MASYU_DIRECTIONS,
  type MasyuDirection,
  type MasyuDirectionalLine,
} from './shared'

type PearlColor = 'white' | 'black'

const getPearlCellKeys = (puzzle: PuzzleIR): string[] =>
  Object.entries(puzzle.cells).flatMap(([key, cell]) => (cell.clue?.kind === 'pearl' ? [key] : []))

const getPearlColor = (puzzle: PuzzleIR, key: string): PearlColor | null => {
  const clue = puzzle.cells[key]?.clue
  return clue?.kind === 'pearl' ? clue.color : null
}

const isLegalPearlPair = (color: PearlColor, left: MasyuDirection, right: MasyuDirection): boolean =>
  color === 'white' ? areMasyuDirectionsOpposite(left, right) : areMasyuDirectionsTurn(left, right)

const getLegalPearlPairs = (
  color: PearlColor,
  entries: MasyuDirectionalLine[],
): [MasyuDirectionalLine, MasyuDirectionalLine][] => {
  const pairs: [MasyuDirectionalLine, MasyuDirectionalLine][] = []
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex]
      const right = entries[rightIndex]
      if (isLegalPearlPair(color, left.direction, right.direction)) {
        pairs.push([left, right])
      }
    }
  }
  return pairs
}

const rememberPearlDecision = (
  decisions: Map<string, LineMark>,
  puzzle: PuzzleIR,
  lineKey: string,
  to: LineMark,
): boolean => {
  const beforeSize = decisions.size
  return collectMasyuLineDecision(decisions, puzzle, lineKey, to) && decisions.size > beforeSize
}

const rememberBlackExtension = (
  decisions: Map<string, LineMark>,
  puzzle: PuzzleIR,
  pearlKey: string,
  direction: MasyuDirection,
): string | null => {
  const extension = getMasyuTwoStepLine(puzzle, pearlKey, direction).second
  if (!extension || !rememberPearlDecision(decisions, puzzle, extension.lineKey, 'line')) {
    return null
  }
  return extension.lineKey
}

export const createPearlCompletionRule = (): Rule => ({
  id: 'pearl-completion',
  name: 'Pearl Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = new Map<string, LineMark>()
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null
    let firstReason: string | null = null

    const remember = (pearlKey: string, lineKey: string, to: LineMark, reason: string): void => {
      if (!rememberPearlDecision(decisions, puzzle, lineKey, to)) {
        return
      }
      affectedCells.add(pearlKey)
      if (firstPearl === null) {
        firstPearl = pearlKey
        firstLine = lineKey
        firstReason = reason
      }
    }

    const rememberBlackExitExtensions = (pearlKey: string, directions: MasyuDirection[], reason: string): void => {
      for (const direction of directions) {
        const extensionLineKey = rememberBlackExtension(decisions, puzzle, pearlKey, direction)
        if (extensionLineKey) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
            firstLine = extensionLineKey
            firstReason = reason
          }
        }
      }
    }

    for (const pearlKey of getPearlCellKeys(puzzle)) {
      const color = getPearlColor(puzzle, pearlKey)
      if (!color) {
        continue
      }
      const directional = getMasyuIncidentDirectionalLines(puzzle, pearlKey)
      const incident = MASYU_DIRECTIONS.flatMap((direction) => {
        const item = directional[direction]
        return item ? [item] : []
      })
      const lineEntries = incident.filter((item) => item.mark === 'line')
      const unknownEntries = incident.filter((item) => item.mark === 'unknown')
      const availableEntries = incident.filter((item) => item.mark !== 'blank')
      const reason =
        color === 'white'
          ? 'must have two straight-through exits'
          : 'must turn and extend from each exit'

      if (lineEntries.length === 2) {
        if (!isLegalPearlPair(color, lineEntries[0].direction, lineEntries[1].direction)) {
          continue
        }
        for (const item of unknownEntries) {
          remember(pearlKey, item.lineKey, 'blank', reason)
        }
        if (color === 'black') {
          rememberBlackExitExtensions(
            pearlKey,
            lineEntries.map((item) => item.direction),
            reason,
          )
        }
        continue
      }

      if (lineEntries.length === 1) {
        const legalCandidates = unknownEntries.filter((item) =>
          isLegalPearlPair(color, lineEntries[0].direction, item.direction),
        )
        if (legalCandidates.length !== 1) {
          continue
        }
        remember(pearlKey, legalCandidates[0].lineKey, 'line', reason)
        if (color === 'black') {
          rememberBlackExitExtensions(pearlKey, [lineEntries[0].direction, legalCandidates[0].direction], reason)
        }
        continue
      }

      if (lineEntries.length !== 0) {
        continue
      }

      const legalPairs = getLegalPearlPairs(color, availableEntries)
      if (legalPairs.length !== 1) {
        continue
      }

      const [left, right] = legalPairs[0]
      remember(pearlKey, left.lineKey, 'line', reason)
      remember(pearlKey, right.lineKey, 'line', reason)
      if (color === 'black') {
        rememberBlackExitExtensions(pearlKey, [left.direction, right.direction], reason)
      }
    }

    if (decisions.size === 0) {
      return null
    }

    const diffs = buildMasyuLineDiffs(decisions, puzzle)
    return {
      message:
        firstPearl && firstLine && firstReason
          ? `${getPearlColor(puzzle, firstPearl) === 'white' ? 'White' : 'Black'} pearl ${formatMasyuCellKeyLabel(firstPearl)} ${firstReason}, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Pearl completion applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})

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
