import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { runNextRule } from '../../engine'
import { masyuPlugin } from '../../../plugins/masyuPlugin'
import {
  createBlackDiagonalWhitePinchRule,
  createBlackFacingConsecutiveWhitesRule,
  createConsecutiveWhitePearlsStraightRule,
  createDoubleBlackSqueezeRule,
  createWhiteCorridorRule,
} from '../rules/patterns'
import { deterministicMasyuRules } from '../rules'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

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

  it('White Corridor forces the two inner white pearls through the L-shaped corridor', () => {
    const puzzle = createMasyuPuzzle(8, 8)
    addPearl(puzzle, 4, 5, 'white')
    addPearl(puzzle, 5, 4, 'white')
    markLine(puzzle, lineKey([3, 3], [3, 4]), 'line')
    markLine(puzzle, lineKey([3, 4], [3, 5]), 'line')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'line')
    markLine(puzzle, lineKey([4, 3], [5, 3]), 'line')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')

    const result = createWhiteCorridorRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([4, 4], [4, 5])]: 'line',
      [lineKey([4, 5], [4, 6])]: 'line',
      [lineKey([4, 4], [5, 4])]: 'line',
      [lineKey([5, 4], [6, 4])]: 'line',
    })
    expect(result?.affectedCells).toEqual([
      cellKey(3, 3),
      cellKey(4, 5),
      cellKey(5, 4),
    ])
  })

  it('White Corridor works after rotation', () => {
    const puzzle = createMasyuPuzzle(8, 8)
    addPearl(puzzle, 5, 2, 'white')
    addPearl(puzzle, 4, 1, 'white')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'line')
    markLine(puzzle, lineKey([4, 3], [5, 3]), 'line')
    markLine(puzzle, lineKey([3, 3], [3, 2]), 'line')
    markLine(puzzle, lineKey([3, 2], [3, 1]), 'line')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')

    const result = createWhiteCorridorRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([4, 2], [5, 2])]: 'line',
      [lineKey([5, 2], [6, 2])]: 'line',
      [lineKey([4, 1], [4, 2])]: 'line',
      [lineKey([4, 0], [4, 1])]: 'line',
    })
  })

  it('White Corridor does not fire before there are multiple known line components', () => {
    const puzzle = createMasyuPuzzle(8, 8)
    addPearl(puzzle, 4, 5, 'white')
    addPearl(puzzle, 5, 4, 'white')
    markLine(puzzle, lineKey([3, 3], [3, 4]), 'line')
    markLine(puzzle, lineKey([3, 4], [3, 5]), 'line')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'line')
    markLine(puzzle, lineKey([4, 3], [5, 3]), 'line')

    expect(createWhiteCorridorRule().apply(puzzle)).toBeNull()
  })

  it('White Corridor does not overwrite a blank forced line', () => {
    const puzzle = createMasyuPuzzle(8, 8)
    addPearl(puzzle, 4, 5, 'white')
    addPearl(puzzle, 5, 4, 'white')
    markLine(puzzle, lineKey([3, 3], [3, 4]), 'line')
    markLine(puzzle, lineKey([3, 4], [3, 5]), 'line')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'line')
    markLine(puzzle, lineKey([4, 3], [5, 3]), 'line')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([4, 4], [4, 5]), 'blank')

    expect(createWhiteCorridorRule().apply(puzzle)).toBeNull()
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

  it('Double Black Squeeze treats the bottom edge as a crossed-out perpendicular exit', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 9, 5, 'black')
    addPearl(puzzle, 9, 7, 'black')
    const north = lineKey([8, 6], [9, 6])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank' })
    expect(result?.affectedCells).toEqual([cellKey(9, 6)])
  })

  it('Double Black Squeeze treats the top edge as a crossed-out perpendicular exit', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 0, 2, 'black')
    addPearl(puzzle, 0, 4, 'black')
    const south = lineKey([0, 3], [1, 3])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'blank' })
    expect(result?.affectedCells).toEqual([cellKey(0, 3)])
  })

  it('Double Black Squeeze treats side edges as crossed-out perpendicular exits', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 2, 0, 'black')
    addPearl(puzzle, 4, 0, 'black')
    addPearl(puzzle, 5, 9, 'black')
    addPearl(puzzle, 7, 9, 'black')
    const rightFromLeftEdge = lineKey([3, 0], [3, 1])
    const leftFromRightEdge = lineKey([6, 8], [6, 9])

    const result = createDoubleBlackSqueezeRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [rightFromLeftEdge]: 'blank',
      [leftFromRightEdge]: 'blank',
    })
    expect(result?.affectedCells).toEqual([cellKey(3, 0), cellKey(6, 9)])
  })

  it('Double Black Squeeze does not overwrite a border perpendicular exit that is already a line', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 9, 5, 'black')
    addPearl(puzzle, 9, 7, 'black')
    markLine(puzzle, lineKey([8, 6], [9, 6]), 'line')

    expect(createDoubleBlackSqueezeRule().apply(puzzle)).toBeNull()
  })

  it('Double Black Squeeze handles the supplied bottom-edge puzzle without strong inference', () => {
    let puzzle = masyuPlugin.parse(
      'https://puzz.link/p?mashu/10/10/0000000000000000000000000300000260',
    )
    const rules = deterministicMasyuRules
    const expectedLines = [
      lineKey([7, 5], [8, 5]),
      lineKey([8, 5], [9, 5]),
      lineKey([7, 7], [8, 7]),
      lineKey([8, 7], [9, 7]),
    ]
    const squeezed = lineKey([8, 6], [9, 6])
    let sawDoubleBlackSqueeze = false

    for (let stepNumber = 1; stepNumber <= 8; stepNumber += 1) {
      const result = runNextRule(puzzle, rules, stepNumber)
      if (!result.step) {
        break
      }
      sawDoubleBlackSqueeze ||= result.step.ruleName === 'Double Black Squeeze'
      puzzle = result.nextPuzzle
    }

    expect(sawDoubleBlackSqueeze).toBe(true)
    expect(puzzle.lines[squeezed]?.mark).toBe('blank')
    for (const key of expectedLines) {
      expect(puzzle.lines[key]?.mark).toBe('line')
    }
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
