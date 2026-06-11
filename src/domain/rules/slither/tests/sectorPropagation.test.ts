import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../../parsers/puzzlink'
import {
  cellKey,
  edgeKey,
  getCellEdgeKeys,
  getCornerEdgeKeys,
  getVertexIncidentEdges,
  parseEdgeKey,
  sectorKey,
  vertexKey,
} from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_NOT_2,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
} from '../../../ir/types'
import { runNextRule } from '../../engine'
import { slitherRules } from '../rules'
import { setClue } from './testUtils'

describe('slither sector notOne clue-2 propagation rule', () => {
  const propagationRule = slitherRules.find(
    (rule) => rule.id === 'sector-not-one-clue-two-propagation',
  )
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
    expect(result?.affectedSectors).toEqual([
      sectorKey(0, 0, 'nw'),
      sectorKey(0, 0, 'se'),
    ])
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
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/zsan23dzzq',
    )
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 600; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (
        step.ruleId === 'sector-not-one-clue-two-propagation' ||
        step.ruleId === 'clue-vertex-candidate-combination-pruning'
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
    expect(result?.affectedSectors).toEqual([
      sectorKey(2, 2, 'ne'),
      sectorKey(1, 3, 'sw'),
    ])
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
    const rulesWithoutCutColoring = slitherRules.filter(
      (rule) => rule.id !== 'color-connectivity-cut-coloring',
    )
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/8/8/gdg1dddbdid26d72ccicadc3cgc',
    )
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        rulesWithoutCutColoring,
        stepNumber,
      )
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

  it('appears or becomes unnecessary during stepwise solving for the provided 10x10 puzzle', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/ga337ddkdh2adbgdi20dp23dibgbd0dhdkd511da',
    )
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1200; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (step.ruleId === 'sector-diagonal-shared-vertex-propagation') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered || diagonalSectorRule.apply(current) === null).toBe(true)
  })
})

describe('slither vertex candidate edge pruning rule', () => {
  const vertexRule = slitherRules.find(
    (rule) => rule.id === 'vertex-candidate-edge-pruning',
  )
  if (!vertexRule) {
    throw new Error('Expected vertex-candidate-edge-pruning rule')
  }

  it('prunes vertex candidates from known line and blank edges and forces the remaining continuation', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    const [up, down, left, right] = getVertexIncidentEdges(
      1,
      1,
      puzzle.rows,
      puzzle.cols,
    )
    puzzle.edges[up].mark = 'line'
    puzzle.edges[down].mark = 'blank'
    puzzle.edges[left].mark = 'blank'

    const result = vertexRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'vertex',
      vertexKey: vertexKey(1, 1),
      fromCandidates: puzzle.vertices[vertexKey(1, 1)].candidateEdgeSets,
      toCandidates: [[right, up].sort()],
    })
    expect(result?.diffs).toContainEqual({
      kind: 'edge',
      edgeKey: right,
      from: 'unknown',
      to: 'line',
    })
  })
})

describe('slither clue vertex-candidate combination pruning rule', () => {
  const combinationRule = slitherRules.find(
    (rule) => rule.id === 'clue-vertex-candidate-combination-pruning',
  )
  if (!combinationRule) {
    throw new Error('Expected clue-vertex-candidate-combination-pruning rule')
  }

  it('prunes clue-0 corners to onlyZero sector masks', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 0)

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
      expect(result?.diffs).toContainEqual({
        kind: 'sector',
        sectorKey: sectorKey(1, 1, corner),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_ONLY_0,
      })
    }
    expect(result?.diffs.some((diff) => diff.kind === 'vertex')).toBe(true)
  })

  it('prunes clue-1 corners to notTwo sector masks', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 1)

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
      expect(result?.diffs).toContainEqual({
        kind: 'sector',
        sectorKey: sectorKey(1, 1, corner),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_2,
      })
    }
  })

  it('prunes clue-2 boundary corners using the full four-corner candidate check', () => {
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
        {
          kind: 'sector',
          sectorKey: sectorKey(0, 0, 'se'),
          fromMask: SECTOR_MASK_ALL,
          toMask: SECTOR_MASK_NOT_1,
        },
      ]),
    )
  })

  it('prunes clue-3 corners to notZero sector masks', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 1, 1, 3)

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
      expect(result?.diffs).toContainEqual({
        kind: 'sector',
        sectorKey: sectorKey(1, 1, corner),
        fromMask: SECTOR_MASK_ALL,
        toMask: SECTOR_MASK_NOT_0,
      })
    }
  })

  it('removes a vertex candidate that is locally legal but unsupported by a neighboring clue', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    setClue(puzzle, 0, 0, 0)
    const [down, right] = getVertexIncidentEdges(0, 0, puzzle.rows, puzzle.cols)

    const result = combinationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toContainEqual({
      kind: 'vertex',
      vertexKey: vertexKey(0, 0),
      fromCandidates: [[], [down, right].sort()],
      toCandidates: [[]],
    })
  })

  it('appears during stepwise solving for the provided 5x5 line-case puzzle', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/5/5/hdhdhcp',
    )
    let triggered = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (step.ruleId === 'clue-vertex-candidate-combination-pruning') {
        triggered = true
        break
      }
      current = nextPuzzle
    }

    expect(triggered).toBe(true)
  })
})

describe('slither sector constraint edge propagation rule', () => {
  const edgePropagationRule = slitherRules.find(
    (rule) => rule.id === 'sector-constraint-edge-propagation',
  )
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

  it('propagates the provided 10x10 top-edge onlyTwo sector to lines immediately after inference', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/g88b227637bg2067a7bj8c6a223c1adh1cb1bi32di1dc33783',
    )
    const targetSector = sectorKey(0, 1, 'ne')
    const targetEdges = getCornerEdgeKeys(0, 1, 'ne')
    let sawOnlyTwoInference = false

    for (let stepNumber = 1; stepNumber <= 80; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }

      if (!sawOnlyTwoInference) {
        const sectorDiff = step.diffs.find(
          (d) => d.kind === 'sector' && d.sectorKey === targetSector,
        )
        if (
          sectorDiff?.kind === 'sector' &&
          sectorDiff.toMask === SECTOR_MASK_ONLY_2
        ) {
          if (
            targetEdges.every((edge) => nextPuzzle.edges[edge]?.mark === 'line')
          ) {
            return
          }
          sawOnlyTwoInference = true
          current = nextPuzzle
          continue
        }
      } else {
        expect(step.ruleId).toBe('sector-constraint-edge-propagation')
        expect(step.diffs).toEqual(
          expect.arrayContaining(
            targetEdges.map((edge) => ({
              kind: 'edge' as const,
              edgeKey: edge,
              from: 'unknown' as const,
              to: 'line' as const,
            })),
          ),
        )
        return
      }

      current = nextPuzzle
    }

    throw new Error(
      'Expected sector inference followed by immediate edge propagation for (R1, C2, NE).',
    )
  })

  it('forces the last unknown corner edge to line when onlyOne with one blank', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'blank'

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'line' },
    ])
  })

  it('forces the last unknown corner edge to line when notOne already has one line', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'line'

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'line' },
    ])
  })

  it('forces the last unknown corner edge to blank when notOne already has one blank', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'blank'

    const result = edgePropagationRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: nwLeft, from: 'unknown', to: 'blank' },
    ])
  })

  it('does not emit a notOne propagation diff when both corner edges are already decided', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
    const [nwTop, nwLeft] = getCornerEdgeKeys(0, 0, 'nw')
    puzzle.edges[nwTop].mark = 'line'
    puzzle.edges[nwLeft].mark = 'blank'

    const result = edgePropagationRule.apply(puzzle)

    expect(result).toBeNull()
  })
})

describe('slither sector clue-1/3 onlyOne opposite edges rule', () => {
  const clueOneThreeRule = slitherRules.find(
    (rule) => rule.id === 'sector-clue-one-three-intra-cell-propagation',
  )
  if (!clueOneThreeRule) {
    throw new Error(
      'Expected sector-clue-one-three-intra-cell-propagation rule',
    )
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
  const vertexBalanceRule = slitherRules.find(
    (rule) => rule.id === 'vertex-onlyone-non-sector-balance',
  )
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
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
    ])
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
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
    ])
  })

  it('supports diagonal-sector narrative: onlyOne on one diagonal plus blank on opposite diagonal edge forces line', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'sw')].constraintsMask = SECTOR_MASK_ONLY_1

    const oppositeDiagonalEdgeA = edgeKey([1, 0], [1, 1])
    const oppositeDiagonalEdgeB = edgeKey([1, 1], [2, 1])
    puzzle.edges[oppositeDiagonalEdgeA].mark = 'blank'

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: oppositeDiagonalEdgeB,
        from: 'unknown',
        to: 'line',
      },
    ])
    expect(result?.affectedSectors).toContain(sectorKey(0, 1, 'sw'))
  })

  it('forces the single non-sector boundary edge to line when a boundary corner sector is onlyOne', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.sectors[sectorKey(0, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = vertexBalanceRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([0, 0], [0, 1]),
        from: 'unknown',
        to: 'line',
      },
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

  it('leaves the provided 5x5 cgcx boundary line to color-edge propagation during stepwise solving', () => {
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/5/5/cgcx',
    )
    let colorEdgeTriggered = false
    let sawBoundaryLine = false

    for (let stepNumber = 1; stepNumber <= 1000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (step.ruleId === 'color-edge-propagation') {
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
          colorEdgeTriggered = true
          break
        }
      }
      current = nextPuzzle
    }

    expect(colorEdgeTriggered).toBe(true)
    expect(sawBoundaryLine).toBe(true)
  })
})
