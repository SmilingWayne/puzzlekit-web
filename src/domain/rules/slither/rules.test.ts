import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../parsers/puzzlink'
import { cellKey, edgeKey, getCellEdgeKeys, getCornerEdgeKeys, parseEdgeKey, sectorKey } from '../../ir/keys'
import { clonePuzzle } from '../../ir/normalize'
import { createSlitherPuzzle } from '../../ir/slither'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_NOT_2,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  type PuzzleIR,
} from '../../ir/types'
import { runNextRule } from '../engine'
import type { Rule } from '../types'
import { slitherRules } from './rules'
import { createColorAssumptionInferenceRule } from './rules/colorAssumptionInference'
import { createStrongInferenceRule } from './rules/strongInference'
import { runTrialUntilFixpoint } from './rules/trial'

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
    expect(result?.message).toContain('Contiguous 3-run pattern forced')
    expect(result?.affectedCells).toEqual(['1,1', '1,2', '1,3'])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: edgeKey([1, 1], [2, 1]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([1, 2], [2, 2]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([1, 3], [2, 3]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([1, 4], [2, 4]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([0, 2], [1, 2]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([2, 2], [3, 2]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([0, 3], [1, 3]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([2, 3], [3, 3]), from: 'unknown', to: 'blank' },
    ])
  })

  it('forces all horizontal run boundaries for a vertical 3-run', () => {
    const puzzle = createSlitherPuzzle(5, 4)
    setClue(puzzle, 1, 2, 3)
    setClue(puzzle, 2, 2, 3)
    setClue(puzzle, 3, 2, 3)

    const result = threeRunRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toContain('Contiguous 3-run pattern forced')
    expect(result?.affectedCells).toEqual(['1,2', '2,2', '3,2'])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: edgeKey([1, 2], [1, 3]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([2, 2], [2, 3]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([3, 2], [3, 3]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([4, 2], [4, 3]), from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: edgeKey([2, 1], [2, 2]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([2, 3], [2, 4]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([3, 1], [3, 2]), from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: edgeKey([3, 3], [3, 4]), from: 'unknown', to: 'blank' },
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
      result?.diffs.flatMap((d) => (d.kind === 'edge' && d.to === 'blank' ? [d.edgeKey] : [])) ?? []
    expect(blankEdgeKeys).toEqual([edgeKey([2, 1], [2, 2]), edgeKey([3, 1], [3, 2])])
  })

  it('appears on provided 6x6 puzzle and emits both horizontal/vertical extension blanks', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/6/6/mdidi833dp')
    let sawVerticalBlank = false
    let sawHorizontalBlank = false

    for (let stepNumber = 1; stepNumber <= 500; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
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
    expect(result?.message).toContain('Diagonal adjacent 3s force outer-corner boundary edges to be lines.')
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
    expect(result?.message).toContain('Diagonal adjacent 3s force outer-corner boundary edges to be lines.')
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
      result?.diffs.every((d) => d.kind === 'edge' && d.from === 'unknown' && d.to === 'line'),
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

describe('slither cell clue completion rule', () => {
  const cellCountRule = slitherRules.find((rule) => rule.id === 'cell-count-completion')
  if (!cellCountRule) {
    throw new Error('Expected cell-count-completion rule')
  }

  it('fills remaining unknown edges as blank when clue already has enough lines', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 1)
    const [top, bottom, left, right] = getCellEdgeKeys(0, 0)
    puzzle.edges[top].mark = 'line'

    const result = cellCountRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(0, 0)])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
    ])
  })

  it('fills remaining unknown edges as line when all unknowns are required by clue', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 3)
    const [top, bottom, left, right] = getCellEdgeKeys(0, 0)
    puzzle.edges[top].mark = 'blank'

    const result = cellCountRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedCells).toEqual([cellKey(0, 0)])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
    ])
  })
})

describe('slither color-edge propagation rule', () => {
  const colorRule = slitherRules.find((rule) => rule.id === 'color-edge-propagation')
  if (!colorRule) {
    throw new Error('Expected color-edge-propagation rule')
  }

  it('marks edge blank when two adjacent cells have same color', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    const between = edgeKey([0, 1], [1, 1])

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: between,
      from: 'unknown',
      to: 'blank',
    })
  })

  it('marks edge line when two adjacent cells have different colors', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    const between = edgeKey([0, 1], [1, 1])

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: between,
      from: 'unknown',
      to: 'line',
    })
  })

  it('infers opposite color across a line edge', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const between = edgeKey([0, 1], [1, 1])
    puzzle.edges[between].mark = 'line'
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('infers same color across a blank edge', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const between = edgeKey([0, 1], [1, 1])
    puzzle.edges[between].mark = 'blank'
    puzzle.cells[cellKey(0, 0)] = { fill: 'yellow' }

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })
})

describe('slither color outside seeding rule', () => {
  const outsideRule = slitherRules.find((rule) => rule.id === 'color-outside-seeding')
  if (!outsideRule) {
    throw new Error('Expected color-outside-seeding rule')
  }

  it('marks boundary-adjacent cell yellow when boundary edge is blank', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const topLeftTop = edgeKey([0, 0], [0, 1])
    puzzle.edges[topLeftTop].mark = 'blank'

    const result = outsideRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 0),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('marks boundary-adjacent cell green when boundary edge is line', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const topLeftTop = edgeKey([0, 0], [0, 1])
    puzzle.edges[topLeftTop].mark = 'line'

    const result = outsideRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 0),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('colors a whole boundary-anchored parity component in one application', () => {
    const puzzle = createSlitherPuzzle(2, 3)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'blank'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'

    const result = outsideRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'yellow' },
        { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
        { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'green' },
      ]),
    )
  })

  it('does not color an unanchored parity component', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = outsideRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('uses an existing colored cell as a parity component anchor', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = outsideRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'yellow' },
    ])
  })

  it('does not color a component with conflicting anchors', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'blank'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'

    const result = outsideRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('colors multiple anchored components independently', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'blank'
    puzzle.edges[edgeKey([2, 1], [2, 2])].mark = 'line'

    const result = outsideRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'yellow' },
        { kind: 'cell', cellKey: cellKey(1, 1), fromFill: null, toFill: 'green' },
      ]),
    )
  })
})

describe('slither color clue propagation rule', () => {
  const clueColorRule = slitherRules.find((rule) => rule.id === 'color-clue-propagation')
  if (!clueColorRule) {
    throw new Error('Expected color-clue-propagation rule')
  }

  it('colors numbered cell green when clue is less than innercnt', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 1)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }

    const result = clueColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('propagates yellow neighbors when yellow numbered cell has clue equal to innercnt', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 1)
    puzzle.cells[cellKey(1, 1)] = { ...puzzle.cells[cellKey(1, 1)], fill: 'yellow' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }

    const result = clueColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'yellow',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 0),
      fromFill: null,
      toFill: 'yellow',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 2),
      fromFill: null,
      toFill: 'yellow',
    })
  })
})

describe('slither color orthogonal consensus propagation rule', () => {
  const orthogonalColorRule = slitherRules.find((rule) => rule.id === 'color-orthogonal-consensus-propagation')
  if (!orthogonalColorRule) {
    throw new Error('Expected color-orthogonal-consensus-propagation rule')
  }

  it('colors an interior unknown cell green when four orthogonal neighbors are green', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('colors an interior unknown cell yellow when four orthogonal neighbors are yellow', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'yellow' }
    puzzle.cells[cellKey(1, 2)] = { fill: 'yellow' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('treats out-of-bounds orthogonals as yellow for boundary inference', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'yellow' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 0),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('does not apply when an in-bounds orthogonal neighbor is unknown', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not apply when orthogonal neighbors are mixed colors', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 2)] = { fill: 'yellow' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not overwrite an already colored cell', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = orthogonalColorRule.apply(puzzle)

    expect(result).toBeNull()
  })
})

describe('slither inside reachability coloring rule', () => {
  const reachabilityRule = slitherRules.find((rule) => rule.id === 'inside-reachability-coloring')
  if (!reachabilityRule) {
    throw new Error('Expected inside-reachability-coloring rule')
  }

  it('colors an unreachable unknown non-3 cell yellow', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = reachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'yellow' },
    ])
  })

  it('does not color reachable unknown cells across unknown or blank edges', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'

    const result = reachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not cross a line edge', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = reachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'yellow' },
        { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'yellow' },
      ]),
    )
  })

  it('does not traverse through existing yellow cells', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }

    const result = reachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'yellow' },
    ])
  })

  it('does not traverse into clue-3 cells and does not color clue-3 cells yellow', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    setClue(puzzle, 0, 1, 3)

    const result = reachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'yellow' },
    ])
    expect(result?.diffs).not.toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('returns null when there are no known green source cells', () => {
    const puzzle = createSlitherPuzzle(2, 2)

    const result = reachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('floods from multiple green source components', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = reachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('appears on the provided 19x10 puzzle within the normal solve limit', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/19/10/y13c22d32c1186b8c8b8631d31b13c32czx32c22b21d3376d8d8c7612d32b23b31cw',
    )
    let sawReachabilityColoring = false

    for (let stepNumber = 1; stepNumber <= 100; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (
        step.ruleId === 'inside-reachability-coloring' &&
        step.diffs.some((diff) => diff.kind === 'cell' && diff.toFill === 'yellow')
      ) {
        sawReachabilityColoring = true
        break
      }
      current = nextPuzzle
    }

    expect(sawReachabilityColoring).toBe(true)
  })
})

describe('slither color sector-mask propagation rule', () => {
  const sectorColorRule = slitherRules.find((rule) => rule.id === 'color-sector-mask-propagation')
  if (!sectorColorRule) {
    throw new Error('Expected color-sector-mask-propagation rule')
  }

  it('infers same color from notOne sector when one adjacent cell color is known', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_1
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('infers opposite color from onlyOne sector when one adjacent cell color is known', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('treats onlyZero and onlyTwo as notOne and infers same color', () => {
    const onlyZeroPuzzle = createSlitherPuzzle(3, 3)
    onlyZeroPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_0
    onlyZeroPuzzle.cells[cellKey(1, 2)] = { fill: 'yellow' }

    const onlyZeroResult = sectorColorRule.apply(onlyZeroPuzzle)

    expect(onlyZeroResult).not.toBeNull()
    expect(onlyZeroResult?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'yellow',
    })

    const onlyTwoPuzzle = createSlitherPuzzle(3, 3)
    onlyTwoPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_2
    onlyTwoPuzzle.cells[cellKey(1, 2)] = { fill: 'green' }

    const onlyTwoResult = sectorColorRule.apply(onlyTwoPuzzle)

    expect(onlyTwoResult).not.toBeNull()
    expect(onlyTwoResult?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('treats out-of-bounds adjacent cell as yellow at boundary', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'ne')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('does not apply when both adjacent cells are unknown and in bounds', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_1

    const result = sectorColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not apply when both adjacent cells are already colored', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_1
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'yellow' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('skips conflicting inference and returns null when no other updates exist', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).toBeNull()
  })
})

describe('slither prevent premature loop rule', () => {
  const antiLoopRule = slitherRules.find((rule) => rule.id === 'prevent-premature-loop')
  if (!antiLoopRule) {
    throw new Error('Expected prevent-premature-loop rule')
  }

  it('is ordered after vertex-degree, outside-seeding, edge-propagation, and clue-propagation', () => {
    const vertexRuleIdx = slitherRules.findIndex((rule) => rule.id === 'vertex-degree')
    const outsideRuleIdx = slitherRules.findIndex((rule) => rule.id === 'color-outside-seeding')
    const colorRuleIdx = slitherRules.findIndex((rule) => rule.id === 'color-edge-propagation')
    const clueRuleIdx = slitherRules.findIndex((rule) => rule.id === 'color-clue-propagation')
    const sectorColorRuleIdx = slitherRules.findIndex((rule) => rule.id === 'color-sector-mask-propagation')
    const orthogonalConsensusRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-orthogonal-consensus-propagation',
    )
    const reachabilityRuleIdx = slitherRules.findIndex((rule) => rule.id === 'inside-reachability-coloring')
    const antiLoopRuleIdx = slitherRules.findIndex((rule) => rule.id === 'prevent-premature-loop')
    expect(vertexRuleIdx).toBeGreaterThanOrEqual(0)
    expect(outsideRuleIdx).toBe(vertexRuleIdx + 1)
    expect(colorRuleIdx).toBe(outsideRuleIdx + 1)
    expect(clueRuleIdx).toBe(colorRuleIdx + 1)
    expect(sectorColorRuleIdx).toBe(clueRuleIdx + 1)
    expect(orthogonalConsensusRuleIdx).toBe(sectorColorRuleIdx + 1)
    expect(reachabilityRuleIdx).toBe(orthogonalConsensusRuleIdx + 1)
    expect(antiLoopRuleIdx).toBe(reachabilityRuleIdx + 1)
  })

  it('marks an unknown edge blank when it would close a loop', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const top = edgeKey([0, 0], [0, 1])
    const right = edgeKey([0, 1], [1, 1])
    const bottom = edgeKey([1, 0], [1, 1])
    const closing = edgeKey([0, 0], [1, 0])
    puzzle.edges[top].mark = 'line'
    puzzle.edges[right].mark = 'line'
    puzzle.edges[bottom].mark = 'line'

    const result = antiLoopRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(getEdgeDiffKeys(result)).toEqual([closing])
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: closing, from: 'unknown', to: 'blank' }])
  })

  it('marks all loop-closing unknown edges in one application', () => {
    const puzzle = createSlitherPuzzle(3, 3)

    const topLeftTop = edgeKey([0, 0], [0, 1])
    const topLeftRight = edgeKey([0, 1], [1, 1])
    const topLeftBottom = edgeKey([1, 0], [1, 1])
    const topLeftClosing = edgeKey([0, 0], [1, 0])

    const bottomRightTop = edgeKey([2, 2], [2, 3])
    const bottomRightRight = edgeKey([2, 3], [3, 3])
    const bottomRightBottom = edgeKey([3, 2], [3, 3])
    const bottomRightClosing = edgeKey([2, 2], [3, 2])

    puzzle.edges[topLeftTop].mark = 'line'
    puzzle.edges[topLeftRight].mark = 'line'
    puzzle.edges[topLeftBottom].mark = 'line'
    puzzle.edges[bottomRightTop].mark = 'line'
    puzzle.edges[bottomRightRight].mark = 'line'
    puzzle.edges[bottomRightBottom].mark = 'line'

    const result = antiLoopRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(getEdgeDiffKeys(result)).toEqual([topLeftClosing, bottomRightClosing])
    expect(
      result?.diffs.every((d) => d.kind === 'edge' && d.from === 'unknown' && d.to === 'blank'),
    ).toBe(true)
  })

  it('does not apply when unknown edges do not close a loop', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 1], [2, 1])].mark = 'line'

    const result = antiLoopRule.apply(puzzle)

    expect(result).toBeNull()
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
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
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
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
    const [seEdge] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[seEdge].mark = 'line'

    const result = propagationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not apply when opposite corner has no line', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1

    const result = propagationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('is idempotent when target corner edges are already decided', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
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
      if (
        step.ruleId === 'sector-not-one-clue-two-propagation' ||
        step.ruleId === 'sector-clue-two-combination-feasibility'
      ) {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })
})

describe('slither sector diagonal shared-vertex propagation rule', () => {
  const diagonalSectorRule = slitherRules.find(
    (rule) => rule.id === 'sector-diagonal-shared-vertex-propagation',
  )
  if (!diagonalSectorRule) {
    throw new Error('Expected sector-diagonal-shared-vertex-propagation rule')
  }

  it('propagates onlyOne from A.ne to B.sw', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.sectors[sectorKey(2, 2, 'ne')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(1, 3, 'sw'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_ONLY_1,
      },
    ])
    expect(result?.affectedCells).toEqual([cellKey(2, 2), cellKey(1, 3)])
    expect(result?.affectedSectors).toEqual([sectorKey(2, 2, 'ne'), sectorKey(1, 3, 'sw')])
  })

  it('propagates notOne from A.ne to B.sw', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.sectors[sectorKey(2, 2, 'ne')].constraintsMask = SECTOR_MASK_NOT_1

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(1, 3, 'sw'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_1,
      },
    ])
  })

  it('propagates notZero from A.ne to B.sw as notTwo', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.sectors[sectorKey(2, 2, 'ne')].constraintsMask = SECTOR_MASK_NOT_0

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(1, 3, 'sw'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_2,
      },
    ])
  })

  it('does not apply when diagonal target cell is out of bounds', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('is idempotent when target sector is already equally constrained', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.sectors[sectorKey(2, 2, 'ne')].constraintsMask = SECTOR_MASK_NOT_0
    puzzle.sectors[sectorKey(1, 3, 'sw')].constraintsMask = SECTOR_MASK_NOT_2

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('skips conflicts when intersection would become zero', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.sectors[sectorKey(2, 2, 'ne')].constraintsMask = SECTOR_MASK_NOT_0
    puzzle.sectors[sectorKey(1, 3, 'sw')].constraintsMask = SECTOR_MASK_ONLY_2

    const result = diagonalSectorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('appears during stepwise solving for the provided 8x8 puzzle', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/8/8/gdg1dddbdid26d72ccicadc3cgc')
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-diagonal-shared-vertex-propagation') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })

  it('appears during stepwise solving for the provided 10x10 puzzle', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/ga337ddkdh2adbgdi20dp23dibgbd0dhdkd511da',
    )
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1200; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-diagonal-shared-vertex-propagation') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })
})

describe('slither sector clue-2 combination feasibility rule', () => {
  const combinationRule = slitherRules.find((rule) => rule.id === 'sector-clue-two-combination-feasibility')
  if (!combinationRule) {
    throw new Error('Expected sector-clue-two-combination-feasibility rule')
  }

  it('at (0,0) with clue=2 prunes impossible patterns and tightens sectors to notOne/onlyOne', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 2)

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'nw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'se'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'ne'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'sw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
      ]),
    )
    expect(result?.diffs).toHaveLength(4)
  })

  it('when one edge is pre-marked, keeps only feasible combos and can force exact sector masks', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 2)
    const [topEdge] = getCellEdgeKeys(0, 0)
    puzzle.edges[topEdge].mark = 'line'

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'nw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_2,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'se'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_0,
        },
      ]),
    )
  })

  it('uses sector prior masks to filter combos before projecting to all corners', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_1

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'ne'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'sw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
      ]),
    )
  })

  it('can become single-combo from sector constraints and force stronger ONLY masks', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_2

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'ne'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'sw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'se'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_ONLY_0,
        },
      ]),
    )
  })

  it('returns null when sector priors remove all clue-2 combinations (strategy B)', () => {
    const puzzle = createSlitherPuzzle(4, 4)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_2
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_2

    const result = combinationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('returns null when clue=2 combinations do not tighten any sector', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)

    const result = combinationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('with notTwo on one corner, projects to opposite notZero (former intra-cell notTwo case)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_2

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(1, 1, 'se'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_0,
      },
    ])
  })

  it('with notZero on one corner, projects to opposite notTwo (former intra-cell notZero case)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_0

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(1, 1, 'se'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_2,
      },
    ])
  })

  it('with onlyOne on ne, projects to diagonally opposite onlyOne (former intra-cell onlyOne pair)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'ne')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'sw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('with exactly one line edge in an interior cell, projects non-overlapping corners to notTwo (and tightens the line-adjacent corners)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    const [topEdge] = getCellEdgeKeys(1, 1)
    puzzle.edges[topEdge].mark = 'line'

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toHaveLength(4)
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'sw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_2,
    })
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'se'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_2,
    })
  })

  it('with exactly one blank edge in an interior cell, projects non-overlapping corners to notZero', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    const [, , leftEdge] = getCellEdgeKeys(1, 1)
    puzzle.edges[leftEdge].mark = 'blank'

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'ne'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_0,
    })
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'se'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_0,
    })
  })

  it('is idempotent when opposite corners are already as tight as the projection (former intra idempotent case)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_0
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_2

    const result = combinationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('skips a corner when prior masks conflict with the projection (former intra conflict case)', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_0
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_2

    const result = combinationRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('appears during stepwise solving for the provided 5x5 line-case puzzle', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/5/5/hdhdhcp')
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-clue-two-combination-feasibility') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })

  it('appears during stepwise solving for the provided 5x5 blank-case puzzle', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/5/5/mahcp')
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-clue-two-combination-feasibility') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })
})

describe('slither sector constraint edge propagation rule', () => {
  const edgePropagationRule = slitherRules.find((rule) => rule.id === 'sector-constraint-edge-propagation')
  if (!edgePropagationRule) {
    throw new Error('Expected sector-constraint-edge-propagation rule')
  }

  it('forces both corner edges to line when sector mask is onlyTwo', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_2
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwTop, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'line' },
    ])
  })

  it('forces both corner edges to blank when sector mask is onlyZero', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_0
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwTop, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'blank' },
    ])
  })

  it('forces the last unknown corner edge to line when onlyOne with one blank', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'blank'

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'line' }])
  })
})

describe('slither sector clue-1/3 onlyOne opposite edges rule', () => {
  const clueOneThreeRule = slitherRules.find((rule) => rule.id === 'sector-clue-one-three-intra-cell-propagation')
  if (!clueOneThreeRule) {
    throw new Error('Expected sector-clue-one-three-intra-cell-propagation rule')
  }

  it('forces the two edges not in the sector to blank when clue is 1 and sector is onlyOne', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 1)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    const cellEdges = getCellEdgeKeys(0, 0)
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    const opposite = cellEdges.filter((e) => e !== nwTop && e !== nwLeft)

    const result = clueOneThreeRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(opposite).toHaveLength(2)
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'edge', edgeKey: opposite[0], from: 'unknown', to: 'blank' },
        { kind: 'edge', edgeKey: opposite[1], from: 'unknown', to: 'blank' },
      ]),
    )
    expect(result?.diffs).toHaveLength(2)
    expect(result?.affectedCells).toEqual(['0,0'])
    expect(result?.affectedSectors).toContain(sectorKey(0, 0, 'nw'))
  })

  it('forces the two edges not in the sector to line when clue is 3 and sector is onlyOne', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 3)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    const cellEdges = getCellEdgeKeys(0, 0)
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    const opposite = cellEdges.filter((e) => e !== nwTop && e !== nwLeft)

    const result = clueOneThreeRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'edge', edgeKey: opposite[0], from: 'unknown', to: 'line' },
        { kind: 'edge', edgeKey: opposite[1], from: 'unknown', to: 'line' },
      ]),
    )
    expect(result?.diffs).toHaveLength(2)
  })
})

describe('slither vertex onlyOne non-sector balance rule', () => {
  const vertexBalanceRule = slitherRules.find((rule) => rule.id === 'vertex-onlyone-non-sector-balance')
  if (!vertexBalanceRule) {
    throw new Error('Expected vertex-onlyone-non-sector-balance rule')
  }

  it('forces the other non-sector edge to line when one non-sector edge is blank', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 0, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    const bottom = edgeKey([1, 1], [2, 1])
    const right = edgeKey([1, 1], [1, 2])
    puzzle.edges[bottom].mark = 'blank'

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' }])
    expect(result?.affectedSectors).toContain(sectorKey(0, 0, 'se'))
  })

  it('forces the other non-sector edge to blank when one non-sector edge is line', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 0, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    const bottom = edgeKey([1, 1], [2, 1])
    const right = edgeKey([1, 1], [1, 2])
    puzzle.edges[right].mark = 'line'

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' }])
  })

  it('supports diagonal-sector narrative: onlyOne on one diagonal plus blank on opposite diagonal edge forces line', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'sw')].constraintsMask = SECTOR_MASK_ONLY_1

    const oppositeDiagonalEdgeA = edgeKey([1, 0], [1, 1])
    const oppositeDiagonalEdgeB = edgeKey([1, 1], [2, 1])
    puzzle.edges[oppositeDiagonalEdgeA].mark = 'blank'

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: oppositeDiagonalEdgeB, from: 'unknown', to: 'line' }])
    expect(result?.affectedSectors).toContain(sectorKey(0, 1, 'sw'))
  })

  it('forces the single non-sector boundary edge to line when a boundary corner sector is onlyOne', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: edgeKey([0, 0], [0, 1]), from: 'unknown', to: 'line' },
    ])
    expect(result?.affectedSectors).toContain(sectorKey(0, 1, 'nw'))
  })

  it('is idempotent on boundary single non-sector case when edge is already decided', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    const forced = edgeKey([0, 0], [0, 1])
    puzzle.edges[forced].mark = 'line'

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not force boundary non-sector edge when sector is not onlyOne', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'nw')].constraintsMask = SECTOR_MASK_NOT_1

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('appears during stepwise solving for the provided 5x5 cgcx puzzle with boundary line diff', () => {
    let current = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/5/5/cgcx')
    let triggered = false
    let sawBoundaryLine = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, slitherRules, stepNumber)
      if (!step) {
        break
      }
      if (step.ruleId === 'vertex-onlyone-non-sector-balance') {
        triggered = true
        for (const diff of step.diffs) {
          if (diff.kind !== 'edge' || diff.to !== 'line') {
            continue
          }
          const [a, b] = parseEdgeKey(diff.edgeKey)
          const isBoundary =
            (a[0] === 0 && b[0] === 0) ||
            (a[0] === current.rows && b[0] === current.rows) ||
            (a[1] === 0 && b[1] === 0) ||
            (a[1] === current.cols && b[1] === current.cols)
          if (isBoundary) {
            sawBoundaryLine = true
            break
          }
        }
        if (sawBoundaryLine) {
          break
        }
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
    expect(sawBoundaryLine).toBe(true)
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
    puzzle.sectors[sectorKey(0, 1, 'ne')].constraintsMask = SECTOR_MASK_NOT_1
    puzzle.sectors[sectorKey(1, 0, 'sw')].constraintsMask = SECTOR_MASK_NOT_1
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_1

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.message).toContain('Apply Sectors from Vertex')
    expect(result?.affectedCells).toEqual(['0,0'])
    expect(result?.affectedSectors).toEqual([
      sectorKey(0, 0, 'nw'),
      sectorKey(0, 0, 'ne'),
      sectorKey(0, 0, 'sw'),
      sectorKey(0, 0, 'se'),
    ])
    expect(result?.diffs.every((d) => d.kind === 'sector')).toBe(true)
    expect(result?.diffs).toEqual([
      {
        kind: 'sector',
        sectorKey: sectorKey(0, 0, 'nw'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_ONLY_2,
      },
      {
        kind: 'sector',
        sectorKey: sectorKey(0, 0, 'ne'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_0,
      },
      {
        kind: 'sector',
        sectorKey: sectorKey(0, 0, 'sw'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_0,
      },
      {
        kind: 'sector',
        sectorKey: sectorKey(0, 0, 'se'),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_0,
      },
    ])
  })

  it('applies onlyOne mask when corner has one line and one blank edge', () => {
    const puzzle = createSlitherPuzzle(2, 3)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'blank'

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.affectedSectors).toContain(sectorKey(0, 0, 'ne'))
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'ne'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('infers onlyOne for (0,3) nw on a boundary vertex with three incident edges (puzz.link 4×4)', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/4/4/183aibi')
    expect(puzzle.cells[cellKey(0, 3)]?.clue).toEqual({ kind: 'number', value: 3 })

    // Vertex (0,3) has only three incident edges; the edge west of that vertex is outside the
    // (0,3)-nw sector. One line there forces the sector to contribute exactly one line (step 1.2).
    const westOfVertex = edgeKey([0, 2], [0, 3])
    puzzle.edges[westOfVertex].mark = 'line'

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    const nw03 = sectorKey(0, 3, 'nw')
    expect(result?.affectedSectors).toContain(nw03)
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: nw03,
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('tightens board-corner sectors to notOne from natural boundary geometry', () => {
    const puzzle = createSlitherPuzzle(2, 2)

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'nw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 1, 'ne'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 0, 'sw'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
        {
          kind: 'sector',
          sectorKey: sectorKey(1, 1, 'se'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
      ]),
    )
  })

  it('does not relax already-strong corner sector masks', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_0
    puzzle.sectors[sectorKey(0, 1, 'ne')].constraintsMask = SECTOR_MASK_ONLY_2
    puzzle.sectors[sectorKey(1, 0, 'sw')].constraintsMask = SECTOR_MASK_ONLY_0
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_2

    const result = applySectorsRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('tightens edge non-corner sector to notOne when its only non-sector edge is blank', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    const nonSectorEdge = edgeKey([0, 0], [0, 1])
    puzzle.edges[nonSectorEdge].mark = 'blank'

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 1, 'nw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_1,
    })
  })

  it('does not relax already-strong edge non-corner sector masks under boundary blank evidence', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    const nonSectorEdge = edgeKey([0, 0], [0, 1])
    puzzle.edges[nonSectorEdge].mark = 'blank'
    const targetSector = sectorKey(0, 1, 'nw')
    puzzle.sectors[targetSector].constraintsMask = SECTOR_MASK_ONLY_0

    const result = applySectorsRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs.some((d) => d.kind === 'sector' && d.sectorKey === targetSector)).toBe(false)
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
        puzzle.sectors[diff.sectorKey].constraintsMask = diff.toMask
      }
    }

    const second = applySectorsRule.apply(puzzle)

    expect(second).toBeNull()
  })
})

describe('slither strong inference rule', () => {
  const colorAssumptionRule = slitherRules.find((rule) => rule.id === 'color-assumption-inference')
  if (!colorAssumptionRule) {
    throw new Error('Expected color-assumption-inference rule')
  }
  const strongRule = slitherRules.find((rule) => rule.id === 'strong-inference')
  if (!strongRule) {
    throw new Error('Expected strong-inference rule')
  }

  it('places color assumption inference before strong inference', () => {
    const colorAssumptionIdx = slitherRules.findIndex((rule) => rule.id === 'color-assumption-inference')
    const strongIdx = slitherRules.findIndex((rule) => rule.id === 'strong-inference')
    expect(colorAssumptionIdx).toBe(strongIdx - 1)
  })

  it('is placed at the end of slitherRules', () => {
    expect(slitherRules[slitherRules.length - 1]?.id).toBe('strong-inference')
  })

  it('uses direct color-edge contradiction to force the opposite color', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    const shared = edgeKey([0, 1], [1, 1])
    puzzle.edges[shared].mark = 'line'

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'yellow' }])
    expect(result?.message).toContain('result=contradiction')
    expect(result?.message).toContain('green fails')
  })

  it('uses boundary color contradiction to force the opposite color', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'line'

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' }])
    expect(result?.message).toContain('yellow fails')
  })

  it('uses deterministic downstream propagation to find a contradiction', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    const shared = edgeKey([0, 1], [1, 1])
    const downstreamRule: Rule = {
      id: 'downstream-color-test',
      name: 'Downstream Color Test',
      apply: (trial) => {
        if (trial.cells[cellKey(0, 1)]?.fill !== 'green') {
          return null
        }
        if ((trial.edges[shared]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        return {
          message: 'test downstream edge consequence',
          diffs: [{ kind: 'edge', edgeKey: shared, from: 'unknown', to: 'line' }],
          affectedCells: [cellKey(0, 1)],
        }
      },
    }
    const downstreamColorAssumptionRule = createColorAssumptionInferenceRule(() => [downstreamRule])

    const result = downstreamColorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'yellow' }])
    expect(result?.message).toContain('green fails')
  })

  it('treats unreachable fixed green regions as a contradiction', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' }])
    expect(result?.message).toContain('yellow fails')
  })

  it('returns null when both color branches remain feasible', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('uses contradiction on onlyOne sector branches to force opposite assignment', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [2, 0])].mark = 'blank'

    const result = strongRule.apply(puzzle)

    expect(result).not.toBeNull()
    const bottom = edgeKey([1, 0], [1, 1])
    const right = edgeKey([0, 1], [1, 1])
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
    ])
    expect(result?.affectedSectors).toEqual([sectorKey(0, 0, 'se')])
    expect(result?.message).toContain('candidate=sector-only-one')
    expect(result?.message).toContain('result=contradiction')
  })

  it('returns null when both onlyOne branches remain feasible', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = strongRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('supports vertex-two-choice contradiction on a boundary vertex', () => {
    const directStrongRule = createStrongInferenceRule(() => [])
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 1)

    const up = edgeKey([0, 0], [1, 0])
    const down = edgeKey([1, 0], [2, 0])
    const right = edgeKey([1, 0], [1, 1])
    puzzle.edges[right].mark = 'line'

    const result = directStrongRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: up, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: down, from: 'unknown', to: 'line' },
    ])
    expect(result?.message).toContain('candidate=vertex-two-choice((1, 0))')
    expect(result?.message).toContain('result=contradiction')
  })

  it('extracts shared consequences when both feasible branches agree downstream', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const sector = sectorKey(0, 0, 'se')
    puzzle.sectors[sector].constraintsMask = SECTOR_MASK_ONLY_1

    const [bottom, right] = getCornerEdgeKeys(0, 0, 'se')
    const top = edgeKey([0, 0], [0, 1])
    const sharedConsequenceRule: Rule = {
      id: 'shared-consequence-test',
      name: 'Shared Consequence Test',
      apply: (trial) => {
        if ((trial.edges[top]?.mark ?? 'unknown') !== 'unknown') {
          return null
        }
        const bottomMark = trial.edges[bottom]?.mark ?? 'unknown'
        const rightMark = trial.edges[right]?.mark ?? 'unknown'
        if (bottomMark !== 'line' && rightMark !== 'line') {
          return null
        }
        return {
          message: 'test shared consequence',
          diffs: [{ kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' }],
          affectedCells: [cellKey(0, 0)],
        }
      },
    }
    const sharedStrongRule = createStrongInferenceRule(() => [sharedConsequenceRule])

    const result = sharedStrongRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' }])
    expect(result?.message).toContain('candidate=sector-only-one')
    expect(result?.message).toContain('result=shared-consequence')
  })

  it('can run on the provided 10x10 puzzle after deterministic stabilization', () => {
    const rulesWithoutStrong = slitherRules.filter((rule) => rule.id !== 'strong-inference')
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/c3ch08c0d22aodh1bgdbjbag3dhdo12c3a52ah3b0',
    )

    for (let stepNumber = 1; stepNumber <= 400; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, rulesWithoutStrong, stepNumber)
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    expect(() => strongRule.apply(current)).not.toThrow()
    const result = strongRule.apply(current)
    expect(result === null || result.diffs.length > 0).toBe(true)
  })

  it('can color the provided 18x10 stuck puzzle after deterministic stabilization', () => {
    const rulesBeforeColorAssumption = slitherRules.filter(
      (rule) => rule.id !== 'color-assumption-inference' && rule.id !== 'strong-inference',
    )
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/18/10/l12cg261b353didb1bbg112dgb2bbci161b3dgbhapchcg3c161dicb2bbg111cga2bbbi271c161bg31cj',
    )

    for (let stepNumber = 1; stepNumber <= 2000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, rulesBeforeColorAssumption, stepNumber)
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    const result = colorAssumptionRule.apply(current)
    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([{ kind: 'cell', cellKey: cellKey(2, 12), fromFill: null, toFill: 'green' }])

    const targetBranch = clonePuzzle(current)
    targetBranch.cells[cellKey(7, 0)] = {
      ...(targetBranch.cells[cellKey(7, 0)] ?? {}),
      fill: 'yellow',
    }
    const targetResult = runTrialUntilFixpoint(targetBranch, rulesBeforeColorAssumption, 120, Date.now() + 2000)
    expect(targetResult.contradiction).toBe(true)
  })

  it('keeps the provided 6x100 target edge covered after deterministic stabilization', () => {
    const rulesWithoutStrong = slitherRules.filter((rule) => rule.id !== 'strong-inference')
    const target = edgeKey([23, 0], [24, 0])
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/6/100/h1dgdabdg3bgdddbg2cgcddag0bgdcbag0bgdbcdg1cgbdddg1bgbdddg2dgaadbg1cgaddbg0bgdbacg1bgadccg3cgaacdg2cgbbadg3agbbbag3cgdcddg2bgcddag2bgaabdg2bgdbdag3bgcdbcg2cgdddbg2cgdddag2bgddcag2bgcdaag3bgdddcg2cgcaddg2bgabddg1bgdadcg3bgbdcdg1bgddddg1dgdbbdg3agbbdag1dgbdddg2agadddg1d',
    )

    for (let stepNumber = 1; stepNumber <= 2000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(current, rulesWithoutStrong, stepNumber)
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    expect(current.edges[target]?.mark ?? 'unknown').toBe('blank')
  })
})
