import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import type { LineMark } from '../../../ir/types'
import { runNextRule } from '../../engine'
import { masyuPlugin } from '../../../plugins/masyuPlugin'
import {
  createAdjacentWhitePearlsLookaheadRule,
  createBlackPearlCandidatePruningRule,
  createEmptyCellCandidatePruningRule,
  createWhitePearlCandidatePruningRule,
} from '../rules/candidates'
import { createMasyuLookaheadContext } from '../rules/lookahead'
import { markLine, addPearl, getLineDegree, expectLineDiffs } from './testUtils'

describe('Masyu black pearl candidate pruning', () => {
  it('forces common exit and extension lines from the remaining black pearl candidates', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    const northExtension = lineKey([0, 2], [1, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [northExtension]: 'line',
      [south]: 'blank',
    })
    expect(result?.affectedCells).toEqual([cellKey(2, 2)])
  })

  it('removes a black pearl exit when every candidate using it leaves a nearby white pearl impossible', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 2, 4, 'white')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'blank')
    const north = lineKey([2, 3], [3, 3])
    const west = lineKey([3, 2], [3, 3])
    const east = lineKey([3, 3], [3, 4])
    const northExtension = lineKey([1, 3], [2, 3])
    const westExtension = lineKey([3, 1], [3, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [north]: 'line',
      [west]: 'line',
      [northExtension]: 'line',
      [westExtension]: 'line',
      [east]: 'blank',
    })
  })

  it('removes an exit that would give an adjacent black pearl degree 3 through the extension line', () => {
    const puzzle = createMasyuPuzzle(6, 7)
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 3, 4, 'black')
    markLine(puzzle, lineKey([2, 3], [3, 3]), 'line')
    markLine(puzzle, lineKey([2, 4], [3, 4]), 'line')
    const east = lineKey([3, 3], [3, 4])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expect(result?.diffs).toContainEqual({
      kind: 'line',
      lineKey: lineKey([1, 3], [2, 3]),
      from: 'unknown',
      to: 'line',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'line',
      lineKey: east,
      from: 'unknown',
      to: 'blank',
    })
  })

  it('removes candidates whose required black pearl extension is already blank', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'blank')
    const north = lineKey([1, 2], [2, 2])
    const south = lineKey([2, 2], [3, 2])
    const southExtension = lineKey([3, 2], [4, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expect(result?.diffs).toContainEqual({
      kind: 'line',
      lineKey: south,
      from: 'unknown',
      to: 'line',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'line',
      lineKey: southExtension,
      from: 'unknown',
      to: 'line',
    })
    expect(result?.diffs).toContainEqual({
      kind: 'line',
      lineKey: north,
      from: 'unknown',
      to: 'blank',
    })
  })

  it('removes a black pearl candidate that would close a smaller loop', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 3], [1, 3]), 'line')
    markLine(puzzle, lineKey([1, 3], [1, 4]), 'line')
    markLine(puzzle, lineKey([1, 4], [2, 4]), 'line')
    markLine(puzzle, lineKey([4, 4], [4, 5]), 'line')
    const northExtension = lineKey([0, 2], [1, 2])
    const east = lineKey([2, 2], [2, 3])
    const west = lineKey([2, 1], [2, 2])
    const westExtension = lineKey([2, 0], [2, 1])
    const south = lineKey([2, 2], [3, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [northExtension]: 'line',
      [west]: 'line',
      [westExtension]: 'line',
      [south]: 'blank',
      [east]: 'blank',
    })
  })

  it('allows a black pearl candidate that closes the only confirmed loop component', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(puzzle, lineKey([0, 3], [1, 3]), 'line')
    markLine(puzzle, lineKey([1, 3], [1, 4]), 'line')
    markLine(puzzle, lineKey([1, 4], [2, 4]), 'line')
    const northExtension = lineKey([0, 2], [1, 2])
    const south = lineKey([2, 2], [3, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [northExtension]: 'line',
      [south]: 'blank',
    })
  })

  it('checks affected white pearl dependencies outside the candidate touched cells', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 2, 4, 'white')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'blank')
    const north = lineKey([2, 3], [3, 3])
    const west = lineKey([3, 2], [3, 3])
    const east = lineKey([3, 3], [3, 4])
    const northExtension = lineKey([1, 3], [2, 3])
    const westExtension = lineKey([3, 1], [3, 2])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [north]: 'line',
      [west]: 'line',
      [northExtension]: 'line',
      [westExtension]: 'line',
      [east]: 'blank',
    })
  })

  it('ignores unrelated impossible pearls inside the old fixed 5x5 scan area', () => {
    const puzzle = createMasyuPuzzle(7, 7)
    addPearl(puzzle, 3, 3, 'black')
    addPearl(puzzle, 5, 1, 'white')
    markLine(puzzle, lineKey([3, 2], [3, 3]), 'blank')
    markLine(puzzle, lineKey([3, 3], [4, 3]), 'blank')
    markLine(puzzle, lineKey([4, 1], [5, 1]), 'blank')
    markLine(puzzle, lineKey([5, 0], [5, 1]), 'blank')
    markLine(puzzle, lineKey([5, 1], [5, 2]), 'blank')
    markLine(puzzle, lineKey([5, 1], [6, 1]), 'blank')
    const north = lineKey([2, 3], [3, 3])
    const northExtension = lineKey([1, 3], [2, 3])
    const east = lineKey([3, 3], [3, 4])
    const eastExtension = lineKey([3, 4], [3, 5])

    const result = createBlackPearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [north]: 'line',
      [northExtension]: 'line',
      [east]: 'line',
      [eastExtension]: 'line',
    })
  })

  it('does not run on a fully determined black pearl', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'line')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'line')

    expect(createBlackPearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('rejects a black pearl candidate that leaves an extension endpoint with no second exit', () => {
    const puzzle = createMasyuPuzzle(4, 5)
    addPearl(puzzle, 2, 2, 'black')
    markLine(puzzle, lineKey([2, 2], [2, 3]), 'blank')
    markLine(puzzle, lineKey([2, 2], [3, 2]), 'blank')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([0, 3], [0, 4]), 'line')
    markLine(puzzle, lineKey([0, 3], [1, 3]), 'line')

    expect(createBlackPearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('does nothing when all black pearl candidates remain symmetric', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')

    expect(createBlackPearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('prunes only one black pearl per step on the reported 10x6 regression puzzle', () => {
    let puzzle = masyuPlugin.parse(
      'https://puzz.link/p?mashu/10/6/0000b6103260i0902216',
    )
    const rules = masyuPlugin
      .getRules()
      .filter((rule) => rule.id !== 'masyu-color-pearl-propagation')
    let pruningStep: NonNullable<
      ReturnType<typeof runNextRule>['step']
    > | null = null

    for (let stepNumber = 1; stepNumber <= 8; stepNumber += 1) {
      const result = runNextRule(puzzle, rules, stepNumber)
      expect(result.step).not.toBeNull()
      if (result.step?.ruleName === 'Black Pearl Candidate Pruning') {
        pruningStep = result.step
        break
      }
      puzzle = result.nextPuzzle
    }

    expect(pruningStep?.affectedCells).toEqual([cellKey(1, 6)])
    expectLineDiffs(pruningStep?.diffs, {
      [lineKey([1, 6], [1, 7])]: 'line',
      [lineKey([1, 7], [1, 8])]: 'line',
      [lineKey([1, 5], [1, 6])]: 'blank',
    })
  })

  it('does not let White Pearl Rule push the reported long puzzle into a degree-3 cell', () => {
    const url =
      'https://puzz.link/p?mashu/49/39/0000000000i000000c63k0cj04962g6a430910i06390300109i20609090i30106000300400j00i100940iib01303c0646306110306j0010900f0306409064270i30112300030900000006a000390062216j09903i606230126c93a600000114000093009j63603004000040090099l0c919j00j41000l0343902030000k10963023990i0cia390399c02069200300930613i10013j0199ib0c00000460090a000i3j6iii013i0i1232090900c06960b00i323020000209j0909900996b690006463003k090396430000219900b02091610390021300l00c61a420b039i310201003030399010210i53026b690030a061132031003262120210a0ia30i30009190i3600601990300c00i30c31k0a203c019a0000090613ii00c26b0j206i0900130300093030023i09ic3b33b10i39310ia00030090060930000000130k090'
    let puzzle = masyuPlugin.parse(url)
    const unsafeLine = lineKey([2, 6], [2, 7])

    for (let stepNumber = 1; stepNumber <= 35; stepNumber += 1) {
      const result = runNextRule(puzzle, masyuPlugin.getRules(), stepNumber)
      if (!result.step) {
        break
      }
      expect(result.step.diffs).not.toContainEqual({
        kind: 'line',
        lineKey: unsafeLine,
        from: 'unknown',
        to: 'line',
      })
      puzzle = result.nextPuzzle
      expect(getLineDegree(puzzle, 2, 6)).toBeLessThanOrEqual(2)
    }
  })
})

describe('Masyu white pearl candidate pruning', () => {
  it('forces the only feasible white pearl straight axis', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 1, 'white')
    const east = lineKey([0, 1], [0, 2])
    const west = lineKey([0, 0], [0, 1])
    const south = lineKey([0, 1], [1, 1])

    const result = createWhitePearlCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [east]: 'line',
      [west]: 'line',
      [south]: 'blank',
    })
    expect(result?.affectedCells).toEqual([cellKey(0, 1)])
    expect(result?.message).toContain('White pearl')
  })

  it('does not force a white candidate line into a degree-2 neighbor', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'line')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')

    expect(createWhitePearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('rejects a white pearl axis that leaves a neighboring empty cell with no second exit', () => {
    const puzzle = createMasyuPuzzle(4, 5)
    addPearl(puzzle, 1, 2, 'white')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [0, 2]), 'line')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'line')
    markLine(puzzle, lineKey([1, 0], [2, 0]), 'line')
    markLine(puzzle, lineKey([2, 0], [2, 1]), 'line')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'line')

    expect(createWhitePearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('does nothing when both white straight-axis candidates remain symmetric', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'white')

    expect(createWhitePearlCandidatePruningRule().apply(puzzle)).toBeNull()
  })
})

describe('Masyu adjacent white pearls lookahead', () => {
  it('keeps parallel paths for horizontal white pearls when through is impossible', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 3], [2, 4]), 'blank')

    const result = createAdjacentWhitePearlsLookaheadRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([1, 2], [2, 2])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'line',
      [lineKey([1, 3], [2, 3])]: 'line',
      [lineKey([2, 3], [3, 3])]: 'line',
      [lineKey([2, 2], [2, 3])]: 'blank',
    })
    expect(result?.affectedCells).toEqual([cellKey(2, 2), cellKey(2, 3)])
    expect(result?.message).toContain('parallel')
  })

  it('keeps one horizontal through-line when parallel is impossible', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([1, 3], [2, 3]), 'blank')

    const result = createAdjacentWhitePearlsLookaheadRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 2], [2, 3])]: 'line',
      [lineKey([2, 1], [2, 2])]: 'line',
      [lineKey([2, 3], [2, 4])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'blank',
      [lineKey([2, 3], [3, 3])]: 'blank',
    })
    expect(result?.message).toContain('one straight line')
  })

  it('keeps parallel paths for vertical white pearls when through is impossible', () => {
    const puzzle = createMasyuPuzzle(6, 5)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 3, 2, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([3, 2], [4, 2]), 'blank')

    const result = createAdjacentWhitePearlsLookaheadRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 1], [2, 2])]: 'line',
      [lineKey([2, 2], [2, 3])]: 'line',
      [lineKey([3, 1], [3, 2])]: 'line',
      [lineKey([3, 2], [3, 3])]: 'line',
      [lineKey([2, 2], [3, 2])]: 'blank',
    })
  })

  it('keeps one vertical through-line when parallel is impossible', () => {
    const puzzle = createMasyuPuzzle(6, 5)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 3, 2, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([3, 1], [3, 2]), 'blank')

    const result = createAdjacentWhitePearlsLookaheadRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [lineKey([2, 2], [3, 2])]: 'line',
      [lineKey([1, 2], [2, 2])]: 'line',
      [lineKey([3, 2], [4, 2])]: 'line',
      [lineKey([2, 2], [2, 3])]: 'blank',
      [lineKey([3, 2], [3, 3])]: 'blank',
    })
  })

  it('does nothing when both adjacent-white patterns remain feasible', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')

    expect(createAdjacentWhitePearlsLookaheadRule().apply(puzzle)).toBeNull()
  })

  it('does nothing when both adjacent-white patterns are impossible', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([2, 1], [2, 2]), 'blank')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')

    expect(createAdjacentWhitePearlsLookaheadRule().apply(puzzle)).toBeNull()
  })

  it('does not force the remaining adjacent-white pattern through a degree-2 cell', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 2, 2, 'white')
    addPearl(puzzle, 2, 3, 'white')
    markLine(puzzle, lineKey([1, 2], [2, 2]), 'blank')
    markLine(puzzle, lineKey([2, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([2, 1], [3, 1]), 'line')

    expect(createAdjacentWhitePearlsLookaheadRule().apply(puzzle)).toBeNull()
  })

  it('rejects the reported adjacent-white horizontal assumption when it creates a single-exit empty cell', () => {
    const puzzle = createMasyuPuzzle(10, 10)
    addPearl(puzzle, 6, 6, 'black')
    addPearl(puzzle, 4, 8, 'white')
    addPearl(puzzle, 5, 8, 'white')
    markLine(puzzle, lineKey([4, 6], [5, 6]), 'line')
    markLine(puzzle, lineKey([5, 6], [6, 6]), 'line')
    markLine(puzzle, lineKey([4, 6], [4, 7]), 'line')
    markLine(puzzle, lineKey([6, 6], [6, 7]), 'line')
    markLine(puzzle, lineKey([6, 7], [6, 8]), 'line')

    const horizontalThroughOverlay = new Map<string, LineMark>([
      [lineKey([5, 7], [5, 8]), 'line'],
      [lineKey([5, 8], [5, 9]), 'line'],
      [lineKey([4, 7], [4, 8]), 'line'],
      [lineKey([4, 8], [4, 9]), 'line'],
    ])

    expect(
      createMasyuLookaheadContext(puzzle).isOverlayLocallyFeasible(
        [cellKey(4, 8), cellKey(5, 8)],
        horizontalThroughOverlay,
      ),
    ).toBe(false)
  })
})

describe('Masyu empty cell candidate pruning', () => {
  it('skips an unconstrained center empty cell with four unknown exits', () => {
    const puzzle = createMasyuPuzzle(3, 3)

    expect(createEmptyCellCandidatePruningRule().apply(puzzle)).toBeNull()
  })

  it('forces the only corner continuation from a degree-1 empty cell', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const south = lineKey([0, 0], [1, 0])
    const east = lineKey([0, 0], [0, 1])
    markLine(puzzle, south, 'line')

    const result = createEmptyCellCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, { [east]: 'line' })
    expect(result?.affectedCells).toEqual([cellKey(0, 0)])
    expect(result?.message).toContain('Empty cell')
  })

  it('rejects candidates that would overflow a touched cell degree', () => {
    const puzzle = createMasyuPuzzle(2, 4)
    const target = cellKey(0, 1)
    const east = lineKey([0, 1], [0, 2])
    const west = lineKey([0, 0], [0, 1])
    const south = lineKey([0, 1], [1, 1])
    markLine(puzzle, west, 'blank')
    markLine(puzzle, lineKey([0, 0], [1, 0]), 'blank')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')

    const result = createEmptyCellCandidatePruningRule().apply(puzzle)

    expect(result?.affectedCells).toEqual([target])
    expectLineDiffs(result?.diffs, { [east]: 'blank', [south]: 'blank' })
  })

  it('rejects candidates that make a nearby white pearl locally impossible', () => {
    const puzzle = createMasyuPuzzle(2, 4)
    addPearl(puzzle, 0, 2, 'white')
    const westOfEmpty = lineKey([0, 0], [0, 1])
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'blank')
    markLine(puzzle, lineKey([0, 2], [1, 2]), 'blank')

    const result = createEmptyCellCandidatePruningRule().apply(puzzle)

    expectLineDiffs(result?.diffs, {
      [westOfEmpty]: 'line',
      [lineKey([0, 0], [1, 0])]: 'line',
    })
  })

  it('does not rely on downstream deterministic propagation inside candidates', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'blank')
    markLine(puzzle, lineKey([1, 1], [1, 2]), 'unknown')
    markLine(puzzle, lineKey([1, 1], [2, 1]), 'unknown')

    expect(createEmptyCellCandidatePruningRule().apply(puzzle)).toBeNull()
  })
})
