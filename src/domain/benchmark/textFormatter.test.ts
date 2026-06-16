import { describe, expect, it } from 'vitest'
import { formatBenchmarkReportText } from './textFormatter'
import type { BenchmarkReport } from './types'

const report: BenchmarkReport = {
  schemaVersion: 2,
  run: {
    datasetId: 'sample',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:01.000Z',
    maxSteps: 10,
    timeoutMs: 1000,
    ruleProfile: 'default',
    telemetry: 'summary',
  },
  summary: {
    total: 1,
    solved: 1,
    stalled: 0,
    parseError: 0,
    runtimeError: 0,
    stepCapped: 0,
    timeCapped: 0,
    totalDurationMs: 10,
    ruleUsage: { a: 1 },
    telemetry: {
      ruleAttempts: {
        totalAttemptCount: 2,
        rules: {
          a: {
            ruleId: 'a',
            ruleName: 'A',
            attemptCount: 2,
            hitCount: 1,
            missCount: 1,
            hitRate: 0.5,
            totalDurationMs: 5,
            hitDurationMs: 3,
            missDurationMs: 2,
            averageDurationMs: 2.5,
            producedDiffCount: 1,
          },
        },
        finalNoHitScan: null,
      },
      strongInference: {
        coverage: {
          status: 'none',
          supportedRules: [],
          unsupportedRules: [
            { ruleId: 'strong', ruleName: 'Strong', supported: false },
          ],
        },
        summary: {
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
        },
      },
    },
  },
  items: [
    {
      id: 'puzzle',
      puzzleType: 'slitherlink',
      sourceUrl: 'url',
      width: 1,
      height: 1,
      status: 'solved',
      stepCount: 1,
      durationMs: 10,
      ruleUsage: { a: 1 },
      terminal: null,
    },
  ],
}

describe('benchmark text formatter', () => {
  it('highlights status, expensive rules, and missing strong telemetry', () => {
    const text = formatBenchmarkReportText(report)

    expect(text).toContain('1 solved')
    expect(text).toContain('Most expensive rules')
    expect(text).toContain('Strong inference (none coverage)')
    expect(text).toContain('Telemetry not implemented')
    expect(text).toContain('strong (Strong)')
  })
})
