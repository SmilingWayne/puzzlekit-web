import { afterEach, describe, expect, it, vi } from 'vitest'
import { runBenchmarkItem, runBenchmarkManifest } from './runner'
import type { BenchmarkDatasetItem, BenchmarkDatasetManifest } from './types'

const validItem: BenchmarkDatasetItem = {
  id: 'slitherlink-3x3-0001',
  puzzleType: 'slitherlink',
  sourceUrl: 'https://puzz.link/p?slither/3/3/g0h',
  width: 3,
  height: 3,
  tags: ['auto-imported'],
}

describe('benchmark runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits schema-v2 compact results and preserves off/summary outcomes', () => {
    const off = runBenchmarkItem(validItem, {
      maxSteps: 1,
      timeoutMs: 60_000,
      telemetry: 'off',
    })
    const summary = runBenchmarkItem(validItem, {
      maxSteps: 1,
      timeoutMs: 60_000,
      telemetry: 'summary',
    })

    expect(summary.status).toBe(off.status)
    expect(summary.stepCount).toBe(off.stepCount)
    expect(summary.terminal).toEqual(off.terminal)
    expect(summary.ruleUsage).toEqual(off.ruleUsage)
    expect(summary).not.toHaveProperty('steps')
    expect(summary).not.toHaveProperty('ruleSteps')
    expect(off.telemetry).toBeUndefined()
    expect(summary.telemetry?.ruleAttempts.totalAttemptCount).toBeGreaterThan(0)
    expect(summary.telemetry?.strongInference.coverage.status).toBe('none')
    expect(
      summary.telemetry?.strongInference.coverage.unsupportedRules.map(
        (rule) => rule.ruleId,
      ),
    ).toEqual([
      'color-assumption-inference',
      'sector-parity-inference',
      'strong-inference',
    ])
  })

  it('reports time-capped runs without crashing', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(2)

    const result = runBenchmarkItem(validItem, {
      maxSteps: 2000,
      timeoutMs: 1,
      telemetry: 'summary',
    })

    expect(result.status).toBe('time-capped')
    expect(result.stepCount).toBe(0)
  })

  it('keeps collectors isolated and aggregates item summaries', () => {
    const manifest: BenchmarkDatasetManifest = {
      schemaVersion: 1,
      id: 'two-items',
      title: 'Two Items',
      puzzleType: 'slitherlink',
      items: [validItem, { ...validItem, id: 'second' }],
    }
    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      timeoutMs: 60_000,
      telemetry: 'summary',
    })
    const [first, second] = report.items

    expect(report.schemaVersion).toBe(2)
    expect(Object.keys(first.telemetry?.ruleAttempts.rules ?? {})).toEqual(
      Object.keys(second.telemetry?.ruleAttempts.rules ?? {}),
    )
    expect(first.telemetry?.ruleAttempts.totalAttemptCount).toBe(
      second.telemetry?.ruleAttempts.totalAttemptCount,
    )
    expect(report.summary.telemetry?.ruleAttempts.totalAttemptCount).toBe(
      (first.telemetry?.ruleAttempts.totalAttemptCount ?? 0) * 2,
    )
    expect(report.summary.telemetry?.ruleAttempts.finalNoHitScan).toBeNull()
  })

  it('keeps running after per-item parse errors', () => {
    const manifest: BenchmarkDatasetManifest = {
      schemaVersion: 1,
      id: 'mixed',
      title: 'Mixed',
      puzzleType: 'slitherlink',
      items: [
        validItem,
        {
          ...validItem,
          id: 'bad-url',
          sourceUrl: 'https://example.com/not-a-puzzle',
        },
      ],
    }

    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      timeoutMs: 60_000,
      telemetry: 'summary',
    })

    expect(report.summary.total).toBe(2)
    expect(report.summary.parseError).toBe(1)
    expect(report.items.map((item) => item.id)).toEqual([
      'slitherlink-3x3-0001',
      'bad-url',
    ])
  })
})
