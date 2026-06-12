import type { SolverObserver, StrongInferenceCompletedEvent } from './types'

export type StrongInferenceTotals = {
  attemptCount: number
  hitCount: number
  missCount: number
  timeoutCount: number
  hitRate: number
  candidateCount: number
  probeCount: number
  trialStepCount: number
  probeDurationMs: number
  producedDiffCount: number
}

export type StrongInferenceRuleSummary = StrongInferenceTotals & {
  ruleId: string
  ruleName: string
}

export type StrongInferenceSummary = {
  totals: StrongInferenceTotals
  rules: StrongInferenceRuleSummary[]
}

export type StrongInferenceSummaryCollector = {
  observer: SolverObserver
  getSummary: () => StrongInferenceSummary
}

type MutableStrongInferenceTotals = Omit<StrongInferenceTotals, 'hitRate'>
type MutableStrongInferenceRuleSummary = MutableStrongInferenceTotals & {
  ruleId: string
  ruleName: string
}

const emptyTotals = (): MutableStrongInferenceTotals => ({
  attemptCount: 0,
  hitCount: 0,
  missCount: 0,
  timeoutCount: 0,
  candidateCount: 0,
  probeCount: 0,
  trialStepCount: 0,
  probeDurationMs: 0,
  producedDiffCount: 0,
})

const addEvent = (
  summary: MutableStrongInferenceTotals,
  event: StrongInferenceCompletedEvent,
): void => {
  summary.attemptCount += 1
  summary.candidateCount += event.candidateCount
  summary.probeCount += event.probeCount
  summary.trialStepCount += event.trialStepCount
  summary.probeDurationMs += event.probeDurationMs
  summary.producedDiffCount += event.producedDiffCount
  if (event.outcome === 'hit') {
    summary.hitCount += 1
  } else if (event.outcome === 'miss') {
    summary.missCount += 1
  } else {
    summary.timeoutCount += 1
  }
}

const snapshotTotals = (
  totals: MutableStrongInferenceTotals,
): StrongInferenceTotals => ({
  ...totals,
  hitRate:
    totals.attemptCount === 0 ? 0 : totals.hitCount / totals.attemptCount,
})

export const createStrongInferenceSummaryCollector =
  (): StrongInferenceSummaryCollector => {
    const totals = emptyTotals()
    const rules = new Map<string, MutableStrongInferenceRuleSummary>()

    const observer: SolverObserver = {
      onStrongInferenceCompleted: (event) => {
        addEvent(totals, event)
        const rule = rules.get(event.ruleId) ?? {
          ...emptyTotals(),
          ruleId: event.ruleId,
          ruleName: event.ruleName,
        }
        addEvent(rule, event)
        rules.set(event.ruleId, rule)
      },
    }

    return {
      observer,
      getSummary: () => ({
        totals: snapshotTotals(totals),
        rules: Array.from(rules.values(), (rule) => ({
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          ...snapshotTotals(rule),
        })),
      }),
    }
  }
