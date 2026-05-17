import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { buildMasyuLineDiffs, collectMasyuLineDecision, formatMasyuCellKeyLabel, formatMasyuLineLabel } from './shared'
import { createMasyuLookaheadContext } from './lookahead'

export const createBlackPearlCandidatePruningRule = (): Rule => ({
  id: 'masyu-black-pearl-candidate-pruning',
  name: 'Black Pearl Candidate Pruning',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const context = createMasyuLookaheadContext(puzzle)

    for (const pearlKey of context.getBlackPearlKeys()) {
      const decisions = new Map<string, LineMark>()
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
        collectMasyuLineDecision(decisions, puzzle, lineKeyValue, 'line')
      }
      for (const lineKeyValue of excludedExitLineKeys) {
        collectMasyuLineDecision(decisions, puzzle, lineKeyValue, 'blank')
      }

      if (decisions.size === 0) {
        continue
      }

      const diffs = buildMasyuLineDiffs(decisions, puzzle)
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
