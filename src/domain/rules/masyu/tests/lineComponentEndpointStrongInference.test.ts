import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { Rule } from '../../types'
import { createLineComponentEndpointStrongInferenceRule } from '../rules/lineComponentEndpointStrongInference'
import { addPearl, expectLineDiffs, markLine } from './testUtils'

describe('Masyu line component endpoint strong inference', () => {
  it('crosses out a two-direction endpoint continuation that causes a contradiction', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const endpoint = cellKey(0, 1)
    const west = lineKey([0, 0], [0, 1])
    const east = lineKey([0, 1], [0, 2])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')

    const result = createLineComponentEndpointStrongInferenceRule(() => []).apply(
      puzzle,
    )

    expect(result?.affectedCells).toEqual([endpoint])
    expectLineDiffs(result?.diffs, { [east]: 'blank' })
    expect(result?.message).toContain('1-segment component')
    expect(result?.message).toContain('among 2 candidate directions')
    expect(result?.inferenceDetails?.branches[0]).toMatchObject({
      status: 'contradiction',
      contradiction: { kind: 'cell-degree', cells: [cellKey(0, 2)] },
    })
    expect(result?.inferenceDetails?.branches[1]).toMatchObject({
      status: 'forced',
      initialDiffs: result?.diffs,
    })
  })

  it('tests a three-direction endpoint and only crosses out the failing direction', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    const west = lineKey([1, 0], [1, 1])
    const north = lineKey([0, 1], [1, 1])
    const east = lineKey([1, 1], [1, 2])
    const south = lineKey([1, 1], [2, 1])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'blank')
    markLine(puzzle, lineKey([1, 0], [2, 0]), 'blank')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [0, 2]), 'line')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'blank')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'blank')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'blank')

    const result = createLineComponentEndpointStrongInferenceRule(() => []).apply(
      puzzle,
    )

    expectLineDiffs(result?.diffs, { [north]: 'blank' })
    expect(result?.message).toContain('among 3 candidate directions')
    expect(puzzle.lines[east]?.mark).toBe('unknown')
    expect(puzzle.lines[south]?.mark).toBe('unknown')
  })

  it('prioritizes endpoints with fewer candidate directions', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    const constrainedEndpoint = cellKey(0, 1)
    const constrainedEast = lineKey([0, 1], [0, 2])
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')

    markLine(puzzle, lineKey([3, 2], [3, 3]), 'line')
    markLine(puzzle, lineKey([3, 1], [3, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')
    markLine(puzzle, lineKey([3, 3], [3, 4]), 'blank')
    markLine(puzzle, lineKey([2, 3], [3, 3]), 'blank')

    const result = createLineComponentEndpointStrongInferenceRule(() => []).apply(
      puzzle,
    )

    expect(result?.affectedCells).toEqual([constrainedEndpoint])
    expectLineDiffs(result?.diffs, { [constrainedEast]: 'blank' })
  })

  it('prioritizes longer components when endpoint candidate counts match', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    const shortEast = lineKey([0, 1], [0, 2])
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'blank')

    const longNorth = lineKey([3, 3], [4, 3])
    markLine(puzzle, lineKey([4, 0], [4, 1]), 'line')
    markLine(puzzle, lineKey([4, 1], [4, 2]), 'line')
    markLine(puzzle, lineKey([4, 2], [4, 3]), 'line')
    markLine(puzzle, lineKey([3, 0], [4, 0]), 'blank')
    markLine(puzzle, lineKey([4, 3], [5, 3]), 'blank')

    const centerLines = [
      lineKey([2, 1], [2, 2]),
      lineKey([2, 2], [2, 3]),
      lineKey([1, 2], [2, 2]),
    ]
    const contradictionRule: Rule = {
      id: 'test-long-component-priority',
      name: 'Test Long Component Priority',
      apply: (trial) =>
        trial.lines[longNorth]?.mark === 'line' ||
        trial.lines[shortEast]?.mark === 'line'
          ? {
              message: 'Force a priority-test contradiction',
              diffs: centerLines.map((lineKeyValue) => ({
                kind: 'line' as const,
                lineKey: lineKeyValue,
                from: 'unknown' as const,
                to: 'line' as const,
              })),
              affectedCells: [],
              affectedLines: centerLines,
            }
          : null,
    }

    const result = createLineComponentEndpointStrongInferenceRule(() => [
      contradictionRule,
    ]).apply(puzzle)

    expectLineDiffs(result?.diffs, { [longNorth]: 'blank' })
    expect(result?.message).toContain('3-segment component')
  })

  it('can inspect a pearl that is also a component endpoint', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    const endpoint = cellKey(2, 2)
    const north = lineKey([1, 2], [2, 2])
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 0], [2, 1]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 0], [2, 0]), 'blank')
    markLine(puzzle, lineKey([2, 0], [3, 0]), 'blank')

    const result = createLineComponentEndpointStrongInferenceRule(() => []).apply(
      puzzle,
    )

    expect(result?.affectedCells).toEqual([endpoint])
    expectLineDiffs(result?.diffs, { [north]: 'blank' })
    expect(result?.message).toContain('component at (R3, C3)')
  })

  it('ignores branched line components', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')

    const result = createLineComponentEndpointStrongInferenceRule(() => []).apply(
      puzzle,
    )

    expect(result).toBeNull()
  })

  it('ignores closed components and endpoints with only one unknown exit', () => {
    const closed = createMasyuPuzzle(2, 2)
    markLine(closed, lineKey([0, 0], [0, 1]), 'line')
    markLine(closed, lineKey([0, 1], [1, 1]), 'line')
    markLine(closed, lineKey([1, 0], [1, 1]), 'line')
    markLine(closed, lineKey([0, 0], [1, 0]), 'line')

    const singleExit = createMasyuPuzzle(1, 3)
    markLine(singleExit, lineKey([0, 0], [0, 1]), 'line')

    const rule = createLineComponentEndpointStrongInferenceRule(() => [])
    expect(rule.apply(closed)).toBeNull()
    expect(rule.apply(singleExit)).toBeNull()
  })

  it('does not copy harmless trial progress back into the real puzzle', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const east = lineKey([0, 1], [0, 2])
    const unrelated = lineKey([2, 2], [2, 3])
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    const harmlessRule: Rule = {
      id: 'test-endpoint-harmless-progress',
      name: 'Test Endpoint Harmless Progress',
      apply: (trial) =>
        trial.lines[east]?.mark === 'line' &&
        trial.lines[unrelated]?.mark === 'unknown'
          ? {
              message: 'Harmless endpoint trial progress',
              diffs: [
                {
                  kind: 'line',
                  lineKey: unrelated,
                  from: 'unknown',
                  to: 'line',
                },
              ],
              affectedCells: [],
              affectedLines: [unrelated],
            }
          : null,
    }

    const result = createLineComponentEndpointStrongInferenceRule(() => [
      harmlessRule,
    ], { maxTrialSteps: 1 }).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[unrelated]?.mark).toBe('unknown')
  })

  it('honors timeout and candidate limits', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')

    expect(
      createLineComponentEndpointStrongInferenceRule(() => [], {
        maxMs: -1,
      }).apply(puzzle),
    ).toBeNull()
    expect(
      createLineComponentEndpointStrongInferenceRule(() => [], {
        maxCandidates: 1,
      }).apply(puzzle),
    ).not.toBeNull()
  })
})
