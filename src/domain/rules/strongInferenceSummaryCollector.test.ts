import { describe, expect, it } from 'vitest'
import { createStrongInferenceSummaryCollector } from './strongInferenceSummaryCollector'
import type { StrongInferenceCompletedEvent } from './types'

const emit = (
  collector: ReturnType<typeof createStrongInferenceSummaryCollector>,
  event: StrongInferenceCompletedEvent,
): void => {
  collector.observer.onStrongInferenceCompleted?.(event)
}

describe('strong inference summary collector', () => {
  it('summarizes outcomes and work while preserving first-observed rule order', () => {
    const collector = createStrongInferenceSummaryCollector()

    emit(collector, {
      solverStepNumber: 1,
      ruleId: 'rule-b',
      ruleName: 'Rule B',
      candidateCount: 2,
      probeCount: 3,
      trialStepCount: 5,
      probeDurationMs: 7,
      outcome: 'miss',
      producedDiffCount: 0,
    })
    emit(collector, {
      solverStepNumber: 2,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      candidateCount: 1,
      probeCount: 1,
      trialStepCount: 2,
      probeDurationMs: 4,
      outcome: 'hit',
      producedDiffCount: 3,
    })
    emit(collector, {
      solverStepNumber: 3,
      ruleId: 'rule-b',
      ruleName: 'Rule B',
      candidateCount: 4,
      probeCount: 2,
      trialStepCount: 1,
      probeDurationMs: 6,
      outcome: 'timeout',
      producedDiffCount: 0,
    })

    expect(collector.getSummary()).toEqual({
      totals: {
        attemptCount: 3,
        hitCount: 1,
        missCount: 1,
        timeoutCount: 1,
        hitRate: 1 / 3,
        candidateCount: 7,
        probeCount: 6,
        trialStepCount: 8,
        probeDurationMs: 17,
        producedDiffCount: 3,
      },
      rules: [
        {
          ruleId: 'rule-b',
          ruleName: 'Rule B',
          attemptCount: 2,
          hitCount: 0,
          missCount: 1,
          timeoutCount: 1,
          hitRate: 0,
          candidateCount: 6,
          probeCount: 5,
          trialStepCount: 6,
          probeDurationMs: 13,
          producedDiffCount: 0,
        },
        {
          ruleId: 'rule-a',
          ruleName: 'Rule A',
          attemptCount: 1,
          hitCount: 1,
          missCount: 0,
          timeoutCount: 0,
          hitRate: 1,
          candidateCount: 1,
          probeCount: 1,
          trialStepCount: 2,
          probeDurationMs: 4,
          producedDiffCount: 3,
        },
      ],
    })
  })

  it('returns empty and defensive snapshots', () => {
    const collector = createStrongInferenceSummaryCollector()
    expect(collector.getSummary()).toEqual({
      totals: {
        attemptCount: 0,
        hitCount: 0,
        missCount: 0,
        timeoutCount: 0,
        hitRate: 0,
        candidateCount: 0,
        probeCount: 0,
        trialStepCount: 0,
        probeDurationMs: 0,
        producedDiffCount: 0,
      },
      rules: [],
    })

    emit(collector, {
      solverStepNumber: 1,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      candidateCount: 1,
      probeCount: 2,
      trialStepCount: 3,
      probeDurationMs: 4,
      outcome: 'hit',
      producedDiffCount: 1,
    })
    const first = collector.getSummary()
    first.totals.attemptCount = 99
    first.rules[0].probeCount = 99

    const second = collector.getSummary()
    expect(second.totals.attemptCount).toBe(1)
    expect(second.rules[0].probeCount).toBe(2)
  })
})
