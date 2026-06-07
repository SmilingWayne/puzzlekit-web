import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { Rule } from '../../types'
import { createEmptyCellStrongInferenceRule } from '../rules/emptyCellStrongInference'
import { markLine, expectLineDiffs } from './testUtils'

describe('Masyu empty cell strong inference', () => {
  it('forces the opposite continuation when one degree-1 branch causes a degree contradiction', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const target = cellKey(0, 1)
    const west = lineKey([0, 0], [0, 1])
    const east = lineKey([0, 1], [0, 2])
    const south = lineKey([0, 1], [1, 1])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')

    const result = createEmptyCellStrongInferenceRule(() => [], {
      maxCandidates: 1,
    }).apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, {
      [south]: 'line',
      [east]: 'blank',
    })
    expect(result?.message).toContain('cell-degree contradiction')
    expect(result?.message).toContain('must be the continuation')
    expect(result?.inferenceDetails?.branches[0]).toMatchObject({
      status: 'contradiction',
      contradiction: { kind: 'cell-degree', cells: [cellKey(0, 2)] },
    })
    expect(result?.inferenceDetails?.branches[1]).toMatchObject({
      status: 'forced',
      initialDiffs: result?.diffs,
    })
  })

  it('crosses out both remaining exits when using both causes a contradiction', () => {
    const puzzle = createMasyuPuzzle(2, 3)
    const target = cellKey(0, 0)
    const east = lineKey([0, 0], [0, 1])
    const south = lineKey([0, 0], [1, 0])
    markLine(puzzle, lineKey([0, 1], [0, 2]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')

    const result = createEmptyCellStrongInferenceRule(() => [], {
      maxCandidates: 1,
    }).apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [south]: 'blank',
    })
    expect(result?.message).toContain('using both remaining exits')
    expect(result?.message).toContain('both remaining exits are crossed out')
  })

  it('forces both remaining exits when using neither causes a degree contradiction', () => {
    const puzzle = createMasyuPuzzle(2, 3)
    const target = cellKey(0, 0)
    const east = lineKey([0, 0], [0, 1])
    const south = lineKey([0, 0], [1, 0])
    markLine(puzzle, lineKey([0, 1], [0, 2]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'blank')

    const result = createEmptyCellStrongInferenceRule(() => []).apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, {
      [east]: 'line',
      [south]: 'line',
    })
    expect(result?.message).toContain('using neither remaining exit')
    expect(result?.message).toContain('both remaining exits must be lines')
  })

  it('uses deterministic downstream rules to find an empty-cell contradiction', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const target = cellKey(0, 1)
    const west = lineKey([0, 0], [0, 1])
    const east = lineKey([0, 1], [0, 2])
    const south = lineKey([0, 1], [1, 1])
    const eastOfEast = lineKey([0, 2], [0, 3])
    const southOfEast = lineKey([0, 2], [1, 2])
    markLine(puzzle, west, 'line')
    const downstreamRule: Rule = {
      id: 'test-empty-cell-downstream-degree',
      name: 'Test Empty Cell Downstream Degree',
      apply: (trial) => {
        if ((trial.lines[east]?.mark ?? 'unknown') !== 'line') {
          return null
        }
        if ((trial.lines[eastOfEast]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'Force downstream empty-cell contradiction',
          diffs: [
            {
              kind: 'line',
              lineKey: eastOfEast,
              from: 'unknown',
              to: 'line',
            },
            {
              kind: 'line',
              lineKey: southOfEast,
              from: 'unknown',
              to: 'line',
            },
          ],
          affectedCells: [],
          affectedLines: [eastOfEast, southOfEast],
        }
      },
    }

    const result = createEmptyCellStrongInferenceRule(() => [
      downstreamRule,
    ]).apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, {
      [south]: 'line',
      [east]: 'blank',
    })
    expect(result?.message).toContain('after 1 step')
  })

  it('does not copy empty-cell trial progress back into the real puzzle', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const west = lineKey([0, 0], [0, 1])
    const east = lineKey([0, 1], [0, 2])
    const unrelated = lineKey([2, 2], [2, 3])
    markLine(puzzle, west, 'line')
    const harmlessRule: Rule = {
      id: 'test-empty-cell-harmless-trial-progress',
      name: 'Test Empty Cell Harmless Trial Progress',
      apply: (trial) => {
        if ((trial.lines[east]?.mark ?? 'unknown') !== 'line') {
          return null
        }
        if ((trial.lines[unrelated]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'Harmless empty-cell trial-only progress',
          diffs: [
            { kind: 'line', lineKey: unrelated, from: 'unknown', to: 'line' },
          ],
          affectedCells: [],
          affectedLines: [unrelated],
        }
      },
    }

    const result = createEmptyCellStrongInferenceRule(() => [harmlessRule], {
      maxTrialSteps: 1,
    }).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[unrelated]?.mark).toBe('unknown')
  })

  it('returns null when the empty-cell trial budget times out', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'blank')

    const result = createEmptyCellStrongInferenceRule(() => [], {
      maxMs: -1,
    }).apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not force an opposite empty-cell branch through a degree-2 neighbor', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const west = lineKey([0, 0], [0, 1])
    const east = lineKey([0, 1], [0, 2])
    const south = lineKey([0, 1], [1, 1])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')

    const result = createEmptyCellStrongInferenceRule(() => [], {
      maxCandidates: 1,
    }).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[east]?.mark).toBe('unknown')
    expect(puzzle.lines[south]?.mark).toBe('unknown')
  })
})
