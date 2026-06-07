import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../../parsers/puzzlink'
import { cellKey, edgeKey, parseEdgeKey } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import { runNextRule } from '../../engine'
import { slitherRules } from '../rules'
import { setClue, getEdgeDiffKeys } from './testUtils'

describe('slither contiguous 3-run boundaries rule', () => {
  const threeRunRule = slitherRules.find(
    (rule) => rule.id === 'contiguous-three-run-boundaries',
  )
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
    expect(result?.message).toContain('Contiguous 3-run')
    expect(result?.affectedCells).toEqual(['1,1', '1,2', '1,3'])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 1], [2, 1]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 2], [2, 2]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 3], [2, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 4], [2, 4]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 2], [1, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [3, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 3], [1, 3]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 3], [3, 3]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('forces all horizontal run boundaries for a vertical 3-run', () => {
    const puzzle = createSlitherPuzzle(5, 4)
    setClue(puzzle, 1, 2, 3)
    setClue(puzzle, 2, 2, 3)
    setClue(puzzle, 3, 2, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toContain('Contiguous 3-run')
    expect(result?.affectedCells).toEqual(['1,2', '2,2', '3,2'])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 2], [1, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [2, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([3, 2], [3, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([4, 2], [4, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 1], [2, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 3], [2, 4]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([3, 1], [3, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([3, 3], [3, 4]),
        from: 'unknown',
        to: 'blank',
      },
    ])
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
    const extensionBlank = edgeKey([1, 2], [2, 2])
    expect(result?.affectedCells).toEqual(['0,1', '0,2'])
    expect(getEdgeDiffKeys(result)).toEqual([unknownEdge, extensionBlank])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: unknownEdge, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: extensionBlank, from: 'unknown', to: 'blank' },
    ])
  })

  it('only emits in-bounds extension blanks near board edge', () => {
    const puzzle = createSlitherPuzzle(5, 4)
    setClue(puzzle, 1, 0, 3)
    setClue(puzzle, 2, 0, 3)
    setClue(puzzle, 3, 0, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: edgeKey([2, 1], [2, 2]),
      from: 'unknown',
      to: 'blank',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: edgeKey([3, 1], [3, 2]),
      from: 'unknown',
      to: 'blank',
    })
    const blankEdgeKeys =
      result?.diffs.flatMap((d) =>
        d.kind === 'edge' && d.to === 'blank' ? [d.edgeKey] : [],
      ) ?? []
    expect(blankEdgeKeys).toEqual([
      edgeKey([2, 1], [2, 2]),
      edgeKey([3, 1], [3, 2]),
    ])
  })

  it('appears on provided 6x6 puzzle and emits both horizontal/vertical extension blanks', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/6/6/mdidi833dp',
    )
    let sawVerticalBlank = false
    let sawHorizontalBlank = false

    for (let stepNumber = 1; stepNumber <= 500; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (step.ruleId !== 'contiguous-three-run-boundaries') {
        current = nextPuzzle
        continue
      }

      for (const diff of step.diffs) {
        if (diff.kind !== 'edge' || diff.to !== 'blank') {
          continue
        }
        const [a, b] = parseEdgeKey(diff.edgeKey)
        if (a[0] !== b[0]) {
          sawVerticalBlank = true
        } else {
          sawHorizontalBlank = true
        }
      }

      if (sawVerticalBlank && sawHorizontalBlank) {
        break
      }
      current = nextPuzzle
    }

    expect(sawVerticalBlank).toBe(true)
    expect(sawHorizontalBlank).toBe(true)
  })
})

describe('slither diagonal adjacent 3 outer corners rule', () => {
  const diagonalRule = slitherRules.find(
    (rule) => rule.id === 'diagonal-adjacent-three-outer-corners',
  )
  if (!diagonalRule) {
    throw new Error('Expected diagonal-adjacent-three-outer-corners rule')
  }

  it('forces outer-corner edges for main diagonal adjacent 3s', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 3)
    setClue(puzzle, 1, 1, 3)

    const result = diagonalRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toContain(
      'Diagonal adjacent 3s force their outside corner edges',
    )
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
    expect(result?.message).toContain(
      'Diagonal adjacent 3s force their outside corner edges',
    )
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
    expect(
      result?.diffs.every(
        (d) => d.kind === 'edge' && d.from === 'unknown' && d.to === 'line',
      ),
    ).toBe(true)
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

describe('slither adjacent 2-3 opposite-cross rule', () => {
  const adjacentRule = slitherRules.find(
    (rule) => rule.id === 'adjacent-two-three-opposite-cross',
  )
  if (!adjacentRule) {
    throw new Error('Expected adjacent-two-three-opposite-cross rule')
  }

  it('forces the 3 opposite edge and shared-edge extensions for a horizontal 2-3 pair', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    setClue(puzzle, 1, 2, 3)
    puzzle.edges[edgeKey([1, 1], [2, 1])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(1, 1), cellKey(1, 2)])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 3], [2, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 2], [1, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [3, 2]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('supports the mirrored horizontal 3-2 order', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 3)
    setClue(puzzle, 1, 2, 2)
    puzzle.edges[edgeKey([1, 3], [2, 3])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(1, 2), cellKey(1, 1)])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 1], [2, 1]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 2], [1, 2]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [3, 2]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('forces the 3 opposite edge and shared-edge extensions for a vertical 2-3 pair', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    setClue(puzzle, 2, 1, 3)
    puzzle.edges[edgeKey([1, 1], [1, 2])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(1, 1), cellKey(2, 1)])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([3, 1], [3, 2]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 0], [2, 1]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [2, 3]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('supports the mirrored vertical 3-2 order', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 3)
    setClue(puzzle, 2, 1, 2)
    puzzle.edges[edgeKey([3, 1], [3, 2])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(2, 1), cellKey(1, 1)])
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 1], [1, 2]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 0], [2, 1]),
        from: 'unknown',
        to: 'blank',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [2, 3]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('only emits in-bounds extension blanks at the boundary', () => {
    const puzzle = createSlitherPuzzle(3, 4)
    setClue(puzzle, 0, 1, 2)
    setClue(puzzle, 0, 2, 3)
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 3], [1, 3]),
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 2], [2, 2]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })

  it('does not apply when the 2 opposite edge is not explicitly blank', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    setClue(puzzle, 1, 2, 3)

    const result = adjacentRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('emits diffs only for unknown target edges', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    setClue(puzzle, 1, 2, 3)
    puzzle.edges[edgeKey([1, 1], [2, 1])].mark = 'blank'
    puzzle.edges[edgeKey([1, 3], [2, 3])].mark = 'line'
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'

    const result = adjacentRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([2, 2], [3, 2]),
        from: 'unknown',
        to: 'blank',
      },
    ])
  })
})
