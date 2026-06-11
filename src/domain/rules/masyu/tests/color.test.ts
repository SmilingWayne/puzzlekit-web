import { describe, expect, it } from 'vitest'
import { cellKey, lineKey, tileKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import {
  createMasyuColorLinePropagationRule,
  createMasyuColorPearlPropagationRule,
  createMasyuTileColorPropagationRule,
} from '../rules/color'
import { markLine, addPearl, expectLineDiffs } from './testUtils'

describe('Masyu color rules', () => {
  it('Masyu Tile Color Propagation seeds boundary tiles yellow', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const result = createMasyuTileColorPropagationRule().apply(puzzle)
    const fills = new Map(
      (result?.diffs ?? []).flatMap((diff) =>
        diff.kind === 'tile' ? [[diff.tileKey, diff.toFill] as const] : [],
      ),
    )

    expect(fills.size).toBe(8)
    for (let row = 0; row <= 2; row += 1) {
      for (let col = 0; col <= 2; col += 1) {
        const key = tileKey(row, col)
        if (row === 1 && col === 1) {
          expect(fills.has(key)).toBe(false)
        } else {
          expect(fills.get(key)).toBe('yellow')
        }
      }
    }
  })

  it('Masyu Tile Color Propagation carries color through blank lines', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'blank')

    const result = createMasyuTileColorPropagationRule().apply(puzzle)

    expect(result?.diffs).toContainEqual({
      kind: 'tile',
      tileKey: tileKey(1, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('Masyu Tile Color Propagation flips color across line segments', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')

    const result = createMasyuTileColorPropagationRule().apply(puzzle)

    expect(result?.diffs).toContainEqual({
      kind: 'tile',
      tileKey: tileKey(1, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('Masyu Tile Color Propagation uses existing tile color anchors', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'blank')

    const result = createMasyuTileColorPropagationRule().apply(puzzle)

    expect(result?.diffs).toContainEqual({
      kind: 'tile',
      tileKey: tileKey(1, 2),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('Masyu Color-Pearl Propagation colors the opposite diagonal from a white pearl NW tile', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }

    const result = createMasyuColorPearlPropagationRule().apply(puzzle)

    expect(result?.diffs).toEqual([
      {
        kind: 'tile',
        tileKey: tileKey(2, 2),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
    expect(result?.affectedCells).toEqual([cellKey(1, 1)])
    expect(result?.affectedTiles).toEqual([tileKey(1, 1), tileKey(2, 2)])
    expect(result?.message).toContain('White pearl')
  })

  it('Masyu Color-Pearl Propagation colors the opposite diagonal from a white pearl NE tile', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')
    puzzle.tiles[tileKey(1, 2)] = { fill: 'yellow' }

    const result = createMasyuColorPearlPropagationRule().apply(puzzle)

    expect(result?.diffs).toEqual([
      { kind: 'tile', tileKey: tileKey(2, 1), fromFill: null, toFill: 'green' },
    ])
  })

  it('Masyu Color-Pearl Propagation ignores black pearls', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'black')
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }

    expect(createMasyuColorPearlPropagationRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Color-Pearl Propagation does not overwrite an already colored opposite diagonal', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 1, 1, 'white')
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = { fill: 'green' }

    expect(createMasyuColorPearlPropagationRule().apply(puzzle)).toBeNull()
  })

  it('Masyu Color-Line Propagation forces a line between different adjacent tile colors', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const targetLine = lineKey([1, 1], [1, 2])
    puzzle.tiles[tileKey(1, 2)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }

    const result = createMasyuColorLinePropagationRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [targetLine]: 'line' })
    expect(result?.affectedLines).toEqual([targetLine])
    expect(result?.affectedTiles).toEqual([tileKey(1, 2), tileKey(2, 2)])
    expect(result?.message).toContain('different colors')
  })

  it('Masyu Color-Line Propagation crosses a line between same adjacent tile colors', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const targetLine = lineKey([1, 1], [2, 1])
    puzzle.tiles[tileKey(2, 1)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }

    const result = createMasyuColorLinePropagationRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [targetLine]: 'blank' })
    expect(result?.message).toContain('same color')
  })

  it('Masyu Color-Line Propagation uses boundary tile colors beside edge-adjacent lines', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const targetLine = lineKey([0, 0], [0, 1])
    puzzle.tiles[tileKey(0, 1)] = { fill: 'yellow' }
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }

    const result = createMasyuColorLinePropagationRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [targetLine]: 'line' })
  })

  it('Masyu Color-Line Propagation does not overwrite an already decided line', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const targetLine = lineKey([1, 1], [1, 2])
    puzzle.tiles[tileKey(1, 2)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }
    markLine(puzzle, targetLine, 'blank')

    expect(createMasyuColorLinePropagationRule().apply(puzzle)).toBeNull()
  })
})
