import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../parsers/puzzlink'
import { cellKey, edgeKey, getCornerEdgeKeys, sectorKey } from '../../ir/keys'
import { createSlitherPuzzle } from '../../ir/slither'
import type { PuzzleIR } from '../../ir/types'
import { runNextRule } from '../engine'
import { slitherRules } from './rules'

const setClue = (puzzle: PuzzleIR, row: number, col: number, value: number): void => {
  puzzle.cells[cellKey(row, col)] = {
    clue: { kind: 'number', value },
  }
}

const getEdgeDiffKeys = (result: ReturnType<(typeof slitherRules)[number]['apply']>): string[] =>
  result?.diffs.flatMap((d) => (d.kind === 'edge' ? [d.edgeKey] : [])) ?? []

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
    expect(getEdgeDiffKeys(result)).toEqual([
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
    expect(getEdgeDiffKeys(result)).toEqual([
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
    expect(getEdgeDiffKeys(result)).toEqual([unknownEdge])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: unknownEdge, from: 'unknown', to: 'line' },
    ])
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
    expect(getEdgeDiffKeys(result)).toEqual([
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
    expect(getEdgeDiffKeys(result)).toEqual([
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
    expect(getEdgeDiffKeys(result)).toEqual([
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
    expect(getEdgeDiffKeys(result)).toEqual([unknownA, unknownB])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: unknownA, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: unknownB, from: 'unknown', to: 'line' },
    ])
  })
})

describe('slither sector notOne clue-2 propagation rule', () => {
  const propagationRule = slitherRules.find((rule) => rule.id === 'sector-not-one-clue-two-propagation')
  if (!propagationRule) {
    throw new Error('Expected sector-not-one-clue-two-propagation rule')
  }

  it('marks target corner edges blank when clue=2, target sector is notOne, and opposite corner has a line', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].mark = 'notOne'
    const [seTopOrBottom] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[seTopOrBottom].mark = 'line'

    const result = propagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwTop, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'blank' },
    ])
    expect(result?.affectedCells).toEqual([cellKey(0, 0)])
    expect(result?.affectedSectors).toEqual([sectorKey(0, 0, 'nw'), sectorKey(0, 0, 'se')])
  })

  it('does not apply when clue is not 2', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 3)
    puzzle.sectors[sectorKey(0, 0, 'nw')].mark = 'notOne'
    const [seEdge] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[seEdge].mark = 'line'

    const result = propagationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not apply when opposite corner has no line', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].mark = 'notOne'

    const result = propagationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('is idempotent when target corner edges are already decided', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].mark = 'notOne'
    const [seEdge] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[seEdge].mark = 'line'
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'blank'
    puzzle.edges[nwLeft].mark = 'blank'

    const result = propagationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('appears during stepwise solving for the provided 10x10 puzzle', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/10/10/zsan23dzzq')
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 600; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-not-one-clue-two-propagation') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })
})

describe('slither apply sectors rule', () => {
  const applySectorsRule = slitherRules.find((rule) => rule.id === 'sector-inference')
  if (!applySectorsRule) {
    throw new Error('Expected sector-inference rule')
  }

  it('applies notZero sectors for clue 3 corners', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 3)

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toBe('Apply Sectors from Vertex: inferred corner sector constraints from current edges.')
    expect(result?.affectedCells).toEqual(['0,0'])
    expect(result?.affectedSectors).toEqual([
      sectorKey(0, 0, 'nw'),
      sectorKey(0, 0, 'ne'),
      sectorKey(0, 0, 'sw'),
      sectorKey(0, 0, 'se'),
    ])
    expect(result?.diffs.every((d) => d.kind === 'sector')).toBe(true)
    expect(result?.diffs).toEqual([
      { kind: 'sector', sectorKey: sectorKey(0, 0, 'nw'), from: 'unknown', to: 'notZero' },
      { kind: 'sector', sectorKey: sectorKey(0, 0, 'ne'), from: 'unknown', to: 'notZero' },
      { kind: 'sector', sectorKey: sectorKey(0, 0, 'sw'), from: 'unknown', to: 'notZero' },
      { kind: 'sector', sectorKey: sectorKey(0, 0, 'se'), from: 'unknown', to: 'notZero' },
    ])
  })

  it('applies fixed when corner has one line and one blank edge', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'blank'

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedSectors).toContain(sectorKey(0, 0, 'nw'))
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'nw'),
      from: 'unknown',
      to: 'fixed',
    })
  })

  it('returns null when sectors are already up to date', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 3)
    const first = applySectorsRule.apply(puzzle)
    if (!first) {
      throw new Error('Expected first apply-sectors result')
    }
    for (const diff of first.diffs) {
      if (diff.kind === 'sector') {
        puzzle.sectors[diff.sectorKey].mark = diff.to
      }
    }

    const second = applySectorsRule.apply(puzzle)

    expect(second).toBeNull()
  })
})
