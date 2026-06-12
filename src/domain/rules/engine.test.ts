import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../parsers/puzzlink'
import { tileKey, vertexKey } from '../ir/keys'
import { createMasyuPuzzle } from '../ir/masyu'
import { applyRuleDiffs, revertRuleDiffs, runNextRule } from './engine'
import { slitherRules } from './slither/rules'
import type { Rule, RuleAttemptEvent, RuleDiff } from './types'

describe('rule engine', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds at least one step for simple zero clue puzzle', () => {
    const puzzle = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/3/3/g0h',
    )
    const result = runNextRule(puzzle, slitherRules, 1)
    expect(result.step).not.toBeNull()
    expect(result.step?.diffs.length).toBeGreaterThan(0)
    expect(result.step?.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.step?.chainDurationMs).toBe(result.step?.durationMs)
    expect(result.step?.ruleApplyMs).toBeGreaterThanOrEqual(0)
    expect(result.step?.ruleAttempts?.at(-1)?.hit).toBe(true)
  })

  it('shares one runtime context across attempted rules in a solver step', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const line = Object.keys(puzzle.lines)[0]
    const rules: Rule[] = [
      {
        id: 'miss',
        name: 'Miss',
        apply: (_puzzle, runtimeContext) => {
          runtimeContext?.cache.set('shared-value', 41)
          return null
        },
      },
      {
        id: 'hit',
        name: 'Hit',
        apply: (_puzzle, runtimeContext) => {
          const value = runtimeContext?.cache.get('shared-value')
          return {
            message: `shared ${String(value)}`,
            diffs: [
              { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
            ],
            affectedCells: [],
          }
        },
      },
    ]

    const result = runNextRule(puzzle, rules, 1)

    expect(result.step?.message).toBe('shared 41')
    expect(result.step?.ruleAttempts).toHaveLength(2)
    expect(result.step?.ruleAttempts?.map((attempt) => attempt.hit)).toEqual([
      false,
      true,
    ])
  })

  it('reports ordered miss and hit rule attempts through an optional observer', () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(8)
      .mockReturnValueOnce(10)

    const puzzle = createMasyuPuzzle(1, 2)
    const line = Object.keys(puzzle.lines)[0]
    const events: RuleAttemptEvent[] = []
    const rules: Rule[] = [
      { id: 'miss', name: 'Miss', apply: () => null },
      {
        id: 'hit',
        name: 'Hit',
        apply: () => ({
          message: 'hit',
          diffs: [
            { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
          ],
          affectedCells: [],
        }),
      },
    ]

    const result = runNextRule(puzzle, rules, 7, {
      observer: {
        onRuleAttemptCompleted: (event) => events.push(event),
      },
    })

    expect(result.step?.ruleId).toBe('hit')
    expect(events).toEqual([
      {
        solverStepNumber: 7,
        ruleId: 'miss',
        ruleName: 'Miss',
        hit: false,
        durationMs: 2,
        producedDiffCount: 0,
      },
      {
        solverStepNumber: 7,
        ruleId: 'hit',
        ruleName: 'Hit',
        hit: true,
        durationMs: 3,
        producedDiffCount: 1,
      },
    ])
  })

  it('reports every rule in a final no-hit scan', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const events: RuleAttemptEvent[] = []
    const rules: Rule[] = [
      { id: 'miss-null', name: 'Miss Null', apply: () => null },
      {
        id: 'miss-empty',
        name: 'Miss Empty',
        apply: () => ({
          message: 'empty',
          diffs: [],
          affectedCells: [],
        }),
      },
    ]

    const result = runNextRule(puzzle, rules, 9, {
      observer: {
        onRuleAttemptCompleted: (event) => events.push(event),
      },
    })

    expect(result).toEqual({ nextPuzzle: puzzle, step: null })
    expect(events.map(({ ruleId, hit, producedDiffCount }) => ({
      ruleId,
      hit,
      producedDiffCount,
    }))).toEqual([
      { ruleId: 'miss-null', hit: false, producedDiffCount: 0 },
      { ruleId: 'miss-empty', hit: false, producedDiffCount: 0 },
    ])
  })

  it('isolates observer callback errors from solver behavior', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const line = Object.keys(puzzle.lines)[0]
    const rules: Rule[] = [
      { id: 'miss', name: 'Miss', apply: () => null },
      {
        id: 'hit',
        name: 'Hit',
        apply: () => ({
          message: 'hit',
          diffs: [
            { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
          ],
          affectedCells: [],
        }),
      },
    ]

    const baseline = runNextRule(puzzle, rules, 1)
    const observed = runNextRule(puzzle, rules, 1, {
      observer: {
        onRuleAttemptCompleted: () => {
          throw new Error('observer failed')
        },
      },
    })

    expect(observed.step?.ruleId).toBe(baseline.step?.ruleId)
    expect(observed.step?.diffs).toEqual(baseline.step?.diffs)
    expect(observed.nextPuzzle).toEqual(baseline.nextPuzzle)
  })

  it('applies and reverts diffs without mutating input puzzle', () => {
    const puzzle = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/3/3/g0h',
    )
    const edgeKey = Object.keys(puzzle.edges)[0]
    const sectorKey = Object.keys(puzzle.sectors)[0]
    const centerVertexKey = vertexKey(1, 1)
    const fromCandidates = puzzle.vertices[centerVertexKey].candidateEdgeSets
    const toCandidates = fromCandidates.slice(0, 2)
    const diffs: RuleDiff[] = [
      {
        kind: 'edge',
        edgeKey,
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'sector',
        sectorKey,
        fromMask: puzzle.sectors[sectorKey].constraintsMask,
        toMask: 1,
      },
      {
        kind: 'cell',
        cellKey: '0,0',
        fromFill: null,
        toFill: 'green',
      },
      {
        kind: 'vertex',
        vertexKey: centerVertexKey,
        fromCandidates,
        toCandidates,
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.edges[edgeKey].mark).toBe('line')
    expect(next.sectors[sectorKey].constraintsMask).toBe(1)
    expect(next.cells['0,0']?.fill).toBe('green')
    expect(next.vertices[centerVertexKey].candidateEdgeSets).toEqual(
      toCandidates,
    )
    expect(puzzle.edges[edgeKey].mark).toBe('unknown')
    expect(puzzle.cells['0,0']?.fill).toBeUndefined()
    expect(puzzle.vertices[centerVertexKey].candidateEdgeSets).toEqual(
      fromCandidates,
    )

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.edges[edgeKey].mark).toBe('unknown')
    expect(rewound.sectors[sectorKey].constraintsMask).toBe(
      puzzle.sectors[sectorKey].constraintsMask,
    )
    expect(rewound.cells['0,0']?.fill).toBeUndefined()
    expect(rewound.vertices[centerVertexKey].candidateEdgeSets).toEqual(
      fromCandidates,
    )
  })

  it('applies and reverts line diffs without mutating input puzzle', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const lineKey = Object.keys(puzzle.lines)[0]
    const diffs: RuleDiff[] = [
      {
        kind: 'line',
        lineKey,
        from: 'unknown',
        to: 'line',
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.lines[lineKey].mark).toBe('line')
    expect(puzzle.lines[lineKey].mark).toBe('unknown')

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.lines[lineKey].mark).toBe('unknown')
  })

  it('applies and reverts tile fill diffs without mutating input puzzle', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const key = tileKey(1, 1)
    const diffs: RuleDiff[] = [
      {
        kind: 'tile',
        tileKey: key,
        fromFill: null,
        toFill: 'green',
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.tiles[key]?.fill).toBe('green')
    expect(puzzle.tiles[key]?.fill).toBeUndefined()

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.tiles[key]?.fill).toBeUndefined()
  })
})
