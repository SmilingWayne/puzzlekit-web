import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import type { LineMark, PuzzleIR } from '../../ir/types'
import { runNextRule } from '../engine'
import { masyuPlugin } from '../../plugins/masyuPlugin'
import { createCellCompletionRule } from './rules/completion'
import { createBlackCircleRule, createWhiteCircleRule } from './rules/pearls'

const markLine = (puzzle: PuzzleIR, key: string, mark: LineMark): void => {
  puzzle.lines[key] = { ...puzzle.lines[key], mark }
}

const addPearl = (puzzle: PuzzleIR, row: number, col: number, color: 'white' | 'black'): void => {
  puzzle.cells[cellKey(row, col)] = { clue: { kind: 'pearl', color } }
}

const expectLineDiffs = (
  diffs: NonNullable<ReturnType<ReturnType<typeof createWhiteCircleRule>['apply']>>['diffs'] | undefined,
  expected: Record<string, LineMark>,
): void => {
  expect(
    Object.fromEntries(
      (diffs ?? []).map((diff) => [diff.kind === 'line' ? diff.lineKey : '', diff.kind === 'line' ? diff.to : '']),
    ),
  ).toEqual(expected)
}

describe('Masyu pearl rules', () => {
  it('White Circle Rule blanks a blocked axis and forces the other straight axis', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'white')
    const south = lineKey([0, 1], [1, 1])
    const east = lineKey([0, 1], [0, 2])
    const west = lineKey([0, 1], [0, 0])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'blank', [east]: 'line', [west]: 'line' })
    expect(result?.affectedCells).toEqual([cellKey(0, 1)])
  })

  it('White Circle Rule uses an existing blank to force the crossing axis', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')
    const east = lineKey([1, 1], [1, 2])
    const west = lineKey([1, 1], [1, 0])
    const north = lineKey([1, 1], [0, 1])
    const south = lineKey([1, 1], [2, 1])
    markLine(puzzle, east, 'blank')

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'blank', [north]: 'line', [south]: 'line' })
  })

  it('White Circle Rule does nothing when both straight axes are still available', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')

    expect(createWhiteCircleRule().apply(puzzle)).toBeNull()
  })

  it('White Circle Rule rejects a vertical pass-through when both immediate turn cells are blocked', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([2, 3], [2, 4]), 'blank')
    markLine(puzzle, lineKey([4, 2], [4, 3]), 'blank')
    markLine(puzzle, lineKey([4, 3], [4, 4]), 'blank')
    const north = lineKey([2, 3], [3, 3])
    const south = lineKey([3, 3], [4, 3])
    const east = lineKey([3, 3], [3, 4])
    const west = lineKey([3, 2], [3, 3])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank', [south]: 'blank', [east]: 'line', [west]: 'line' })
  })

  it('White Circle Rule rejects a horizontal pass-through when both immediate turn cells are blocked', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'blank')
    markLine(puzzle, lineKey([2, 4], [3, 4]), 'blank')
    markLine(puzzle, lineKey([3, 4], [4, 4]), 'blank')
    const east = lineKey([3, 3], [3, 4])
    const west = lineKey([3, 2], [3, 3])
    const north = lineKey([2, 3], [3, 3])
    const south = lineKey([3, 3], [4, 3])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank', [west]: 'blank', [north]: 'line', [south]: 'line' })
  })

  it('White Circle Rule keeps an axis available when each side still has a turn candidate', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([4, 3], [4, 4]), 'blank')

    expect(createWhiteCircleRule().apply(puzzle)).toBeNull()
  })

  it('White Circle Rule continues a known line straight and blanks turn candidates', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line', [north]: 'blank', [south]: 'blank' })
  })

  it('White Circle Rule blanks turn candidates when a white pearl already has a straight pair', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank', [south]: 'blank' })
  })

  it('Black Circle Rule forces the opposite line and its straight extension at the border', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'black')
    const south = lineKey([0, 1], [1, 1])
    const extension = lineKey([1, 1], [2, 1])

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line', [extension]: 'line' })
    expect(result?.affectedCells).toEqual([cellKey(0, 1)])
  })

  it('Black Circle Rule forces the opposite line and extension when one side is already blank', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    addPearl(puzzle, 1, 1, 'black')
    const west = lineKey([1, 1], [1, 0])
    const east = lineKey([1, 1], [1, 2])
    const extension = lineKey([1, 2], [1, 3])
    markLine(puzzle, west, 'blank')

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line', [extension]: 'line' })
  })

  it('Black Circle Rule does not overwrite already-decided opposite line or extension', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'black')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')

    expect(createBlackCircleRule().apply(puzzle)).toBeNull()
  })

  it('Black Circle Rule rejects an exit whose second step would leave the board', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 4, 'black')
    const east = lineKey([3, 4], [3, 5])
    const west = lineKey([3, 3], [3, 4])
    const extension = lineKey([3, 2], [3, 3])

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank', [west]: 'line', [extension]: 'line' })
  })

  it('Black Circle Rule rejects an exit whose second step is already blank', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'black')
    const east = lineKey([3, 3], [3, 4])
    const eastExtension = lineKey([3, 4], [3, 5])
    const west = lineKey([3, 2], [3, 3])
    const westExtension = lineKey([3, 1], [3, 2])
    markLine(puzzle, eastExtension, 'blank')

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank', [west]: 'line', [westExtension]: 'line' })
  })

  it('Black Circle Rule turns away from a known line and extends that exit', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const extension = lineKey([2, 0], [2, 1])
    const east = lineKey([2, 2], [2, 3])

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank', [extension]: 'line' })
  })

  it('Black Circle Rule blanks remaining exits and extends both sides of a known turn', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const northExtension = lineKey([0, 2], [1, 2])

    const result = createBlackCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [south]: 'blank',
      [westExtension]: 'line',
      [northExtension]: 'line',
    })
  })

  it('registers Masyu rules in pearl-then-completion order', () => {
    expect(masyuPlugin.getRules().map((rule) => rule.name)).toEqual([
      'White Circle Rule',
      'Black Circle Rule',
      'Cell Completion',
    ])
  })

  it('applies a line diff on the sample Masyu puzzle', () => {
    const puzzle = masyuPlugin.parse('https://puzz.link/p?mashu/5/5/001390360')
    const { step } = runNextRule(puzzle, masyuPlugin.getRules(), 1)

    expect(step?.ruleName).toBe('White Circle Rule')
    expect(step?.diffs.some((diff) => diff.kind === 'line')).toBe(true)
  })
})

describe('Masyu Cell Completion', () => {
  it('connects the only remaining candidate when a regular cell has one line', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const west = lineKey([1, 1], [1, 0])
    const east = lineKey([1, 1], [1, 2])
    markLine(puzzle, west, 'line')
    markLine(puzzle, lineKey([1, 1], [0, 1]), 'blank')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'blank')

    const result = createCellCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line' })
  })

  it('blanks every remaining candidate when a cell already has degree 2', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const north = lineKey([1, 1], [0, 1])
    const south = lineKey([1, 1], [2, 1])
    markLine(puzzle, lineKey([1, 1], [1, 0]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'line')

    const result = createCellCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank', [south]: 'blank' })
  })

  it('blanks a single remaining candidate on a regular dead-end cell', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    const onlyLine = lineKey([0, 0], [0, 1])

    const result = createCellCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [onlyLine]: 'blank' })
  })

  it('does not apply pearl-specific completion to a white pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')

    const result = createCellCompletionRule().apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not apply pearl-specific completion to a black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')

    const result = createCellCompletionRule().apply(puzzle)

    expect(result).toBeNull()
  })
})
