import { describe, expect, it } from 'vitest'
import {
  aggregateRuleAttemptSummaries,
  aggregateStrongCoverage,
  aggregateStrongInferenceSummaries,
} from './aggregation'

describe('benchmark telemetry aggregation', () => {
  it('sums rule attempts and drops per-item final scans', () => {
    const summary = aggregateRuleAttemptSummaries([
      {
        totalAttemptCount: 2,
        rules: {
          a: {
            ruleId: 'a',
            ruleName: 'A',
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
        },
        finalNoHitScan: {
          solverStepNumber: 2,
          totalDurationMs: 2,
          attemptCount: 1,
          rules: [{ ruleId: 'a', ruleName: 'A', durationMs: 2 }],
        },
      },
    ])

    expect(summary.rules.a.hitRate).toBe(0.5)
    expect(summary.finalNoHitScan).toBeNull()
  })

  it('aggregates strong work and coverage', () => {
    const summary = aggregateStrongInferenceSummaries([
      {
        totals: {
          attemptCount: 1,
          hitCount: 1,
          missCount: 0,
          timeoutCount: 0,
          hitRate: 1,
          candidateCount: 2,
          probeCount: 3,
          trialStepCount: 4,
          probeDurationMs: 5,
          producedDiffCount: 1,
        },
        rules: [],
      },
    ])
    const coverage = aggregateStrongCoverage([
      {
        status: 'full',
        supportedRules: [{ ruleId: 'a', ruleName: 'A', supported: true }],
        unsupportedRules: [],
      },
      {
        status: 'none',
        supportedRules: [],
        unsupportedRules: [{ ruleId: 'b', ruleName: 'B', supported: false }],
      },
    ])

    expect(summary.totals.probeCount).toBe(3)
    expect(coverage.status).toBe('partial')
  })
})
