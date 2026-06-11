import { describe, expect, it } from 'vitest'
import {
  cellKey,
  edgeKey,
  getCornerEdgeKeys,
  sectorKey,
} from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import { SECTOR_MASK_NOT_1 } from '../../../ir/types'
import type { Rule } from '../../types'
import { slitherRules } from '../rules'
import { createSectorParityInferenceRule } from '../rules/sectorParityInference'
import { setClue } from './testUtils'

describe('slither sector parity inference rule', () => {
  const sectorParityRule = slitherRules.find(
    (rule) => rule.id === 'sector-parity-inference',
  )
  if (!sectorParityRule) {
    throw new Error('Expected sector-parity-inference rule')
  }

  it('places sector parity inference after color assumption and before strong inference', () => {
    const colorAssumptionIdx = slitherRules.findIndex(
      (rule) => rule.id === 'color-assumption-inference',
    )
    const sectorParityIdx = slitherRules.findIndex(
      (rule) => rule.id === 'sector-parity-inference',
    )
    const strongIdx = slitherRules.findIndex(
      (rule) => rule.id === 'strong-inference',
    )

    expect(colorAssumptionIdx).toBeGreaterThanOrEqual(0)
    expect(sectorParityIdx).toBe(colorAssumptionIdx + 1)
    expect(strongIdx).toBe(sectorParityIdx + 1)
  })

  it('forces both notOne sector edges blank when the both-line branch creates a closed subloop', () => {
    const directSectorParityRule = createSectorParityInferenceRule(() => [])
    const puzzle = createSlitherPuzzle(2, 2)
    const targetSector = sectorKey(0, 0, 'se')
    puzzle.sectors[targetSector].constraintsMask = SECTOR_MASK_NOT_1
    const [bottom, right] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([2, 1], [2, 2])].mark = 'line'

    const result = directSectorParityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
    ])
    expect(result?.affectedSectors).toEqual([targetSector])
    expect(result?.message).toContain('cannot have exactly one line')
    expect(result?.message).toContain('contradicts the puzzle')
  })

  it('forces both notOne sector edges line when the both-blank branch violates a clue', () => {
    const directSectorParityRule = createSectorParityInferenceRule(() => [])
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 2)
    const targetSector = sectorKey(0, 0, 'se')
    puzzle.sectors[targetSector].constraintsMask = SECTOR_MASK_NOT_1
    const [bottom, right] = getCornerEdgeKeys(0, 0, 'se')
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'blank'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'blank'

    const result = directSectorParityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
    ])
    expect(result?.affectedSectors).toEqual([targetSector])
    expect(result?.message).toContain('contradicts the puzzle')
  })

  it('forces a sector parity branch when the opposite branch contradicts and the survivor reaches the probe budget', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    setClue(puzzle, 0, 0, 2)
    const targetSector = sectorKey(0, 0, 'nw')
    puzzle.sectors[targetSector].constraintsMask = SECTOR_MASK_NOT_1
    const [top, left] = getCornerEdgeKeys(0, 0, 'nw')
    const bottom = edgeKey([1, 0], [1, 1])
    const right = edgeKey([0, 1], [1, 1])
    const stallRule: Rule = {
      id: 'sector-parity-stall-test',
      name: 'Sector Parity Stall Test',
      apply: (trial) => {
        const topMark = trial.edges[top]?.mark ?? 'unknown'
        const leftMark = trial.edges[left]?.mark ?? 'unknown'
        if (topMark === 'blank' && leftMark === 'blank') {
          return {
            message: 'make blank branch contradict the clue',
            diffs: [
              { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
              { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
            ],
            affectedCells: [cellKey(0, 0)],
          }
        }
        if (topMark !== 'line' || leftMark !== 'line') {
          return null
        }
        return {
          message: 'keep line branch unresolved',
          diffs: [
            {
              kind: 'sector',
              sectorKey: targetSector,
              fromMask: trial.sectors[targetSector].constraintsMask,
              toMask: trial.sectors[targetSector].constraintsMask,
            },
          ],
          affectedCells: [cellKey(0, 0)],
          affectedSectors: [targetSector],
        }
      },
    }
    const probingSectorParityRule = createSectorParityInferenceRule(
      () => [stallRule],
      {
        maxMs: Number.POSITIVE_INFINITY,
        maxTrialSteps: 24,
      },
    )

    const result = probingSectorParityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'line' },
    ])
    expect(result?.message).toContain('probe budget 24')
    expect(result?.message).toContain('line branch unresolved after 24 steps')
    expect(result?.message).toContain('blank branch contradicted after 1 step')
    expect(result?.inferenceDetails).toMatchObject({
      kind: 'slither-sector-parity',
      defaultBranchId: 'blank',
    })
    expect(result?.inferenceDetails?.branches).toHaveLength(2)
  })

  it('checks later sector parity candidates at the first probe budget', () => {
    const puzzle = createSlitherPuzzle(2, 1)
    const firstSector = sectorKey(0, 0, 'nw')
    const secondSector = sectorKey(1, 0, 'nw')
    puzzle.sectors[firstSector].constraintsMask = SECTOR_MASK_NOT_1
    puzzle.sectors[secondSector].constraintsMask = SECTOR_MASK_NOT_1
    setClue(puzzle, 1, 0, 2)
    const bottom = edgeKey([2, 0], [2, 1])
    const right = edgeKey([1, 1], [2, 1])
    const [firstA, firstB] = getCornerEdgeKeys(0, 0, 'nw')
    const [secondA, secondB] = getCornerEdgeKeys(1, 0, 'nw')
    const stallRule: Rule = {
      id: 'sector-parity-first-candidate-stall-test',
      name: 'Sector Parity First Candidate Stall Test',
      apply: (trial) => {
        if (
          (trial.edges[secondA]?.mark ?? 'unknown') === 'blank' &&
          (trial.edges[secondB]?.mark ?? 'unknown') === 'blank'
        ) {
          return {
            message: 'make second blank branch contradict the clue',
            diffs: [
              { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
              { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
            ],
            affectedCells: [cellKey(1, 0)],
          }
        }
        if ((trial.edges[firstA]?.mark ?? 'unknown') === 'unknown') {
          return null
        }
        if ((trial.edges[firstB]?.mark ?? 'unknown') === 'unknown') {
          return null
        }
        return {
          message: 'keep first candidate unresolved',
          diffs: [
            {
              kind: 'sector',
              sectorKey: firstSector,
              fromMask: trial.sectors[firstSector].constraintsMask,
              toMask: trial.sectors[firstSector].constraintsMask,
            },
          ],
          affectedCells: [cellKey(0, 0)],
          affectedSectors: [firstSector],
        }
      },
    }
    const probingSectorParityRule = createSectorParityInferenceRule(
      () => [stallRule],
      {
        maxMs: Number.POSITIVE_INFINITY,
        maxTrialSteps: 24,
      },
    )

    const result = probingSectorParityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: secondA, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: secondB, from: 'unknown', to: 'line' },
    ])
    expect(result?.affectedSectors).toEqual([secondSector])
    expect(result?.message).toContain('probe budget 24')
  })

  it('returns null when both notOne parity branches remain feasible', () => {
    const directSectorParityRule = createSectorParityInferenceRule(() => [])
    const puzzle = createSlitherPuzzle(2, 2)
    puzzle.sectors[sectorKey(0, 0, 'se')].constraintsMask = SECTOR_MASK_NOT_1

    const result = directSectorParityRule.apply(puzzle)

    expect(result).toBeNull()
  })
})
