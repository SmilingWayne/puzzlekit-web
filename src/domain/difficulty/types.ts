import type { RuleStep } from '../rules/types'

export type DifficultySnapshot = {
  totalSteps: number
  totalEdgeChanges: number
  uniqueRules: number
  ruleUsage: Record<string, number>
}

export type DifficultyCollector = {
  reset: () => void
  onStep: (step: RuleStep) => void
  snapshot: () => DifficultySnapshot
}
