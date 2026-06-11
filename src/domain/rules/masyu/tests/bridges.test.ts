import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { createMasyuCandidateBridgeLineRule } from '../rules/bridges'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu bridge rules', () => {
  it('Masyu Candidate Bridge Line forces the only candidate bridge between two pearls', () => {
    const puzzle = createMasyuPuzzle(1, 4)
    addPearl(puzzle, 0, 0, 'white')
    addPearl(puzzle, 0, 3, 'white')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    const bridge = lineKey([0, 1], [0, 2])

    const result = createMasyuCandidateBridgeLineRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [bridge]: 'line' })
    expect(result?.affectedLines).toEqual([bridge])
    expect(result?.affectedCells).toEqual([cellKey(0, 1), cellKey(0, 2)])
    expect(result?.message).toContain('only remaining connection')
  })

  it('Masyu Candidate Bridge Line does not fire when two required groups have alternate routes', () => {
    const puzzle = createMasyuPuzzle(2, 3)
    addPearl(puzzle, 0, 0, 'white')
    addPearl(puzzle, 0, 2, 'white')

    expect(createMasyuCandidateBridgeLineRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Candidate Bridge Line ignores a bridge into an ordinary dead-end region', () => {
    const puzzle = createMasyuPuzzle(1, 3)
    addPearl(puzzle, 0, 0, 'white')
    addPearl(puzzle, 0, 1, 'white')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')

    expect(createMasyuCandidateBridgeLineRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Candidate Bridge Line treats existing line endpoints as required sources', () => {
    const puzzle = createMasyuPuzzle(1, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    addPearl(puzzle, 0, 3, 'black')
    const bridge = lineKey([0, 1], [0, 2])

    const result = createMasyuCandidateBridgeLineRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [bridge]: 'line' })
  })

  it('Masyu Candidate Bridge Line skips a forced bridge that would overflow endpoint degree', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    addPearl(puzzle, 1, 0, 'white')
    addPearl(puzzle, 1, 3, 'white')
    for (const key of Object.keys(puzzle.lines)) {
      markLine(puzzle, key, 'blank')
    }
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'unknown')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'unknown')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')

    expect(createMasyuCandidateBridgeLineRule().apply(puzzle)).toBeNull()
  })
})
