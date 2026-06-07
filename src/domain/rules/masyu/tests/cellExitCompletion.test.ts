import { describe, expect, it } from 'vitest'
import { lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { createCellExitCompletionRule } from '../rules/completion'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu pearl cell exit completion', () => {
  it('forces the opposite white pearl exit when only the straight continuation remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })

  it('forces the only available straight pair on a white pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'line', [south]: 'line' })
  })

  it('blanks remaining white pearl exits after a straight pair is complete', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    const west = lineKey([2, 1], [2, 2])
    const east = lineKey([2, 2], [2, 3])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'blank', [east]: 'blank' })
  })

  it('does not force a white pearl when only a turning pair remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')

    expect(createCellExitCompletionRule().apply(puzzle)).toBeNull()
  })

  it('forces a black pearl turn continuation without extending exits', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })

  it('forces the only available turning pair on a black pearl without extending it', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const west = lineKey([2, 1], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [west]: 'line',
      [south]: 'line',
    })
  })

  it('blanks remaining exits after a completed black pearl turn', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [south]: 'blank',
    })
  })

  it('does not force a black pearl when only a straight pair remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')

    expect(createCellExitCompletionRule().apply(puzzle)).toBeNull()
  })

  it('does not inspect black pearl extensions', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'blank')
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })
})

describe('Masyu regular cell exit completion', () => {
  it('connects the only remaining candidate when a regular cell has one line', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const west = lineKey([1, 1], [1, 0])
    const east = lineKey([1, 1], [1, 2])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([1, 1], [0, 1]), 'blank')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'blank')

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line' })
  })

  it('blanks every remaining candidate when a cell already has degree 2', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const north = lineKey([1, 1], [0, 1])
    const south = lineKey([1, 1], [2, 1])
    markLine(puzzle, lineKey([1, 1], [1, 0]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank', [south]: 'blank' })
  })

  it('blanks a single remaining candidate on a regular dead-end cell', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const onlyLine = lineKey([0, 0], [0, 1])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [onlyLine]: 'blank' })
  })

  it('uses white pearl completion when traversing all cells', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const north = lineKey([1, 2], [2, 2])
    const east = lineKey([2, 2], [2, 3])
    const south = lineKey([2, 2], [3, 2])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [north]: 'blank',
      [east]: 'line',
      [south]: 'blank',
    })
  })

  it('uses black pearl completion when traversing all cells', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])

    const result = createCellExitCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank' })
  })
})
