import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey } from '../../ir/keys'
import { createSlitherPuzzle } from '../../ir/slither'
import type { PuzzleIR } from '../../ir/types'
import { slitherRules } from './rules'

const setClue = (puzzle: PuzzleIR, row: number, col: number, value: number): void => {
  puzzle.cells[cellKey(row, col)] = {
    clue: { kind: 'number', value },
  }
}

describe('slither contiguous 3-run boundaries rule', () => {
  const threeRunRule = slitherRules.find((rule) => rule.id === 'contiguous-three-run-boundaries')
  if (!threeRunRule) {
    throw new Error('Expected contiguous-three-run-boundaries rule')
  }

  it('forces all vertical run boundaries for a horizontal 3-run', () => {
    const puzzle = createSlitherPuzzle(4, 5)
    setClue(puzzle, 1, 1, 3)
    setClue(puzzle, 1, 2, 3)
    setClue(puzzle, 1, 3, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toBe(
      'Contiguous 3-run in row 1 forces all vertical run boundaries to be lines.',
    )
    expect(result?.affectedCells).toEqual(['1,1', '1,2', '1,3'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([
      edgeKey([1, 1], [2, 1]),
      edgeKey([1, 2], [2, 2]),
      edgeKey([1, 3], [2, 3]),
      edgeKey([1, 4], [2, 4]),
    ])
    expect(result?.diffs.every((d) => d.from === 'unknown' && d.to === 'line')).toBe(true)
  })

  it('forces all horizontal run boundaries for a vertical 3-run', () => {
    const puzzle = createSlitherPuzzle(5, 4)
    setClue(puzzle, 1, 2, 3)
    setClue(puzzle, 2, 2, 3)
    setClue(puzzle, 3, 2, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toBe(
      'Contiguous 3-run in column 2 forces all horizontal run boundaries to be lines.',
    )
    expect(result?.affectedCells).toEqual(['1,2', '2,2', '3,2'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([
      edgeKey([1, 2], [1, 3]),
      edgeKey([2, 2], [2, 3]),
      edgeKey([3, 2], [3, 3]),
      edgeKey([4, 2], [4, 3]),
    ])
    expect(result?.diffs.every((d) => d.from === 'unknown' && d.to === 'line')).toBe(true)
  })

  it('does not apply for an isolated single clue-3 cell', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('emits diffs only for unknown edges within a matched run', () => {
    const puzzle = createSlitherPuzzle(3, 4)
    setClue(puzzle, 0, 1, 3)
    setClue(puzzle, 0, 2, 3)

    const alreadyLine = edgeKey([0, 1], [1, 1])
    const blocked = edgeKey([0, 2], [1, 2])
    const unknownEdge = edgeKey([0, 3], [1, 3])
    puzzle.edges[alreadyLine].mark = 'line'
    puzzle.edges[blocked].mark = 'blank'

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual(['0,1', '0,2'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([unknownEdge])
    expect(result?.diffs).toEqual([{ edgeKey: unknownEdge, from: 'unknown', to: 'line' }])
  })
})

describe('slither diagonal adjacent 3 outer corners rule', () => {
  const diagonalRule = slitherRules.find((rule) => rule.id === 'diagonal-adjacent-three-outer-corners')
  if (!diagonalRule) {
    throw new Error('Expected diagonal-adjacent-three-outer-corners rule')
  }

  it('forces outer-corner edges for main diagonal adjacent 3s', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 3)
    setClue(puzzle, 1, 1, 3)

    const result = diagonalRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toBe('Diagonal adjacent 3s force outer-corner boundary edges to be lines.')
    expect(result?.affectedCells).toEqual(['0,0', '1,1'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([
      edgeKey([0, 0], [1, 0]),
      edgeKey([0, 0], [0, 1]),
      edgeKey([1, 2], [2, 2]),
      edgeKey([2, 1], [2, 2]),
    ])
  })

  it('forces outer-corner edges for anti diagonal adjacent 3s', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 1, 3)
    setClue(puzzle, 1, 0, 3)

    const result = diagonalRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toBe('Diagonal adjacent 3s force outer-corner boundary edges to be lines.')
    expect(result?.affectedCells).toEqual(['0,1', '1,0'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([
      edgeKey([0, 1], [0, 2]),
      edgeKey([0, 2], [1, 2]),
      edgeKey([1, 0], [2, 0]),
      edgeKey([2, 0], [2, 1]),
    ])
  })

  it('applies both diagonals in one step when a 2x2 block is all 3s', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 3)
    setClue(puzzle, 0, 1, 3)
    setClue(puzzle, 1, 0, 3)
    setClue(puzzle, 1, 1, 3)

    const result = diagonalRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual(['0,0', '1,1', '0,1', '1,0'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([
      edgeKey([0, 0], [1, 0]),
      edgeKey([0, 0], [0, 1]),
      edgeKey([1, 2], [2, 2]),
      edgeKey([2, 1], [2, 2]),
      edgeKey([0, 1], [0, 2]),
      edgeKey([0, 2], [1, 2]),
      edgeKey([1, 0], [2, 0]),
      edgeKey([2, 0], [2, 1]),
    ])
    expect(result?.diffs.every((d) => d.from === 'unknown' && d.to === 'line')).toBe(true)
  })

  it('does not apply when 3 clues are not diagonally adjacent', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 0, 0, 3)
    setClue(puzzle, 2, 2, 3)

    const result = diagonalRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('emits diffs only for unknown edges when diagonal pattern is matched', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 3)
    setClue(puzzle, 1, 1, 3)

    const alreadyLine = edgeKey([0, 0], [1, 0])
    const alreadyBlank = edgeKey([0, 0], [0, 1])
    const unknownA = edgeKey([1, 2], [2, 2])
    const unknownB = edgeKey([2, 1], [2, 2])
    puzzle.edges[alreadyLine].mark = 'line'
    puzzle.edges[alreadyBlank].mark = 'blank'

    const result = diagonalRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual(['0,0', '1,1'])
    expect(result?.diffs.map((d) => d.edgeKey)).toEqual([unknownA, unknownB])
    expect(result?.diffs).toEqual([
      { edgeKey: unknownA, from: 'unknown', to: 'line' },
      { edgeKey: unknownB, from: 'unknown', to: 'line' },
    ])
  })
})
