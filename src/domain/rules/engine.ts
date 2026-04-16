import { clonePuzzle } from '../ir/normalize'
import type { PuzzleIR } from '../ir/types'
import type { Rule, RuleStep } from './types'

const applyDiffs = (puzzle: PuzzleIR, step: RuleStep): PuzzleIR => {
  const next = clonePuzzle(puzzle)
  for (const diff of step.diffs) {
    if (diff.kind === 'edge') {
      if (!next.edges[diff.edgeKey]) {
        next.edges[diff.edgeKey] = { mark: diff.to }
      } else {
        next.edges[diff.edgeKey].mark = diff.to
      }
      continue
    }
    if (!next.sectors[diff.sectorKey]) {
      next.sectors[diff.sectorKey] = { mark: diff.to }
    } else {
      next.sectors[diff.sectorKey].mark = diff.to
    }
  }
  return next
}

export const runNextRule = (
  puzzle: PuzzleIR,
  rules: Rule[],
  stepNumber: number,
): { nextPuzzle: PuzzleIR; step: RuleStep | null } => {
  for (const rule of rules) {
    const result = rule.apply(puzzle)
    if (!result || result.diffs.length === 0) {
      continue
    }
    const step: RuleStep = {
      id: `step-${stepNumber}`,
      ruleId: rule.id,
      ruleName: rule.name,
      message: result.message,
      diffs: result.diffs,
      affectedCells: result.affectedCells,
      affectedEdges: result.diffs.flatMap((d) => (d.kind === 'edge' ? [d.edgeKey] : [])),
      affectedSectors:
        result.affectedSectors ??
        result.diffs.flatMap((d) => (d.kind === 'sector' ? [d.sectorKey] : [])),
      timestamp: Date.now(),
    }
    return {
      nextPuzzle: applyDiffs(puzzle, step),
      step,
    }
  }

  return { nextPuzzle: puzzle, step: null }
}
