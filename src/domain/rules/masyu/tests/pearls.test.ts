import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { createBlackPearlRule, createWhitePearlRule } from '../rules/pearls'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu pearl rules', () => {
  it('White Pearl Rule blanks a blocked axis and forces the other straight axis', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'white')
    const south = lineKey([0, 1], [1, 1])
    const east = lineKey([0, 1], [0, 2])
    const west = lineKey([0, 1], [0, 0])

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [south]: 'blank',
      [east]: 'line',
      [west]: 'line',
    })
    expect(result?.affectedCells).toEqual([cellKey(0, 1)])
  })

  it('White Pearl Rule uses an existing blank to force the crossing axis', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')
    const east = lineKey([1, 1], [1, 2])
    const west = lineKey([1, 1], [1, 0])
    const north = lineKey([1, 1], [0, 1])
    const south = lineKey([1, 1], [2, 1])
    markLine(puzzle, east, 'blank')

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [west]: 'blank',
      [north]: 'line',
      [south]: 'line',
    })
  })

  it('White Pearl Rule does nothing when both straight axes are still available', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('White Pearl Rule rejects a vertical pass-through when both immediate turn cells are blocked', () => {
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

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [north]: 'blank',
      [south]: 'blank',
      [east]: 'line',
      [west]: 'line',
    })
  })

  it('White Pearl Rule rejects a horizontal pass-through when both immediate turn cells are blocked', () => {
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

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [west]: 'blank',
      [north]: 'line',
      [south]: 'line',
    })
  })

  it('White Pearl Rule keeps an axis available when each side still has a turn candidate', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([4, 3], [4, 4]), 'blank')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('White Pearl Rule keeps an axis available when only one side can turn', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([2, 3], [2, 4]), 'blank')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('White Pearl Rule does not force the second white pearl vertical when the shared gap can still turn', () => {
    const puzzle = createMasyuPuzzle(9, 10)
    addPearl(puzzle, 4, 5, 'white')
    addPearl(puzzle, 4, 7, 'white')
    markLine(puzzle, lineKey([4, 4], [4, 5]), 'line')
    markLine(puzzle, lineKey([4, 5], [4, 6]), 'line')
    markLine(puzzle, lineKey([4, 6], [5, 6]), 'blank')
    const result = createWhitePearlRule().apply(puzzle)

    expect(result?.diffs).not.toContainEqual({
      kind: 'line',
      lineKey: lineKey([3, 7], [4, 7]),
      from: 'unknown',
      to: 'line',
    })
    expect(result?.diffs).not.toContainEqual({
      kind: 'line',
      lineKey: lineKey([4, 7], [5, 7]),
      from: 'unknown',
      to: 'line',
    })
  })

  it('White Pearl Rule rejects a horizontal pass-through when both side turns break adjacent pearls', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 5, 3, 'black')
    addPearl(puzzle, 4, 4, 'white')
    addPearl(puzzle, 4, 5, 'white')

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([4, 3], [4, 4])]: 'blank',
      [lineKey([4, 4], [4, 5])]: 'blank',
      [lineKey([3, 4], [4, 4])]: 'line',
      [lineKey([4, 4], [5, 4])]: 'line',
    })
    expect(result?.affectedCells).toEqual([cellKey(4, 4)])
  })

  it('White Pearl Rule treats an adjacent white pearl as a blocked turn side', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([4, 2], [4, 3]), 'blank')
    markLine(puzzle, lineKey([4, 3], [4, 4]), 'blank')

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 3], [3, 3])]: 'blank',
      [lineKey([3, 3], [4, 3])]: 'blank',
      [lineKey([3, 3], [3, 4])]: 'line',
      [lineKey([3, 2], [3, 3])]: 'line',
    })
  })

  it('White Pearl Rule keeps an axis available when a nearby black pearl still has candidates', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 2, 'white')
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'blank')

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 2], [3, 2])]: 'blank',
      [lineKey([3, 2], [3, 3])]: 'line',
      [lineKey([3, 1], [3, 2])]: 'line',
    })
  })

  it('White Pearl Rule keeps a turn side available when only one target is black', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'white')
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([4, 2], [4, 3]), 'blank')
    markLine(puzzle, lineKey([4, 3], [4, 4]), 'blank')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('White Pearl Rule continues a known line straight and blanks turn candidates', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'line',
      [north]: 'blank',
      [south]: 'blank',
    })
  })

  it('White Pearl Rule does not force a straight line into a degree-2 neighbor', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')

    const result = createWhitePearlRule().apply(puzzle)

    expect(result?.diffs).not.toContainEqual({
      kind: 'line',
      lineKey: lineKey([1, 1], [1, 2]),
      from: 'unknown',
      to: 'line',
    })
  })

  it('White Pearl Rule blanks turn candidates when a white pearl already has a straight pair', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [north]: 'blank', [south]: 'blank' })
  })

  it('White Pearl Rule only highlights pearls that create new line decisions', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    const unchangedPearl = cellKey(1, 1)
    const changedPearl = cellKey(1, 2)
    addPearl(puzzle, 1, 1, 'white')
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'blank')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'blank')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const changedLine = lineKey([1, 2], [1, 3])

    const result = createWhitePearlRule().apply(puzzle)

    expect(result?.affectedCells).toEqual([changedPearl])
    expect(result?.affectedCells).not.toContain(unchangedPearl)
    expect(result?.affectedLines).toEqual([changedLine])
    expectLineDiffs(result?.diffs, { [changedLine]: 'blank' })
  })

  it('White Pearl Rule blocks the short side from continuing when the other side already runs straight south', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    const northExtension = lineKey([0, 2], [1, 2])

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [northExtension]: 'blank' })
    expect(result?.message).toContain('must turn in an adjacent cell')
  })

  it('White Pearl Rule blocks the short side from continuing when the other side already runs straight east', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')
    markLine(puzzle, lineKey([2, 3], [2, 4]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')
    const westExtension = lineKey([2, 0], [2, 1])

    const result = createWhitePearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [westExtension]: 'blank' })
  })

  it('White Pearl Rule does not block either side when both sides only reach the pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('White Pearl Rule ignores adjacent-turn continuation when the short-side extension leaves the board', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'blank')
    markLine(puzzle, lineKey([1, 2], [1, 3]), 'blank')

    expect(createWhitePearlRule().apply(puzzle)).toBeNull()
  })

  it('Black Pearl Rule forces the opposite line and its straight extension at the border', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'black')
    const south = lineKey([0, 1], [1, 1])
    const extension = lineKey([1, 1], [2, 1])

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [south]: 'line', [extension]: 'line' })
    expect(result?.affectedCells).toEqual([cellKey(0, 1)])
  })

  it('Black Pearl Rule forces the opposite line and extension when one side is already blank', () => {
    const puzzle = createMasyuPuzzle(3, 4)
    addPearl(puzzle, 1, 1, 'black')
    const west = lineKey([1, 1], [1, 0])
    const east = lineKey([1, 1], [1, 2])
    const extension = lineKey([1, 2], [1, 3])
    markLine(puzzle, west, 'blank')

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line', [extension]: 'line' })
  })

  it('Black Pearl Rule does not overwrite already-decided opposite line or extension', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'black')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')

    expect(createBlackPearlRule().apply(puzzle)).toBeNull()
  })

  it('Black Pearl Rule only highlights pearls that create new line decisions', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    const unchangedPearl = cellKey(2, 2)
    const changedPearl = cellKey(0, 1)
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 0, 1, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([2, 0], [2, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    const changedLine = lineKey([1, 1], [2, 1])

    const result = createBlackPearlRule().apply(puzzle)

    expect(result?.affectedCells).toEqual([changedPearl])
    expect(result?.affectedCells).not.toContain(unchangedPearl)
    expect(result?.affectedLines).toEqual([changedLine])
    expectLineDiffs(result?.diffs, { [changedLine]: 'line' })
  })

  it('Black Pearl Rule rejects an exit whose second step would leave the board', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 4, 'black')
    const east = lineKey([3, 4], [3, 5])
    const west = lineKey([3, 3], [3, 4])
    const extension = lineKey([3, 2], [3, 3])

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [west]: 'line',
      [extension]: 'line',
    })
  })

  it('Black Pearl Rule rejects an exit whose second step is already blank', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'black')
    const east = lineKey([3, 3], [3, 4])
    const eastExtension = lineKey([3, 4], [3, 5])
    const west = lineKey([3, 2], [3, 3])
    const westExtension = lineKey([3, 1], [3, 2])
    markLine(puzzle, eastExtension, 'blank')

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [west]: 'line',
      [westExtension]: 'line',
    })
  })

  it('Black Pearl Rule turns away from a known line and extends that exit', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    const extension = lineKey([2, 0], [2, 1])
    const east = lineKey([2, 2], [2, 3])

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'blank', [extension]: 'line' })
  })

  it('Black Pearl Rule blanks remaining exits and extends both sides of a known turn', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const east = lineKey([2, 2], [2, 3])
    const south = lineKey([2, 2], [3, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const northExtension = lineKey([0, 2], [1, 2])

    const result = createBlackPearlRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'blank',
      [south]: 'blank',
      [westExtension]: 'line',
      [northExtension]: 'line',
    })
  })
})
