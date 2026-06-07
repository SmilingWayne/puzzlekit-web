import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey, getCellEdgeKeys } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import { slitherRules } from '../rules'
import { setClue, getEdgeDiffKeys } from './testUtils'

describe('slither cell clue completion rule', () => {
  const cellCountRule = slitherRules.find(
    (rule) => rule.id === 'cell-count-completion',
  )
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

describe('slither prevent premature loop rule', () => {
  const antiLoopRule = slitherRules.find(
    (rule) => rule.id === 'prevent-premature-loop',
  )
  if (!antiLoopRule) {
    throw new Error('Expected prevent-premature-loop rule')
  }

  it('is ordered after vertex-degree, exact sector edge propagation, coloring, and clue-propagation', () => {
    const vertexRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'vertex-degree',
    )
    const sectorEdgeRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'sector-constraint-edge-propagation',
    )
    const outsideRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-outside-seeding',
    )
    const colorRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-edge-propagation',
    )
    const clueRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-clue-propagation',
    )
    const sectorColorRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-sector-mask-propagation',
    )
    const orthogonalConsensusRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-orthogonal-consensus-propagation',
    )
    const reachabilityRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'inside-reachability-coloring',
    )
    const outsideReachabilityRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'outside-reachability-coloring',
    )
    const cutColorRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-connectivity-cut-coloring',
    )
    const antiLoopRuleIdx = slitherRules.findIndex(
      (rule) => rule.id === 'prevent-premature-loop',
    )
    expect(vertexRuleIdx).toBeGreaterThanOrEqual(0)
    expect(sectorEdgeRuleIdx).toBe(vertexRuleIdx + 1)
    expect(outsideRuleIdx).toBe(sectorEdgeRuleIdx + 1)
    expect(colorRuleIdx).toBe(outsideRuleIdx + 1)
    expect(clueRuleIdx).toBe(colorRuleIdx + 1)
    expect(sectorColorRuleIdx).toBe(clueRuleIdx + 1)
    expect(orthogonalConsensusRuleIdx).toBe(sectorColorRuleIdx + 1)
    expect(reachabilityRuleIdx).toBe(orthogonalConsensusRuleIdx + 1)
    expect(outsideReachabilityRuleIdx).toBe(reachabilityRuleIdx + 1)
    expect(cutColorRuleIdx).toBe(outsideReachabilityRuleIdx + 1)
    expect(antiLoopRuleIdx).toBe(cutColorRuleIdx + 1)
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
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: closing, from: 'unknown', to: 'blank' },
    ])
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
    expect(getEdgeDiffKeys(result)).toEqual([
      topLeftClosing,
      bottomRightClosing,
    ])
    expect(
      result?.diffs.every(
        (d) => d.kind === 'edge' && d.from === 'unknown' && d.to === 'blank',
      ),
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
