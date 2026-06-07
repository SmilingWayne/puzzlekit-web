import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../../parsers/puzzlink'
import {
  cellKey,
  edgeKey,
  getCornerEdgeKeys,
  sectorKey,
  vertexKey,
} from '../../../ir/keys'
import { clonePuzzle } from '../../../ir/normalize'
import { createSlitherPuzzle } from '../../../ir/slither'
import { SECTOR_MASK_ONLY_1 } from '../../../ir/types'
import { applyRuleDiffs, runNextRule } from '../../engine'
import type { Rule } from '../../types'
import { slitherRules } from '../rules'
import { createColorAssumptionInferenceRule } from '../rules/colorAssumptionInference'
import { createStrongInferenceRule } from '../rules/strongInference'
import {
  findHardContradictionReason,
  runTrialUntilFixpoint,
} from '../rules/trial'
import { setClue } from './testUtils'

describe('slither inference branch details', () => {
  it('records the provided strong inference branch trace without changing the formal conclusion', () => {
    const url =
      'https://puzz.link/p?slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo'
    let puzzle = decodeSlitherFromPuzzlink(url)
    let targetStep: ReturnType<typeof runNextRule>['step'] = null

    for (let stepNumber = 1; stepNumber <= 3; stepNumber += 1) {
      const result = runNextRule(puzzle, slitherRules, stepNumber)
      puzzle = result.nextPuzzle
      targetStep = result.step
    }

    expect(targetStep?.ruleId).toBe('strong-inference')
    expect(targetStep?.diffs).toEqual([
      {
        kind: 'edge',
        edgeKey: edgeKey([1, 2], [1, 3]),
        from: 'unknown',
        to: 'blank',
      },
    ])
    expect(targetStep?.inferenceDetails?.defaultBranchId).toBe('a')
    const failingBranch = targetStep?.inferenceDetails?.branches[0]
    expect(failingBranch).toMatchObject({
      status: 'contradiction',
      initialDiffs: [
        {
          kind: 'edge',
          edgeKey: edgeKey([1, 2], [1, 3]),
          from: 'unknown',
          to: 'line',
        },
      ],
    })
    expect(failingBranch?.traceSteps).toHaveLength(9)
    expect(failingBranch?.contradiction).toMatchObject({
      kind: 'vertex-degree',
      vertices: [vertexKey(5, 3)],
    })

    let rebuilt = applyRuleDiffs(
      targetStep?.inferenceDetails?.basePuzzle ?? puzzle,
      failingBranch?.initialDiffs ?? [],
    )
    for (const traceStep of failingBranch?.traceSteps ?? []) {
      rebuilt = applyRuleDiffs(rebuilt, traceStep.diffs)
    }
    expect(findHardContradictionReason(rebuilt)?.kind).toBe('vertex-degree')
  })
})

describe('slither strong inference rule', () => {
  const colorAssumptionRule = slitherRules.find(
    (rule) => rule.id === 'color-assumption-inference',
  )
  if (!colorAssumptionRule) {
    throw new Error('Expected color-assumption-inference rule')
  }
  const unboundedColorAssumptionRule = createColorAssumptionInferenceRule(
    () =>
      slitherRules.filter(
        (rule) =>
          rule.id !== 'color-assumption-inference' &&
          rule.id !== 'sector-parity-inference' &&
          rule.id !== 'strong-inference',
      ),
    { maxMs: Number.POSITIVE_INFINITY },
  )
  const strongRule = slitherRules.find((rule) => rule.id === 'strong-inference')
  if (!strongRule) {
    throw new Error('Expected strong-inference rule')
  }
  const unboundedStrongRule = createStrongInferenceRule(
    () =>
      slitherRules.filter(
        (rule) =>
          rule.id !== 'color-assumption-inference' &&
          rule.id !== 'sector-parity-inference' &&
          rule.id !== 'strong-inference',
      ),
    { maxMs: Number.POSITIVE_INFINITY },
  )

  it('places color assumption inference before strong inference', () => {
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
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
    expect(result?.message).toContain('contradiction')
    expect(result?.message).toContain('color-edge contradiction')
    expect(result?.message).toContain('edge V(0, 1)-V(1, 1)')
    expect(result?.message).toContain('0 trial steps')
    expect(result?.message).toContain('Searched 1 candidate')
    expect(result?.message).toContain('is green')
    expect(result?.inferenceDetails).toMatchObject({
      kind: 'slither-color-assumption',
      defaultBranchId: 'green',
    })
    expect(result?.inferenceDetails?.branches).toHaveLength(2)
  })

  it('compresses same-color candidate components before searching', () => {
    const puzzle = createSlitherPuzzle(1, 4)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 3)] = { fill: 'yellow' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
    expect(result?.message).toContain('from 2 candidate cells')
    expect(result?.message).toContain('compressed to 1 component')
  })

  it('compresses opposite-color candidate components connected by a line edge', () => {
    const puzzle = createSlitherPuzzle(1, 4)
    puzzle.cells[cellKey(0, 0)] = { fill: 'yellow' }
    puzzle.cells[cellKey(0, 3)] = { fill: 'yellow' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'line'

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('from 2 candidate cells')
    expect(result?.message).toContain('compressed to 1 component')
  })

  it('keeps the highest-scored representative within a compressed component', () => {
    const puzzle = createSlitherPuzzle(1, 4)
    puzzle.cells[cellKey(0, 0)] = { fill: 'yellow' }
    puzzle.cells[cellKey(0, 3)] = { fill: 'yellow' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'
    puzzle.edges[edgeKey([0, 3], [1, 3])].mark = 'line'
    puzzle.sectors[sectorKey(0, 2, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('from 2 candidate cells')
    expect(result?.message).toContain('compressed to 1 component')
  })

  it('uses boundary color contradiction to force the opposite color', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'line'

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('is yellow')
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
          diffs: [
            { kind: 'edge', edgeKey: shared, from: 'unknown', to: 'line' },
          ],
          affectedCells: [cellKey(0, 1)],
        }
      },
    }
    const downstreamColorAssumptionRule = createColorAssumptionInferenceRule(
      () => [downstreamRule],
    )

    const result = downstreamColorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
    expect(result?.message).toContain('is green')
    expect(result?.message).toContain('after 1 trial step')
    expect(result?.message).toContain('green branch: 1 step')
  })

  it('infers from a quick contradiction even when the opposite branch only reaches the probe budget', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'blank'
    const stallRule: Rule = {
      id: 'stall-test',
      name: 'Stall Test',
      apply: (trial) => {
        if (trial.cells[cellKey(0, 1)]?.fill !== 'green') {
          return null
        }
        return {
          message: 'keep this branch unresolved',
          diffs: [
            {
              kind: 'sector',
              sectorKey: sectorKey(2, 2, 'se'),
              fromMask: trial.sectors[sectorKey(2, 2, 'se')].constraintsMask,
              toMask: trial.sectors[sectorKey(2, 2, 'se')].constraintsMask,
            },
          ],
          affectedCells: [],
          affectedSectors: [sectorKey(2, 2, 'se')],
        }
      },
    }
    const probingRule = createColorAssumptionInferenceRule(() => [stallRule], {
      maxMs: Number.POSITIVE_INFINITY,
      maxTrialSteps: 24,
    })

    const result = probingRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('probe budget 24')
    expect(result?.message).toContain('green branch: unresolved after 24 steps')
    expect(result?.message).toContain('yellow branch: 0 steps')
  })

  it('moves to later components when an earlier component is unresolved at the current probe budget', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.sectors[sectorKey(0, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.sectors[sectorKey(0, 1, 'ne')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.sectors[sectorKey(0, 1, 'sw')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.sectors[sectorKey(0, 1, 'se')].constraintsMask = SECTOR_MASK_ONLY_1
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    const stallRule: Rule = {
      id: 'stall-test',
      name: 'Stall Test',
      apply: () => ({
        message: 'keep this branch unresolved',
        diffs: [
          {
            kind: 'sector',
            sectorKey: sectorKey(2, 2, 'se'),
            fromMask: puzzle.sectors[sectorKey(2, 2, 'se')].constraintsMask,
            toMask: puzzle.sectors[sectorKey(2, 2, 'se')].constraintsMask,
          },
        ],
        affectedCells: [],
        affectedSectors: [sectorKey(2, 2, 'se')],
      }),
    }
    const probingRule = createColorAssumptionInferenceRule(() => [stallRule], {
      maxMs: Number.POSITIVE_INFINITY,
      maxTrialSteps: 24,
    })

    const result = probingRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(1, 0),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
    expect(result?.message).toContain('Searched 2 candidate components')
    expect(result?.message).toContain('probe budget 24')
  })

  it('treats unreachable fixed green regions as a contradiction', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }

    const result = colorAssumptionRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
    expect(result?.message).toContain('is yellow')
    expect(result?.message).toContain('disconnected-green contradiction')
    expect(result?.message).toContain('yellow branch: 0 steps')
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
    expect(result?.message).toContain('must have exactly one line')
    expect(result?.message).toContain('contradicts the puzzle')
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
    expect(result?.message).toContain('has two possible continuations')
    expect(result?.message).toContain('contradicts the puzzle')
    expect(result?.inferenceDetails?.kind).toBe('slither-strong')
    expect(result?.inferenceDetails?.branches).toHaveLength(2)
  })

  it('forces an edge branch when the opposite branch contradicts and the survivor reaches the probe budget', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    setClue(puzzle, 0, 0, 1)
    const top = edgeKey([0, 0], [0, 1])
    const bottom = edgeKey([1, 0], [1, 1])
    const left = edgeKey([0, 0], [1, 0])
    const right = edgeKey([0, 1], [1, 1])
    const stallRule: Rule = {
      id: 'strong-edge-stall-test',
      name: 'Strong Edge Stall Test',
      apply: (trial) => {
        const topMark = trial.edges[top]?.mark ?? 'unknown'
        if (topMark === 'blank') {
          return {
            message: 'make blank branch contradict the clue',
            diffs: [
              { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
              { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
              { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
            ],
            affectedCells: [cellKey(0, 0)],
          }
        }
        if (topMark !== 'line') {
          return null
        }
        return {
          message: 'keep line branch unresolved',
          diffs: [
            {
              kind: 'sector',
              sectorKey: sectorKey(0, 0, 'nw'),
              fromMask: trial.sectors[sectorKey(0, 0, 'nw')].constraintsMask,
              toMask: trial.sectors[sectorKey(0, 0, 'nw')].constraintsMask,
            },
          ],
          affectedCells: [cellKey(0, 0)],
          affectedSectors: [sectorKey(0, 0, 'nw')],
        }
      },
    }
    const probingStrongRule = createStrongInferenceRule(() => [stallRule], {
      maxMs: Number.POSITIVE_INFINITY,
      maxTrialSteps: 24,
    })

    const result = probingStrongRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
    ])
    expect(result?.message).toContain('probe budget 24')
    expect(result?.message).toContain('A branch unresolved after 24 steps')
    expect(result?.message).toContain('B branch contradicted after 1 step')
  })

  it('forces a binary strong branch when the opposite branch contradicts and the survivor reaches the probe budget', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    setClue(puzzle, 0, 0, 1)

    const up = edgeKey([0, 0], [1, 0])
    const down = edgeKey([1, 0], [2, 0])
    const right = edgeKey([1, 0], [1, 1])
    puzzle.edges[right].mark = 'line'
    const stallRule: Rule = {
      id: 'strong-binary-stall-test',
      name: 'Strong Binary Stall Test',
      apply: (trial) => {
        if ((trial.edges[up]?.mark ?? 'unknown') !== 'blank') {
          return null
        }
        if ((trial.edges[down]?.mark ?? 'unknown') !== 'line') {
          return null
        }
        return {
          message: 'keep surviving binary branch unresolved',
          diffs: [
            {
              kind: 'sector',
              sectorKey: sectorKey(1, 0, 'nw'),
              fromMask: trial.sectors[sectorKey(1, 0, 'nw')].constraintsMask,
              toMask: trial.sectors[sectorKey(1, 0, 'nw')].constraintsMask,
            },
          ],
          affectedCells: [cellKey(1, 0)],
          affectedSectors: [sectorKey(1, 0, 'nw')],
        }
      },
    }
    const probingStrongRule = createStrongInferenceRule(() => [stallRule], {
      maxMs: Number.POSITIVE_INFINITY,
      maxTrialSteps: 24,
    })

    const result = probingStrongRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: up, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: down, from: 'unknown', to: 'line' },
    ])
    expect(result?.message).toContain('has two possible continuations')
    expect(result?.message).toContain('probe budget 24')
    expect(result?.message).toContain('A branch contradicted after 0 steps')
    expect(result?.message).toContain('B branch unresolved after 24 steps')
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
    const sharedStrongRule = createStrongInferenceRule(() => [
      sharedConsequenceRule,
    ])

    const result = sharedStrongRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
    ])
    expect(result?.message).toContain('must have exactly one line')
    expect(result?.message).toContain('same consequence')
    expect(result?.message).toContain('probe budget')
  })

  it('can run on the provided 10x10 puzzle after deterministic stabilization', () => {
    const rulesWithoutStrong = slitherRules.filter(
      (rule) => rule.id !== 'strong-inference',
    )
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/10/10/c3ch08c0d22aodh1bgdbjbag3dhdo12c3a52ah3b0',
    )

    for (let stepNumber = 1; stepNumber <= 400; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        rulesWithoutStrong,
        stepNumber,
      )
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    expect(() => unboundedStrongRule.apply(current)).not.toThrow()
    const result = unboundedStrongRule.apply(current)
    expect(result === null || result.diffs.length > 0).toBe(true)
  })

  it('lets deterministic cut coloring advance the provided 18x10 stuck puzzle', () => {
    const rulesBeforeColorAssumption = slitherRules.filter(
      (rule) =>
        rule.id !== 'color-assumption-inference' &&
        rule.id !== 'sector-parity-inference' &&
        rule.id !== 'strong-inference',
    )
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/18/10/l12cg261b353didb1bbg112dgb2bbci161b3dgbhapchcg3c161dicb2bbg111cga2bbbi271c161bg31cj',
    )

    for (let stepNumber = 1; stepNumber <= 2000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        rulesBeforeColorAssumption,
        stepNumber,
      )
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    const result = unboundedColorAssumptionRule.apply(current)
    expect(result).toBeNull()
    expect(current.cells[cellKey(2, 12)]?.fill).toBe('green')
    expect(current.cells[cellKey(7, 0)]?.fill).toBe('green')

    const targetBranch = clonePuzzle(current)
    targetBranch.cells[cellKey(7, 0)] = {
      ...(targetBranch.cells[cellKey(7, 0)] ?? {}),
      fill: 'yellow',
    }
    const targetResult = runTrialUntilFixpoint(
      targetBranch,
      rulesBeforeColorAssumption,
      120,
      Number.POSITIVE_INFINITY,
    )
    expect(targetResult.contradiction).toBe(true)
  })

  it('keeps the provided 6x100 target edge covered after deterministic stabilization', () => {
    const rulesWithoutStrong = slitherRules.filter(
      (rule) => rule.id !== 'strong-inference',
    )
    const target = edgeKey([23, 0], [24, 0])
    let current = decodeSlitherFromPuzzlink(
      'https://puzz.link/p?slither/6/100/h1dgdabdg3bgdddbg2cgcddag0bgdcbag0bgdbcdg1cgbdddg1bgbdddg2dgaadbg1cgaddbg0bgdbacg1bgadccg3cgaacdg2cgbbadg3agbbbag3cgdcddg2bgcddag2bgaabdg2bgdbdag3bgcdbcg2cgdddbg2cgdddag2bgddcag2bgcdaag3bgdddcg2cgcaddg2bgabddg1bgdadcg3bgbdcdg1bgddddg1dgdbbdg3agbbdag1dgbdddg2agadddg1d',
    )

    for (let stepNumber = 1; stepNumber <= 2000; stepNumber += 1) {
      const { nextPuzzle, step } = runNextRule(
        current,
        rulesWithoutStrong,
        stepNumber,
      )
      if (!step) {
        break
      }
      current = nextPuzzle
    }

    expect(current.edges[target]?.mark ?? 'unknown').toBe('blank')
  })
})
