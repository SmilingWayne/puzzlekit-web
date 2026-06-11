import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { Rule } from '../../types'
import {
  findMasyuHardContradictionReason,
  runMasyuTrialUntilFixpoint,
} from '../rules/trial'
import { markLine } from './testUtils'

describe('Masyu hard contradiction detection', () => {
  it('treats a degree-1 empty cell as closed when every unknown exit would overflow its other endpoint', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [2, 0]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 0]), 'line')

    const reason = findMasyuHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('cell-degree')
    expect(reason?.message).toContain('only one line segment')
  })

  it('records trial steps and structured contradiction focus', () => {
    const puzzle = createMasyuPuzzle(2, 3)
    const target = lineKey([0, 0], [0, 1])
    const overflowA = lineKey([0, 1], [0, 2])
    const overflowB = lineKey([0, 1], [1, 1])
    const rule: Rule = {
      id: 'test-trial-trace',
      name: 'Test Trial Trace',
      apply: () => ({
        message: 'Create a focused contradiction',
        diffs: [
          { kind: 'line', lineKey: target, from: 'unknown', to: 'line' },
          { kind: 'line', lineKey: overflowA, from: 'unknown', to: 'line' },
          { kind: 'line', lineKey: overflowB, from: 'unknown', to: 'line' },
        ],
        affectedCells: [cellKey(0, 1)],
        affectedLines: [target, overflowA, overflowB],
      }),
    }

    const result = runMasyuTrialUntilFixpoint(
      puzzle,
      [rule],
      1,
      Date.now() + 1000,
    )

    expect(result.contradictionReason).toMatchObject({
      kind: 'cell-degree',
      cells: [cellKey(0, 1)],
    })
    expect(result.traceSteps).toMatchObject([
      {
        ruleId: 'test-trial-trace',
        affectedLines: [target, overflowA, overflowB],
      },
    ])
  })
})
