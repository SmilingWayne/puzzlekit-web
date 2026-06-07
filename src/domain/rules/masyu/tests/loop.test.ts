import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import {
  createMasyuEmptyCellPrematureLoopRule,
  createPreventPrematureLoopRule,
} from '../rules/loop'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu loop rules', () => {
  it('Prevent Premature Loop blanks a line that would close a smaller loop while other lines remain outside', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')
    const closingLine = lineKey([0, 0], [1, 0])

    const result = createPreventPrematureLoopRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [closingLine]: 'blank' })
    expect(result?.affectedLines).toEqual([closingLine])
    expect(result?.message).toContain('smaller loop')
  })

  it('Prevent Premature Loop does not blank a candidate whose endpoints are in different components', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')

    expect(createPreventPrematureLoopRule().apply(puzzle)).toBeNull()
  })

  it('Prevent Premature Loop allows a closing line when no other confirmed lines remain outside', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')

    expect(createPreventPrematureLoopRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Empty Cell Premature Loop blanks both exits when using both would close a smaller loop', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    const target = cellKey(0, 0)
    const east = lineKey([0, 0], [0, 1])
    const south = lineKey([0, 0], [1, 0])
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')

    const result = createMasyuEmptyCellPrematureLoopRule().apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, { [east]: 'blank', [south]: 'blank' })
    expect(result?.affectedLines).toEqual([east, south])
    expect(result?.message).toContain('both remaining exits')
    expect(result?.message).toContain('smaller loop')
  })

  it('Masyu Empty Cell Premature Loop skips cells that already have a line', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')

    expect(createMasyuEmptyCellPrematureLoopRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Empty Cell Premature Loop skips pearl cells', () => {
    for (const color of ['black', 'white'] as const) {
      const puzzle = createMasyuPuzzle(4, 4)
      addPearl(puzzle, 0, 0, color)
      markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
      markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
      markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')

      expect(createMasyuEmptyCellPrematureLoopRule().apply(puzzle)).toBeNull()
    }
  })

  it('Masyu Empty Cell Premature Loop allows both exits when no other confirmed lines remain outside', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')

    expect(createMasyuEmptyCellPrematureLoopRule().apply(puzzle)).toBeNull()
  })
})
