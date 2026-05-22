import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import { formatMasyuCellKeyLabel, formatMasyuLineLabel } from './shared'
import { createMasyuLookaheadContext } from './lookahead'

export const createBlackPearlCandidatePruningRule = (): Rule => ({
  id: 'masyu-black-pearl-candidate-pruning',
  name: 'Black Pearl Candidate Pruning',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const context = createMasyuLookaheadContext(puzzle)

    for (const pearlKey of context.getBlackPearlKeys()) {
      const decisions = createMasyuLineDecisionCollector(puzzle)
      const incident = context.getIncidentEntries(new Map(), pearlKey)
      const exitLineKeys = incident.map((item) => item.lineKey)
      const candidates = context.getFeasibleBlackPearlCandidates(pearlKey)
      if (candidates.length === 0) {
        continue
      }

      const commonLineKeys = [...candidates[0].lines].filter((lineKeyValue) =>
        candidates.every((candidate) => candidate.lines.has(lineKeyValue)),
      )
      const excludedExitLineKeys = exitLineKeys.filter((lineKeyValue) =>
        candidates.every((candidate) => !candidate.exitLines.has(lineKeyValue)),
      )

      for (const lineKeyValue of commonLineKeys) {
        decisions.add(lineKeyValue, 'line')
      }
      for (const lineKeyValue of excludedExitLineKeys) {
        decisions.add(lineKeyValue, 'blank')
      }

      if (!decisions.hasChanges()) {
        continue
      }

      const diffs = decisions.diffs()
      const firstLine = diffs[0]?.lineKey
      return {
        message: firstLine
          ? `Black pearl ${formatMasyuCellKeyLabel(pearlKey)} has only compatible candidate turns left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Black pearl candidate pruning applied.',
        diffs,
        affectedCells: [pearlKey],
        affectedLines: diffs.map((diff) => diff.lineKey),
      }
    }

    return null
  },
})

export const createWhitePearlCandidatePruningRule = (): Rule => ({
  id: 'masyu-white-pearl-candidate-pruning',
  name: 'White Pearl Candidate Pruning',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const context = createMasyuLookaheadContext(puzzle)

    for (const pearlKey of context.getWhitePearlKeys()) {
      const decisions = createMasyuLineDecisionCollector(puzzle, {
        guardLineDegree: true,
      })
      const incident = context.getIncidentEntries(new Map(), pearlKey)
      const exitLineKeys = incident.map((item) => item.lineKey)
      const candidates = context.getFeasibleWhitePearlCandidates(pearlKey)
      if (candidates.length === 0) {
        continue
      }

      const commonLineKeys = [...candidates[0].lines].filter((lineKeyValue) =>
        candidates.every((candidate) => candidate.lines.has(lineKeyValue)),
      )
      const excludedExitLineKeys = exitLineKeys.filter((lineKeyValue) =>
        candidates.every((candidate) => !candidate.exitLines.has(lineKeyValue)),
      )

      for (const lineKeyValue of commonLineKeys) {
        decisions.add(lineKeyValue, 'line')
      }
      for (const lineKeyValue of excludedExitLineKeys) {
        decisions.add(lineKeyValue, 'blank')
      }

      if (!decisions.hasChanges()) {
        continue
      }

      const diffs = decisions.diffs()
      const firstLine = diffs[0]?.lineKey
      return {
        message: firstLine
          ? `White pearl ${formatMasyuCellKeyLabel(pearlKey)} has only compatible straight-axis candidates left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'White pearl candidate pruning applied.',
        diffs,
        affectedCells: [pearlKey],
        affectedLines: diffs.map((diff) => diff.lineKey),
      }
    }

    return null
  },
})
