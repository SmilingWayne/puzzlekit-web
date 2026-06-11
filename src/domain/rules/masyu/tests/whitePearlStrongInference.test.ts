import { describe, expect, it } from 'vitest'
import { cellKey, lineKey, tileKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { Rule } from '../../types'
import { createWhitePearlStrongInferenceRule } from '../rules/whitePearlStrongInference'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu white pearl strong inference', () => {
  it('forces the opposite white pearl axis when one axis causes a tile-color contradiction', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    puzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(2, 3)] = { fill: 'yellow' }
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])
    const east = lineKey([2, 2], [2, 3])
    const west = lineKey([2, 1], [2, 2])

    const result = createWhitePearlStrongInferenceRule(() => []).apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'line',
      [west]: 'line',
      [north]: 'blank',
      [south]: 'blank',
    })
    expect(result?.affectedCells).toEqual([cellKey(2, 2)])
    expect(result?.affectedLines).toEqual([east, west, north, south])
    expect(result?.message).toContain('tile-color contradiction')
    expect(result?.message).toContain('must go horizontal')
    expect(result?.inferenceDetails?.branches[0]).toMatchObject({
      role: 'trial',
      status: 'contradiction',
      contradiction: { kind: 'tile-color' },
    })
    expect(result?.inferenceDetails?.branches[1]).toMatchObject({
      role: 'forced-conclusion',
      status: 'forced',
      initialDiffs: result?.diffs,
    })
  })

  it('uses deterministic downstream rules to find a white-axis contradiction', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])
    const east = lineKey([2, 2], [2, 3])
    const west = lineKey([2, 1], [2, 2])
    const westOfNeighbor = lineKey([1, 1], [1, 2])
    const eastOfNeighbor = lineKey([1, 2], [1, 3])
    const downstreamRule: Rule = {
      id: 'test-white-downstream-degree',
      name: 'Test White Downstream Degree',
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

    const result = createWhitePearlStrongInferenceRule(() => [
      downstreamRule,
    ]).apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'line',
      [west]: 'line',
      [north]: 'blank',
      [south]: 'blank',
    })
    expect(result?.message).toContain('after 1 step')
  })

  it('does not copy white trial progress back into the real puzzle', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    const north = lineKey([1, 2], [2, 2])
    const unrelated = lineKey([4, 3], [4, 4])
    const harmlessRule: Rule = {
      id: 'test-white-harmless-trial-progress',
      name: 'Test White Harmless Trial Progress',
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

    const result = createWhitePearlStrongInferenceRule(() => [harmlessRule], {
      maxTrialSteps: 1,
    }).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[unrelated]?.mark).toBe('unknown')
  })

  it('returns null when the white trial budget times out', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')

    const result = createWhitePearlStrongInferenceRule(() => [], {
      maxMs: -1,
    }).apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not overwrite decided lines when forcing the opposite white axis', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    puzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(2, 3)] = { fill: 'yellow' }
    const east = lineKey([2, 2], [2, 3])
    markLine(puzzle, east, 'blank')

    const result = createWhitePearlStrongInferenceRule(() => []).apply(puzzle)

    expect(result).toBeNull()
    expect(puzzle.lines[east]?.mark).toBe('blank')
  })

  it('tries white pearls with denser nearby pearl context first', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 1, 1, 'white')
    puzzle.tiles[tileKey(1, 1)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(1, 2)] = { fill: 'yellow' }
    addPearl(puzzle, 4, 4, 'white')
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 3, 4, 'white')
    puzzle.tiles[tileKey(4, 4)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(4, 5)] = { fill: 'yellow' }
    const prioritizedEast = lineKey([4, 4], [4, 5])
    const prioritizedWest = lineKey([4, 3], [4, 4])
    const prioritizedNorth = lineKey([3, 4], [4, 4])
    const prioritizedSouth = lineKey([4, 4], [5, 4])

    const result = createWhitePearlStrongInferenceRule(() => []).apply(puzzle)

    expect(result?.affectedCells).toEqual([cellKey(4, 4)])
    expectLineDiffs(result?.diffs, {
      [prioritizedEast]: 'line',
      [prioritizedWest]: 'line',
      [prioritizedNorth]: 'blank',
      [prioritizedSouth]: 'blank',
    })
  })
})
