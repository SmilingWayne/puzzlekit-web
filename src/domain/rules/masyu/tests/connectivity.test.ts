import { describe, expect, it } from 'vitest'
import { lineKey, tileKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { createMasyuTileConnectivityCutColoringRule } from '../rules/connectivity'
import { markLine, fillAllTiles } from './testUtils'

describe('Masyu connectivity rules', () => {
  it('Masyu Tile Connectivity Cut Coloring colors an articulation tile green between green sources', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    fillAllTiles(puzzle, 'yellow')
    puzzle.tiles[tileKey(2, 1)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = {}
    puzzle.tiles[tileKey(2, 3)] = { fill: 'green' }

    const result = createMasyuTileConnectivityCutColoringRule().apply(puzzle)

    expect(result?.diffs).toEqual([
      { kind: 'tile', tileKey: tileKey(2, 2), fromFill: null, toFill: 'green' },
    ])
    expect(result?.affectedTiles).toEqual([tileKey(2, 2)])
    expect(result?.message).toContain('inside cuts 1')
  })

  it('Masyu Tile Connectivity Cut Coloring colors every unknown tile in a blank-compressed bottleneck', () => {
    const puzzle = createMasyuPuzzle(4, 5)
    fillAllTiles(puzzle, 'yellow')
    puzzle.tiles[tileKey(2, 1)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = {}
    puzzle.tiles[tileKey(2, 3)] = {}
    puzzle.tiles[tileKey(2, 4)] = { fill: 'green' }
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')

    const result = createMasyuTileConnectivityCutColoringRule().apply(puzzle)

    expect(result?.diffs).toEqual([
      { kind: 'tile', tileKey: tileKey(2, 2), fromFill: null, toFill: 'green' },
      { kind: 'tile', tileKey: tileKey(2, 3), fromFill: null, toFill: 'green' },
    ])
  })

  it('Masyu Tile Connectivity Cut Coloring colors a line-enclosed tile green', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')

    const result = createMasyuTileConnectivityCutColoringRule().apply(puzzle)

    expect(result?.diffs).toEqual([
      { kind: 'tile', tileKey: tileKey(1, 1), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('unreachable-from-outside 1')
  })

  it('Masyu Tile Connectivity Cut Coloring keeps unknown line separators passable', () => {
    const puzzle = createMasyuPuzzle(2, 2)

    expect(
      createMasyuTileConnectivityCutColoringRule().apply(puzzle),
    ).toBeNull()
  })

  it('Masyu Tile Connectivity Cut Coloring does not fire with only one green source component', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    fillAllTiles(puzzle, 'yellow')
    puzzle.tiles[tileKey(2, 1)] = { fill: 'green' }
    puzzle.tiles[tileKey(2, 2)] = {}

    expect(
      createMasyuTileConnectivityCutColoringRule().apply(puzzle),
    ).toBeNull()
  })
})
