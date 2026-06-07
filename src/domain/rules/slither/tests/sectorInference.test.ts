import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../../parsers/puzzlink'
import { cellKey, edgeKey, sectorKey } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
} from '../../../ir/types'
import { slitherRules } from '../rules'
import { setClue } from './testUtils'

describe('slither apply sectors rule', () => {
  const applySectorsRule = slitherRules.find(
    (rule) => rule.id === 'sector-inference',
  )
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
    expect(result?.message).toContain('narrow the allowed corner line counts')
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
    const puzzle = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/4/4/183aibi',
    )
    expect(puzzle.cells[cellKey(0, 3)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })

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
    expect(
      result?.diffs.some(
        (d) => d.kind === 'sector' && d.sectorKey === targetSector,
      ),
    ).toBe(false)
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
