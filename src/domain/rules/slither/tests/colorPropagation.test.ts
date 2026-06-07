import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey, sectorKey } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
} from '../../../ir/types'
import { slitherRules } from '../rules'
import { setClue } from './testUtils'

describe('slither color-edge propagation rule', () => {
  const colorRule = slitherRules.find(
    (rule) => rule.id === 'color-edge-propagation',
  )
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

  it('marks top boundary edge line when the boundary cell is green', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    const top = edgeKey([0, 1], [0, 2])

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: top,
      from: 'unknown',
      to: 'line',
    })
  })

  it('marks both outer boundary edges line when a corner cell is green', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    const top = edgeKey([0, 0], [0, 1])
    const left = edgeKey([0, 0], [1, 0])

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
        { kind: 'edge', edgeKey: left, from: 'unknown', to: 'line' },
      ]),
    )
  })

  it('marks boundary edges blank when the boundary cell is yellow', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'yellow' }
    const top = edgeKey([0, 0], [0, 1])
    const left = edgeKey([0, 0], [1, 0])

    const result = colorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual(
      expect.arrayContaining([
        { kind: 'edge', edgeKey: top, from: 'unknown', to: 'blank' },
        { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
      ]),
    )
  })

  it('does not emit a phantom cell diff across an already decided boundary edge', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const top = edgeKey([0, 0], [0, 1])
    puzzle.edges[top].mark = 'line'
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = colorRule.apply(puzzle)

    expect(
      result?.diffs.some(
        (diff) => diff.kind === 'cell' && diff.cellKey === undefined,
      ),
    ).not.toBe(true)
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
  const outsideRule = slitherRules.find(
    (rule) => rule.id === 'color-outside-seeding',
  )
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
        {
          kind: 'cell',
          cellKey: cellKey(0, 0),
          fromFill: null,
          toFill: 'yellow',
        },
        {
          kind: 'cell',
          cellKey: cellKey(0, 1),
          fromFill: null,
          toFill: 'green',
        },
        {
          kind: 'cell',
          cellKey: cellKey(0, 2),
          fromFill: null,
          toFill: 'green',
        },
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
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
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
        {
          kind: 'cell',
          cellKey: cellKey(0, 0),
          fromFill: null,
          toFill: 'yellow',
        },
        {
          kind: 'cell',
          cellKey: cellKey(1, 1),
          fromFill: null,
          toFill: 'green',
        },
      ]),
    )
  })
})

describe('slither color clue propagation rule', () => {
  const clueColorRule = slitherRules.find(
    (rule) => rule.id === 'color-clue-propagation',
  )
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
    puzzle.cells[cellKey(1, 1)] = {
      ...puzzle.cells[cellKey(1, 1)],
      fill: 'yellow',
    }
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

  it('propagates green neighbors from two yellow neighbors around a clue 2 without needing the clue cell color', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'yellow' }

    const result = clueColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(2, 1),
      fromFill: null,
      toFill: 'green',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 2),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('propagates yellow neighbors from two green neighbors around a clue 2 without needing the clue cell color', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }

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
      cellKey: cellKey(1, 2),
      fromFill: null,
      toFill: 'yellow',
    })
  })

  it('counts out-of-bounds directions as yellow when propagating from a corner clue 2', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)

    const result = clueColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(1, 0),
      fromFill: null,
      toFill: 'green',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('counts out-of-bounds directions as yellow when coloring a corner numbered cell', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 1)
    puzzle.cells[cellKey(1, 0)] = { fill: 'yellow' }
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }

    const result = clueColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 0),
      fromFill: null,
      toFill: 'green',
    })
  })
})

describe('slither color orthogonal consensus propagation rule', () => {
  const orthogonalColorRule = slitherRules.find(
    (rule) => rule.id === 'color-orthogonal-consensus-propagation',
  )
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

describe('slither color sector-mask propagation rule', () => {
  const sectorColorRule = slitherRules.find(
    (rule) => rule.id === 'color-sector-mask-propagation',
  )
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
    onlyZeroPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
      SECTOR_MASK_ONLY_0
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
    onlyTwoPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
      SECTOR_MASK_ONLY_2
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

  it('infers onlyOne sectors from different diagonal-adjacent colors', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'yellow' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'se'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'nw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('infers notOne sectors from same diagonal-adjacent colors', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'se'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_1,
    })
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'nw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_NOT_1,
    })
  })

  it('uses out-of-bounds yellow for color-to-sector propagation at the boundary', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'ne'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
    expect(result?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(-1, 1, 'sw'),
      fromMask: SECTOR_MASK_ALL,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('does not emit redundant or invalid color-to-sector updates for the target sectors', () => {
    const compatiblePuzzle = createSlitherPuzzle(3, 3)
    compatiblePuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
      SECTOR_MASK_ONLY_1
    compatiblePuzzle.sectors[sectorKey(2, 2, 'nw')].constraintsMask =
      SECTOR_MASK_ONLY_1
    compatiblePuzzle.cells[cellKey(1, 2)] = { fill: 'green' }
    compatiblePuzzle.cells[cellKey(2, 1)] = { fill: 'yellow' }

    const compatibleResult = sectorColorRule.apply(compatiblePuzzle)

    expect(compatibleResult?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'se'),
      fromMask: SECTOR_MASK_ONLY_1,
      toMask: SECTOR_MASK_ONLY_1,
    })
    expect(compatibleResult?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(2, 2, 'nw'),
      fromMask: SECTOR_MASK_ONLY_1,
      toMask: SECTOR_MASK_ONLY_1,
    })

    const invalidPuzzle = createSlitherPuzzle(3, 3)
    invalidPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
      SECTOR_MASK_NOT_1
    invalidPuzzle.sectors[sectorKey(2, 2, 'nw')].constraintsMask =
      SECTOR_MASK_NOT_1
    invalidPuzzle.cells[cellKey(1, 2)] = { fill: 'green' }
    invalidPuzzle.cells[cellKey(2, 1)] = { fill: 'yellow' }

    const invalidResult = sectorColorRule.apply(invalidPuzzle)

    expect(invalidResult?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'se'),
      fromMask: SECTOR_MASK_NOT_1,
      toMask: SECTOR_MASK_ONLY_1,
    })
    expect(invalidResult?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(2, 2, 'nw'),
      fromMask: SECTOR_MASK_NOT_1,
      toMask: SECTOR_MASK_ONLY_1,
    })
  })

  it('does not apply when both adjacent cells are unknown and in bounds', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask = SECTOR_MASK_NOT_1

    const result = sectorColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('skips conflicting color-to-sector inference without reporting an invalid mask', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }

    const result = sectorColorRule.apply(puzzle)

    expect(result?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(0, 0, 'se'),
      fromMask: SECTOR_MASK_ONLY_1,
      toMask: SECTOR_MASK_NOT_1,
    })
    expect(result?.diffs).not.toContainEqual({
      kind: 'sector',
      sectorKey: sectorKey(1, 1, 'nw'),
      fromMask: SECTOR_MASK_ONLY_1,
      toMask: SECTOR_MASK_NOT_1,
    })
  })
})
