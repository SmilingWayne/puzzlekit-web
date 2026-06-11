import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey, sectorKey, vertexKey } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import type { Rule } from '../../types'
import {
  findHardContradictionReason,
  runTrialUntilFixpoint,
} from '../rules/trial'
import { setClue } from './testUtils'

describe('slither trial diagnostics', () => {
  it('reports vertex-degree contradiction locations', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 1], [1, 2])].mark = 'line'

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('vertex-degree')
    expect(reason?.message).toContain('V(1, 1)')
    expect(reason?.vertices).toEqual([vertexKey(1, 1)])
  })

  it('reports cell-clue contradiction locations', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    setClue(puzzle, 0, 0, 0)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('cell-clue')
    expect(reason?.message).toContain('(R1, C1)')
    expect(reason?.cells).toEqual([cellKey(0, 0)])
  })

  it('reports sector-mask contradiction locations', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const targetSector = sectorKey(0, 0, 'nw')
    puzzle.sectors[targetSector].constraintsMask = 0

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('sector-mask')
    expect(reason?.message).toContain('(R1, C1, NW)')
    expect(reason?.sectors).toEqual([targetSector])
  })

  it('reports vertex-candidates contradiction locations', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.vertices[vertexKey(0, 0)].candidateEdgeSets = []

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('vertex-candidates')
    expect(reason?.message).toContain('V(0, 0)')
  })

  it('reports color-edge contradiction locations', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    const shared = edgeKey([0, 1], [1, 1])
    puzzle.edges[shared].mark = 'line'

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('color-edge')
    expect(reason?.message).toContain('edge V(0, 1)-V(1, 1)')
    expect(reason?.edges).toEqual([shared])
  })

  it('reports line-loop contradiction shape', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([2, 1], [2, 2])].mark = 'line'

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('line-loop')
    expect(reason?.message).toContain('closed loop')
  })

  it('reports disconnected-green contradiction locations', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }

    const reason = findHardContradictionReason(puzzle)

    expect(reason?.kind).toBe('disconnected-green')
    expect(reason?.message).toContain('(R1, C3)')
  })

  it('reports zero trial steps for immediate contradictions', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = runTrialUntilFixpoint(
      puzzle,
      [],
      10,
      Number.POSITIVE_INFINITY,
    )

    expect(result.contradiction).toBe(true)
    expect(result.stepsRun).toBe(0)
    expect(result.contradictionReason?.kind).toBe('color-edge')
  })

  it('keeps exhausted trial behavior while reporting steps run', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    const target = edgeKey([0, 0], [0, 1])
    const oneStepRule: Rule = {
      id: 'trial-diagnostic-one-step',
      name: 'Trial Diagnostic One Step',
      apply: (trial) => {
        if ((trial.edges[target]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'test one trial step',
          diffs: [
            { kind: 'edge', edgeKey: target, from: 'unknown', to: 'blank' },
          ],
          affectedCells: [],
        }
      },
    }

    const result = runTrialUntilFixpoint(
      puzzle,
      [oneStepRule],
      1,
      Number.POSITIVE_INFINITY,
    )

    expect(result.contradiction).toBe(false)
    expect(result.exhausted).toBe(true)
    expect(result.stepsRun).toBe(1)
  })
})
