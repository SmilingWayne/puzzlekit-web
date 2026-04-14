import type { DifficultyCollector, DifficultySnapshot } from './types'
import type { RuleStep } from '../rules/types'

export const createDifficultyCollector = (): DifficultyCollector => {
  let state: DifficultySnapshot = {
    totalSteps: 0,
    totalEdgeChanges: 0,
    uniqueRules: 0,
    ruleUsage: {},
  }

  return {
    reset: () => {
      state = {
        totalSteps: 0,
        totalEdgeChanges: 0,
        uniqueRules: 0,
        ruleUsage: {},
      }
    },
    onStep: (step: RuleStep) => {
      state.totalSteps += 1
      state.totalEdgeChanges += step.diffs.length
      state.ruleUsage[step.ruleId] = (state.ruleUsage[step.ruleId] ?? 0) + 1
      state.uniqueRules = Object.keys(state.ruleUsage).length
    },
    snapshot: () => ({ ...state, ruleUsage: { ...state.ruleUsage } }),
  }
}
