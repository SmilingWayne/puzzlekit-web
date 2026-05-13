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

  it('reports step-capped runs when maxSteps is reached before completion', () => {
    const result = runBenchmarkItem(validItem, {
      maxSteps: 1,
      timeoutMs: 60_000,
    })

    expect(result.status).toBe('step-capped')
    expect(result.stepCount).toBe(1)
    expect(result.steps).toEqual([])
    expect(result.ruleSteps).toEqual({
      [Object.keys(result.ruleUsage)[0]]: [1],
    })
  })

  it('reports time-capped runs without crashing', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(2)

    const result = runBenchmarkItem(validItem, { maxSteps: 2000, timeoutMs: 1 })

    expect(result.status).toBe('time-capped')
    expect(result.stepCount).toBe(0)
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
    })

    expect(report.summary.total).toBe(2)
    expect(report.summary.parseError).toBe(1)
    expect(report.items.map((item) => item.id)).toEqual([
      'slitherlink-3x3-0001',
      'bad-url',
    ])
  })
})
