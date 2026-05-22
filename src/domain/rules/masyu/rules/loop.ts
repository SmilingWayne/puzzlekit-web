import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import {
  findMasyuPrematureLoopClosingLines,
  hasMasyuPrematureLoop,
  type MasyuLineOverlay,
} from './lineGraph'

export type { MasyuLineOverlay }

export { findMasyuPrematureLoopClosingLines, hasMasyuPrematureLoop }

export const createPreventPrematureLoopRule = (): Rule => ({
  id: 'masyu-prevent-premature-loop',
  name: 'Prevent Premature Loop',
  apply: (puzzle): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)

    for (const lineKeyValue of findMasyuPrematureLoopClosingLines(puzzle)) {
      decisions.add(lineKeyValue, 'blank')
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    const firstExample = decisions.firstLineLabel()
    return {
      message:
        firstExample !== null
          ? `${firstExample} would close a smaller loop while other lines remain outside it, so it must be blank.`
          : 'Lines that would close a smaller loop while other lines remain outside it are blank.',
      diffs,
      affectedCells: [],
      affectedLines: decisions.affectedLines(),
    }
  },
})
