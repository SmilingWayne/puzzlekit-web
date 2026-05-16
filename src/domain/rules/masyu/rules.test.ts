import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import type { LineMark, PuzzleIR } from '../../ir/types'
import { runNextRule } from '../engine'
import { masyuPlugin } from '../../plugins/masyuPlugin'
import { createCellCompletionRule, createPearlCompletionRule } from './rules/completion'
import {
  createBlackDiagonalWhitePinchRule,
  createBlackFacingConsecutiveWhitesRule,
  createConsecutiveWhitePearlsStraightRule,
  createDoubleBlackSqueezeRule,
} from './rules/patterns'
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

  it('White Circle Rule blocks the short side from continuing when the other side already runs straight south', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const northExtension = lineKey([0, 2], [1, 2])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [northExtension]: 'blank' })
    expect(result?.message).toContain('must turn in an adjacent cell')
  })

  it('White Circle Rule blocks the short side from continuing when the other side already runs straight east', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')
    markLine(puzzle, lineKey([2, 3], [2, 4]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')
    const westExtension = lineKey([2, 0], [2, 1])

    const result = createWhiteCircleRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [westExtension]: 'blank' })
  })

  it('White Circle Rule does not block either side when both sides only reach the pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')

    expect(createWhiteCircleRule().apply(puzzle)).toBeNull()
  })

  it('White Circle Rule ignores adjacent-turn continuation when the short-side extension leaves the board', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'blank')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'blank')

    expect(createWhiteCircleRule().apply(puzzle)).toBeNull()
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
      'Black Facing Consecutive Whites',
      'Black Diagonal White Pinch',
      'Consecutive White Pearls Straight',
      'Double Black Squeeze',
      'Pearl Completion',
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

describe('Masyu pattern rules', () => {
  it('Black Facing Consecutive Whites forces away from horizontal consecutive white pearls', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 1, 'black')
    addPearl(puzzle, 2, 3, 'white')
    addPearl(puzzle, 2, 4, 'white')
    const west = lineKey([2, 0], [2, 1])

    const result = createBlackFacingConsecutiveWhitesRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'line' })
    expect(result?.affectedCells).toEqual([cellKey(2, 1)])
  })

  it('Black Facing Consecutive Whites forces away from vertical consecutive white pearls', () => {
    const puzzle = createMasyuPuzzle(6, 5)
    addPearl(puzzle, 3, 2, 'black')
    addPearl(puzzle, 1, 2, 'white')
    addPearl(puzzle, 0, 2, 'white')
    const south = lineKey([3, 2], [4, 2])

    const result = createBlackFacingConsecutiveWhitesRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })

  it('Black Facing Consecutive Whites does not fire with only one distant white pearl', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 1, 'black')
    addPearl(puzzle, 2, 3, 'white')

    expect(createBlackFacingConsecutiveWhitesRule().apply(puzzle)).toBeNull()
  })

  it('Black Facing Consecutive Whites allows the gap cell to contain a pearl', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 1, 'black')
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 3, 'white')
    addPearl(puzzle, 2, 4, 'white')
    const west = lineKey([2, 0], [2, 1])

    const result = createBlackFacingConsecutiveWhitesRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'line' })
  })

  it('Black Diagonal White Pinch forces away from white pearls north of a black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 1, 1, 'white')
    addPearl(puzzle, 1, 3, 'white')
    const south = lineKey([2, 2], [3, 2])

    const result = createBlackDiagonalWhitePinchRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })

  it('Black Diagonal White Pinch forces away from white pearls east of a black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 1, 3, 'white')
    addPearl(puzzle, 3, 3, 'white')
    const west = lineKey([2, 1], [2, 2])

    const result = createBlackDiagonalWhitePinchRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'line' })
  })

  it('Black Diagonal White Pinch forces away from white pearls south of a black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 3, 1, 'white')
    addPearl(puzzle, 3, 3, 'white')
    const north = lineKey([1, 2], [2, 2])

    const result = createBlackDiagonalWhitePinchRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'line' })
  })

  it('Black Diagonal White Pinch forces away from white pearls west of a black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 1, 1, 'white')
    addPearl(puzzle, 3, 1, 'white')
    const east = lineKey([2, 2], [2, 3])

    const result = createBlackDiagonalWhitePinchRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line' })
  })

  it('Black Diagonal White Pinch does not fire when one diagonal white pearl is missing', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 1, 3, 'white')

    expect(createBlackDiagonalWhitePinchRule().apply(puzzle)).toBeNull()
  })

  it('Black Diagonal White Pinch does not overwrite a blank forced line', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 1, 3, 'white')
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')

    expect(createBlackDiagonalWhitePinchRule().apply(puzzle)).toBeNull()
  })

  it('Consecutive White Pearls Straight forces vertical pass-through for three horizontal white pearls', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 1, 'white')
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')

    const result = createConsecutiveWhitePearlsStraightRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([1, 1], [2, 1])]: 'line',
      [lineKey([2, 1], [3, 1])]: 'line',
      [lineKey([1, 2], [2, 2])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'line',
      [lineKey([1, 3], [2, 3])]: 'line',
      [lineKey([2, 3], [3, 3])]: 'line',
    })
  })

  it('Consecutive White Pearls Straight forces horizontal pass-through for three vertical white pearls', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 1, 2, 'white')
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 3, 2, 'white')

    const result = createConsecutiveWhitePearlsStraightRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([1, 1], [1, 2])]: 'line',
      [lineKey([1, 2], [1, 3])]: 'line',
      [lineKey([2, 1], [2, 2])]: 'line',
      [lineKey([2, 2], [2, 3])]: 'line',
      [lineKey([3, 1], [3, 2])]: 'line',
      [lineKey([3, 2], [3, 3])]: 'line',
    })
  })

  it('Consecutive White Pearls Straight covers every pearl in a longer run', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 1, 'white')
    addPearl(puzzle, 3, 2, 'white')
    addPearl(puzzle, 3, 3, 'white')
    addPearl(puzzle, 3, 4, 'white')

    const result = createConsecutiveWhitePearlsStraightRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 1], [3, 1])]: 'line',
      [lineKey([3, 1], [4, 1])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'line',
      [lineKey([3, 2], [4, 2])]: 'line',
      [lineKey([2, 3], [3, 3])]: 'line',
      [lineKey([3, 3], [4, 3])]: 'line',
      [lineKey([2, 4], [3, 4])]: 'line',
      [lineKey([3, 4], [4, 4])]: 'line',
    })
  })

  it('Consecutive White Pearls Straight does not fire for only two consecutive white pearls', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 1, 'white')
    addPearl(puzzle, 2, 2, 'white')

    expect(createConsecutiveWhitePearlsStraightRule().apply(puzzle)).toBeNull()
  })

  it('Consecutive White Pearls Straight does not overwrite a blank target line', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 1, 'white')
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'blank')

    const result = createConsecutiveWhitePearlsStraightRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 1], [3, 1])]: 'line',
      [lineKey([1, 2], [2, 2])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'line',
      [lineKey([1, 3], [2, 3])]: 'line',
      [lineKey([2, 3], [3, 3])]: 'line',
    })
  })

  it('Double Black Squeeze blanks the opposite vertical exit between horizontal black pearls', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 4, 'black')
    markLine(puzzle, lineKey([1, 3], [2, 3]), 'blank')
    const south = lineKey([2, 3], [3, 3])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'blank' })
    expect(result?.affectedCells).toEqual([cellKey(2, 3)])
  })

  it('Double Black Squeeze works in the reverse vertical direction between horizontal black pearls', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 4, 'black')
    markLine(puzzle, lineKey([2, 3], [3, 3]), 'blank')
    const north = lineKey([1, 3], [2, 3])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank' })
  })

  it('Double Black Squeeze blanks the opposite horizontal exit between vertical black pearls', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 2, 3, 'black')
    addPearl(puzzle, 4, 3, 'black')
    markLine(puzzle, lineKey([3, 2], [3, 3]), 'blank')
    const east = lineKey([3, 3], [3, 4])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank' })
  })

  it('Double Black Squeeze does not fire unless both opposite cells are black pearls', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 4, 'white')
    markLine(puzzle, lineKey([1, 3], [2, 3]), 'blank')

    expect(createDoubleBlackSqueezeRule().apply(puzzle)).toBeNull()
  })

  it('Double Black Squeeze ignores adjacent black pearls that do not enclose a middle cell', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 3, 'black')
    markLine(puzzle, lineKey([1, 3], [2, 3]), 'blank')

    expect(createDoubleBlackSqueezeRule().apply(puzzle)).toBeNull()
  })

  it('Double Black Squeeze does not overwrite an opposite exit that is already a line', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 4, 'black')
    markLine(puzzle, lineKey([1, 3], [2, 3]), 'blank')
    markLine(puzzle, lineKey([2, 3], [3, 3]), 'line')

    expect(createDoubleBlackSqueezeRule().apply(puzzle)).toBeNull()
  })
})

describe('Masyu Pearl Completion', () => {
  it('forces the opposite white pearl exit when only the straight continuation remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const south = lineKey([2, 2], [3, 2])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line' })
  })

  it('forces the only available straight pair on a white pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'line', [south]: 'line' })
  })

  it('blanks remaining white pearl exits after a straight pair is complete', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    const west = lineKey([2, 1], [2, 2])
    const east = lineKey([2, 2], [2, 3])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [west]: 'blank', [east]: 'blank' })
  })

  it('does not force a white pearl when only a turning pair remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')

    expect(createPearlCompletionRule().apply(puzzle)).toBeNull()
  })

  it('forces a black pearl turn continuation and extends both exits', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const southExtension = lineKey([3, 2], [4, 2])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [south]: 'line',
      [westExtension]: 'line',
      [southExtension]: 'line',
    })
  })

  it('forces the only available turning pair on a black pearl and extends it', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const west = lineKey([2, 1], [2, 2])
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const southExtension = lineKey([3, 2], [4, 2])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [west]: 'line',
      [south]: 'line',
      [westExtension]: 'line',
      [southExtension]: 'line',
    })
  })

  it('blanks remaining exits and extends a completed black pearl turn', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const northExtension = lineKey([0, 2], [1, 2])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [south]: 'blank',
      [westExtension]: 'line',
      [northExtension]: 'line',
    })
  })

  it('does not force a black pearl when only a straight pair remains', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')

    expect(createPearlCompletionRule().apply(puzzle)).toBeNull()
  })

  it('does not overwrite a blank black pearl extension', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'blank')
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])

    const result = createPearlCompletionRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line', [westExtension]: 'line' })
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
