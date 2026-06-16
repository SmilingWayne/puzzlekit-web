import { describe, expect, it } from 'vitest'
import { createRuleAttemptSummaryCollector } from './ruleAttemptSummaryCollector'
import type { RuleAttemptEvent } from './types'

const emit = (
  collector: ReturnType<typeof createRuleAttemptSummaryCollector>,
  event: RuleAttemptEvent,
): void => {
  collector.observer.onRuleAttemptCompleted?.(event)
}

describe('rule attempt summary collector', () => {
  it('summarizes attempts, durations, hit rate, and produced diffs', () => {
    const collector = createRuleAttemptSummaryCollector()

    emit(collector, {
      solverStepNumber: 1,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      hit: false,
      durationMs: 2,
      producedDiffCount: 0,
    })
    emit(collector, {
      solverStepNumber: 1,
      ruleId: 'rule-b',
      ruleName: 'Rule B',
      hit: true,
      durationMs: 6,
      producedDiffCount: 3,
    })
    emit(collector, {
      solverStepNumber: 2,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      hit: true,
      durationMs: 4,
      producedDiffCount: 2,
    })

    expect(collector.getSummary()).toEqual({
      totalAttemptCount: 3,
      rules: {
        'rule-a': {
          ruleId: 'rule-a',
          ruleName: 'Rule A',
          attemptCount: 2,
          hitCount: 1,
          missCount: 1,
          hitRate: 0.5,
          totalDurationMs: 6,
          hitDurationMs: 4,
          missDurationMs: 2,
          averageDurationMs: 3,
          producedDiffCount: 2,
        },
        'rule-b': {
          ruleId: 'rule-b',
          ruleName: 'Rule B',
          attemptCount: 1,
          hitCount: 1,
          missCount: 0,
          hitRate: 1,
          totalDurationMs: 6,
          hitDurationMs: 6,
          missDurationMs: 0,
          averageDurationMs: 6,
          producedDiffCount: 3,
        },
      },
      finalNoHitScan: null,
    })
  })

  it('reports the latest all-miss step as the final no-hit scan', () => {
    const collector = createRuleAttemptSummaryCollector()

    emit(collector, {
      solverStepNumber: 4,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      hit: false,
      durationMs: 2,
      producedDiffCount: 0,
    })
    emit(collector, {
      solverStepNumber: 4,
      ruleId: 'rule-b',
      ruleName: 'Rule B',
      hit: false,
      durationMs: 5,
      producedDiffCount: 0,
    })

    expect(collector.getSummary().finalNoHitScan).toEqual({
      solverStepNumber: 4,
      totalDurationMs: 7,
      attemptCount: 2,
      rules: [
        { ruleId: 'rule-a', ruleName: 'Rule A', durationMs: 2 },
        { ruleId: 'rule-b', ruleName: 'Rule B', durationMs: 5 },
      ],
    })
  })

  it('returns no final scan when empty or when the latest step hit', () => {
    const emptyCollector = createRuleAttemptSummaryCollector()
    expect(emptyCollector.getSummary()).toEqual({
      totalAttemptCount: 0,
      rules: {},
      finalNoHitScan: null,
    })

    const hitCollector = createRuleAttemptSummaryCollector()
    emit(hitCollector, {
      solverStepNumber: 1,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      hit: true,
      durationMs: 1,
      producedDiffCount: 1,
    })
    expect(hitCollector.getSummary().finalNoHitScan).toBeNull()
  })

  it('returns defensive summary snapshots', () => {
    const collector = createRuleAttemptSummaryCollector()
    emit(collector, {
      solverStepNumber: 1,
      ruleId: 'rule-a',
      ruleName: 'Rule A',
      hit: false,
      durationMs: 2,
      producedDiffCount: 0,
    })

    const first = collector.getSummary()
    first.rules['rule-a'].attemptCount = 99
    first.finalNoHitScan!.rules[0].durationMs = 99

    const second = collector.getSummary()
    expect(second.rules['rule-a'].attemptCount).toBe(1)
    expect(second.finalNoHitScan?.rules[0].durationMs).toBe(2)
  })
})
