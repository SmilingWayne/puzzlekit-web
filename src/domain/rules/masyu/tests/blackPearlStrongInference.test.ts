import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { Rule } from '../../types'
import { masyuPlugin } from '../../../plugins/masyuPlugin'
import { createBlackPearlStrongInferenceRule } from '../rules/blackPearlStrongInference'
import { deterministicMasyuRules } from '../rules'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu black pearl strong inference', () => {
  it('crosses out a black pearl exit whose two-step assumption causes a degree contradiction', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'line')
    const north = lineKey([1, 2], [2, 2])

    const result = createBlackPearlStrongInferenceRule(() => []).apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank' })
    expect(result?.affectedCells).toEqual([cellKey(2, 2)])
    expect(result?.affectedLines).toEqual([north])
    expect(result?.message).toContain('cell-degree contradiction')
    expect(result?.inferenceDetails).toMatchObject({
      kind: 'masyu-strong',
      defaultBranchId: 'assumption',
      branches: [
        {
          role: 'trial',
          status: 'contradiction',
          contradiction: { kind: 'cell-degree', cells: [cellKey(1, 2)] },
        },
        {
          role: 'forced-conclusion',
          status: 'forced',
          initialDiffs: result?.diffs,
        },
      ],
    })
  })

  it('uses deterministic downstream rules to find a contradiction', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    const north = lineKey([1, 2], [2, 2])
    const westOfNeighbor = lineKey([1, 1], [1, 2])
    const eastOfNeighbor = lineKey([1, 2], [1, 3])
    const downstreamRule: Rule = {
      id: 'test-downstream-degree',
      name: 'Test Downstream Degree',
      apply: (trial) => {
        if ((trial.lines[north]?.mark ?? 'unknown') !== 'line') {
          return null
        }
        if ((trial.lines[westOfNeighbor]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'Force a downstream contradiction',
          diffs: [
            {
              kind: 'line',
              lineKey: westOfNeighbor,
              from: 'unknown',
              to: 'line',
            },
            {
              kind: 'line',
              lineKey: eastOfNeighbor,
              from: 'unknown',
              to: 'line',
            },
          ],
          affectedCells: [],
          affectedLines: [westOfNeighbor, eastOfNeighbor],
        }
      },
    }

    const result = createBlackPearlStrongInferenceRule(() => [
      downstreamRule,
    ]).apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank' })
    expect(result?.message).toContain('after 1 step')
    expect(result?.inferenceDetails?.branches[0].traceSteps).toMatchObject([
      {
        ruleId: 'test-downstream-degree',
        affectedLines: [westOfNeighbor, eastOfNeighbor],
      },
    ])
  })

  it('does not copy a solved trial board back into the real puzzle', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    const north = lineKey([1, 2], [2, 2])
    const unrelated = lineKey([4, 3], [4, 4])
    const harmlessRule: Rule = {
      id: 'test-harmless-trial-progress',
      name: 'Test Harmless Trial Progress',
      apply: (trial) => {
        if ((trial.lines[north]?.mark ?? 'unknown') !== 'line') {
          return null
        }
        if ((trial.lines[unrelated]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'Harmless trial-only progress',
          diffs: [
            { kind: 'line', lineKey: unrelated, from: 'unknown', to: 'line' },
          ],
          affectedCells: [],
          affectedLines: [unrelated],
        }
      },
    }

    const result = createBlackPearlStrongInferenceRule(() => [harmlessRule], {
      maxTrialSteps: 1,
    }).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[unrelated]?.mark).toBe('unknown')
  })

  it('does not retry a settled trial at higher budgets', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    let attempts = 0
    const settledRule: Rule = {
      id: 'test-settled-trial',
      name: 'Test Settled Trial',
      apply: () => {
        attempts += 1
        return null
      },
    }

    const result = createBlackPearlStrongInferenceRule(() => [settledRule], {
      maxCandidates: 1,
      maxTrialSteps: 13,
    }).apply(puzzle)

    expect(result).toBeNull()
    expect(attempts).toBe(1)
  })

  it('retries a budget-limited trial at the next budget', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    const targetCell = cellKey(0, 0)
    let attempts = 0
    const progressingRule: Rule = {
      id: 'test-budget-limited-trial',
      name: 'Test Budget Limited Trial',
      apply: (trial) => {
        attempts += 1
        const fromFill = trial.cells[targetCell]?.fill ?? null
        return {
          message: 'Keep the trial progressing',
          diffs: [
            {
              kind: 'cell',
              cellKey: targetCell,
              fromFill,
              toFill: fromFill === 'a' ? 'b' : 'a',
            },
          ],
          affectedCells: [targetCell],
        }
      },
    }

    const result = createBlackPearlStrongInferenceRule(
      () => [progressingRule],
      { maxCandidates: 1, maxTrialSteps: 13 },
    ).apply(puzzle)

    expect(result).toBeNull()
    expect(attempts).toBe(25)
  })

  it('returns null when the trial budget times out', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')

    const result = createBlackPearlStrongInferenceRule(() => [], {
      maxMs: -1,
    }).apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not overwrite an already decided first exit segment', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    const north = lineKey([1, 2], [2, 2])
    markLine(puzzle, north, 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'line')

    const result = createBlackPearlStrongInferenceRule(() => []).apply(puzzle)

    expect(result?.diffs).not.toContainEqual({
      kind: 'line',
      lineKey: north,
      from: 'line',
      to: 'blank',
    })
    expect(puzzle.lines[north]?.mark).toBe('line')
  })

  it('registers strong inference after the deterministic Masyu rules', () => {
    const rules = masyuPlugin.getRules()

    expect(
      rules.slice(0, deterministicMasyuRules.length).map((rule) => rule.id),
    ).toEqual(deterministicMasyuRules.map((rule) => rule.id))
    expect(rules.at(-3)?.id).toBe('masyu-black-pearl-strong-inference')
    expect(rules.at(-2)?.id).toBe(
      'masyu-line-component-endpoint-strong-inference',
    )
    expect(rules.at(-1)?.id).toBe('masyu-white-pearl-strong-inference')
  })
})
