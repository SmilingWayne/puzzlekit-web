import { describe, expect, it } from 'vitest'
import { getCellLineKeys } from './keys'
import { createMasyuPuzzle } from './masyu'

describe('createMasyuPuzzle', () => {
  it('creates center-to-center line decisions and vertex-centered tiles', () => {
    const puzzle = createMasyuPuzzle(5, 5)

    expect(Object.keys(puzzle.lines)).toHaveLength(5 * 4 + 5 * 4)
    expect(Object.keys(puzzle.tiles)).toHaveLength(6 * 6)
    expect(Object.keys(puzzle.edges)).toHaveLength(0)
    expect(Object.keys(puzzle.sectors)).toHaveLength(0)
  })

  it('returns only in-board line keys around a cell', () => {
    expect(getCellLineKeys(0, 0, 5, 5)).toHaveLength(2)
    expect(getCellLineKeys(0, 1, 5, 5)).toHaveLength(3)
    expect(getCellLineKeys(2, 2, 5, 5)).toHaveLength(4)
  })
})
