import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey, sectorKey, tileKey, vertexKey } from '../ir/keys'
import { createMasyuPuzzle } from '../ir/masyu'
import { createSlitherPuzzle } from '../ir/slither'
import type { RuleStep } from '../rules/types'
import {
  appendTraceStatsStep,
  buildRuleTraceStats,
  buildTraceChartStats,
  buildTraceStatsView,
  createTraceStatsCache,
  rebuildTraceStatsCache,
  truncateTraceStatsCache,
} from './traceStats'

const makeStep = (
  index: number,
  ruleId: string,
  ruleName: string,
  durationMs: number,
  diffs: RuleStep['diffs'],
): RuleStep => ({
  id: `step-${index}`,
  ruleId,
  ruleName,
  message: `step ${index}`,
  diffs,
  affectedCells: [],
  affectedEdges: diffs.flatMap((diff) =>
    diff.kind === 'edge' ? [diff.edgeKey] : [],
  ),
  affectedSectors: diffs.flatMap((diff) =>
    diff.kind === 'sector' ? [diff.sectorKey] : [],
  ),
  timestamp: index,
  durationMs,
})

describe('buildRuleTraceStats', () => {
  it('builds rule usage and rule step indices for the active prefix', () => {
    const steps: RuleStep[] = [
      makeStep(1, 'rule-a', 'Rule A', 2, [
        { kind: 'edge', edgeKey: '0,0-0,1', from: 'unknown', to: 'line' },
      ]),
      makeStep(2, 'rule-b', 'Rule B', 3, [
        { kind: 'cell', cellKey: '0,0', fromFill: null, toFill: 'green' },
      ]),
      makeStep(3, 'rule-a', 'Rule A', 5, [
        { kind: 'sector', sectorKey: '0,0,nw', fromMask: 7, toMask: 2 },
      ]),
    ]

    const stats = buildRuleTraceStats(steps, 3)

    expect(stats.ruleUsage).toEqual({ 'rule-a': 2, 'rule-b': 1 })
    expect(stats.ruleSteps).toEqual({ 'rule-a': [1, 3], 'rule-b': [2] })
    expect(stats.totalDurationMs).toBe(10)
    expect(stats.diffCounts).toEqual({
      edge: 1,
      line: 0,
      sector: 1,
      cell: 1,
      tile: 0,
      vertex: 0,
    })
  })

  it('keeps all full-trace rules visible when the active prefix has not used them yet', () => {
    const steps: RuleStep[] = [
      makeStep(1, 'rule-a', 'Rule A', 1, []),
      makeStep(2, 'rule-b', 'Rule B', 1, []),
    ]

    const stats = buildRuleTraceStats(steps, 1)

    expect(stats.rules.map((rule) => rule.ruleId)).toEqual(['rule-a', 'rule-b'])
    expect(stats.rules[0]).toMatchObject({ count: 1, steps: [1] })
    expect(stats.rules[1]).toMatchObject({ count: 0, steps: [] })
    expect(stats.uniqueRulesUsed).toBe(1)
  })

  it('clamps pointer and reports trace progress as generated-trace progress', () => {
    const steps: RuleStep[] = [
      makeStep(1, 'rule-a', 'Rule A', 1, []),
      makeStep(2, 'rule-b', 'Rule B', 1, []),
    ]

    expect(buildRuleTraceStats(steps, -10).pointer).toBe(0)
    expect(buildRuleTraceStats(steps, 99).pointer).toBe(2)
    expect(buildRuleTraceStats(steps, 1).traceProgressRatio).toBe(0.5)
  })

  it('uses rule apply time for per-rule timing and chain time for total timing', () => {
    const steps: RuleStep[] = [
      {
        ...makeStep(1, 'late-rule', 'Late Rule', 50, []),
        chainDurationMs: 50,
        ruleApplyMs: 7,
      },
    ]

    const stats = buildRuleTraceStats(steps, 1)

    expect(stats.totalDurationMs).toBe(50)
    expect(stats.rules[0].durationMs).toBe(7)
  })
})

describe('buildTraceChartStats', () => {
  it('starts with a step zero chart point from the initial puzzle', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const stats = buildTraceChartStats(puzzle, [], 0)

    expect(stats.points).toHaveLength(1)
    expect(stats.current.step).toBe(0)
    expect(stats.current.coverageRatios.edge).toBe(0)
    expect(stats.coverageTotals).toMatchObject({ edge: 4, cell: 1, vertex: 4, sector: 4 })
    expect(stats.current.stepDurationMs).toBe(0)
    expect(stats.current.ruleApplyMs).toBe(0)
  })

  it('tracks edge board progress and edge coverage as edge diffs are applied', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const topEdge = edgeKey([0, 0], [0, 1])
    const bottomEdge = edgeKey([1, 0], [1, 1])
    const steps: RuleStep[] = [
      makeStep(1, 'edge-rule', 'Edge Rule', 1, [
        { kind: 'edge', edgeKey: topEdge, from: 'unknown', to: 'line' },
      ]),
      makeStep(2, 'edge-rule', 'Edge Rule', 1, [
        { kind: 'edge', edgeKey: bottomEdge, from: 'unknown', to: 'blank' },
      ]),
    ]

    const stats = buildTraceChartStats(puzzle, steps, 2)

    expect(stats.points.map((point) => point.coverageRatios.edge)).toEqual([
      0, 0.25, 0.5,
    ])
  })

  it('tracks Masyu line decisions as board progress', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const line = Object.keys(puzzle.lines)[0]
    const steps: RuleStep[] = [
      makeStep(1, 'line-rule', 'Line Rule', 1, [
        { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
      ]),
    ]

    const stats = buildTraceChartStats(puzzle, steps, 1)

    expect(stats.coverageTotals.line).toBe(1)
    expect(stats.current.coverageRatios.line).toBe(1)
    expect(stats.current.coverageRatios.edge).toBe(0)
  })

  it('tracks cell coverage from filled cells', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const steps: RuleStep[] = [
      makeStep(1, 'cell-rule', 'Cell Rule', 1, [
        {
          kind: 'cell',
          cellKey: cellKey(0, 0),
          fromFill: null,
          toFill: 'green',
        },
      ]),
    ]

    const stats = buildTraceChartStats(puzzle, steps, 1)

    expect(stats.current.coverageRatios.cell).toBe(0.25)
  })

  it('tracks vertex coverage from narrowed vertex candidates', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const targetVertex = vertexKey(0, 0)
    const initialCandidates = puzzle.vertices[targetVertex].candidateEdgeSets
    const steps: RuleStep[] = [
      makeStep(1, 'vertex-rule', 'Vertex Rule', 1, [
        {
          kind: 'vertex',
          vertexKey: targetVertex,
          fromCandidates: initialCandidates,
          toCandidates: [initialCandidates[0]],
        },
      ]),
    ]

    const stats = buildTraceChartStats(puzzle, steps, 1)

    expect(stats.current.coverageRatios.vertex).toBe(0.25)
  })

  it('tracks tile colors and narrowed sector constraints', () => {
    const masyu = createMasyuPuzzle(1, 1)
    const tile = tileKey(0, 0)
    const masyuStats = buildTraceChartStats(
      masyu,
      [makeStep(1, 'tile-rule', 'Tile Rule', 2, [
        { kind: 'tile', tileKey: tile, fromFill: null, toFill: 'green' },
      ])],
      1,
    )

    const slither = createSlitherPuzzle(1, 1)
    const sector = sectorKey(0, 0, 'nw')
    const slitherStats = buildTraceChartStats(
      slither,
      [makeStep(1, 'sector-rule', 'Sector Rule', 3, [
        { kind: 'sector', sectorKey: sector, fromMask: 7, toMask: 2 },
      ])],
      1,
    )

    expect(masyuStats.current.coverageRatios.tile).toBe(1 / 4)
    expect(slitherStats.current.coverageRatios.sector).toBe(1 / 4)
  })

  it('stores full-step and matched-rule duration at each chart point', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const step = {
      ...makeStep(1, 'late-rule', 'Late Rule', 50, []),
      chainDurationMs: 50,
      ruleApplyMs: 7,
    }

    const stats = buildTraceChartStats(puzzle, [step], 1)

    expect(stats.points.map((point) => point.stepDurationMs)).toEqual([0, 50])
    expect(stats.points.map((point) => point.ruleApplyMs)).toEqual([0, 7])
  })

  it('clamps pointer when selecting the current chart point', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const topEdge = edgeKey([0, 0], [0, 1])
    const steps: RuleStep[] = [
      makeStep(1, 'edge-rule', 'Edge Rule', 1, [
        { kind: 'edge', edgeKey: topEdge, from: 'unknown', to: 'line' },
      ]),
    ]

    expect(buildTraceChartStats(puzzle, steps, 99).current.step).toBe(1)
    expect(buildTraceChartStats(puzzle, steps, -10).current.step).toBe(0)
  })
})

describe('incremental trace stats cache', () => {
  it('initializes cache with a step zero chart point', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const cache = createTraceStatsCache(puzzle)
    const view = buildTraceStatsView(cache, 0)

    expect(cache.points).toHaveLength(1)
    expect(view.current.step).toBe(0)
    expect(view.current.coverageRatios.edge).toBe(0)
    expect(view.coverageTotals.edge).toBe(4)
  })

  it('increments edge, cell, and vertex coverage from appended diffs', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const targetVertex = vertexKey(0, 0)
    const initialCandidates = puzzle.vertices[targetVertex].candidateEdgeSets
    const step = makeStep(1, 'mixed-rule', 'Mixed Rule', 4, [
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 0], [0, 1]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'cell',
        cellKey: cellKey(0, 0),
        fromFill: null,
        toFill: 'yellow',
      },
      {
        kind: 'vertex',
        vertexKey: targetVertex,
        fromCandidates: initialCandidates,
        toCandidates: [initialCandidates[0]],
      },
    ])

    const cache = appendTraceStatsStep(createTraceStatsCache(puzzle), step)
    const view = buildTraceStatsView(cache, 1)

    expect(view.current.coverageRatios.edge).toBe(1 / 12)
    expect(view.current.coverageRatios.cell).toBe(0.25)
    expect(view.current.coverageRatios.vertex).toBe(1 / 9)
    expect(view.totalDurationMs).toBe(4)
    expect(view.diffCounts).toMatchObject({ edge: 1, cell: 1, vertex: 1 })
  })

  it('does not count an unchanged vertex candidate set as narrowed', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const targetVertex = vertexKey(0, 0)
    const initialCandidates = puzzle.vertices[targetVertex].candidateEdgeSets
    const step = makeStep(1, 'vertex-rule', 'Vertex Rule', 1, [
      {
        kind: 'vertex',
        vertexKey: targetVertex,
        fromCandidates: initialCandidates,
        toCandidates: initialCandidates,
      },
    ])

    const cache = appendTraceStatsStep(createTraceStatsCache(puzzle), step)

    expect(buildTraceStatsView(cache, 1).current.coverageRatios.vertex).toBe(0)
  })

  it('truncates a future branch and rebuilds prefix totals', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const first = makeStep(1, 'rule-a', 'Rule A', 2, [
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 0], [0, 1]),
        from: 'unknown',
        to: 'line',
      },
    ])
    const second = makeStep(2, 'rule-b', 'Rule B', 3, [
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 0], [1, 1]),
        from: 'unknown',
        to: 'blank',
      },
    ])
    const cache = rebuildTraceStatsCache(puzzle, [first, second])

    const truncated = truncateTraceStatsCache(puzzle, cache, [first, second], 1)
    const view = buildTraceStatsView(truncated, 1)

    expect(truncated.points).toHaveLength(2)
    expect(view.totalDurationMs).toBe(2)
    expect(view.rules.map((rule) => rule.ruleId)).toEqual(['rule-a'])
    expect(view.current.coverageRatios.edge).toBe(0.25)
  })

  it('keeps full generated rule rows visible while building an earlier pointer view', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const first = makeStep(1, 'rule-a', 'Rule A', 1, [])
    const second = makeStep(2, 'rule-b', 'Rule B', 1, [])
    const cache = rebuildTraceStatsCache(puzzle, [first, second])

    const view = buildTraceStatsView(cache, 1)

    expect(view.rules.map((rule) => rule.ruleId)).toEqual(['rule-a', 'rule-b'])
    expect(view.rules[0]).toMatchObject({ count: 1, steps: [1] })
    expect(view.rules[1]).toMatchObject({ count: 0, steps: [] })
    expect(buildTraceStatsView(cache, 99).pointer).toBe(2)
  })
})
