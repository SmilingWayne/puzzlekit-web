import { describe, expect, it } from 'vitest'
import { cellKey, lineKey, tileKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import {
  createMasyuLineDecisionCollector,
  createMasyuTileDecisionCollector,
} from '../rules/decisionCollector'
import {
  getMasyuBlackPearlKeys,
  getMasyuPearlColor,
  getMasyuPearlKeys,
  getMasyuWhitePearlKeys,
} from '../rules/pearlSelectors'
import { buildMasyuTileParityGraph } from '../rules/tileParity'
import {
  buildMasyuCandidateGraph,
  findMasyuPrematureLoopClosingLines,
  getMasyuRequiredSources,
} from '../rules/lineGraph'
import { markLine, addPearl } from './testUtils'

describe('Masyu shared helper primitives', () => {
  it('collects compatible line and tile decisions without overwriting conflicts', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const targetLine = lineKey([1, 1], [1, 2])
    const lineDecisions = createMasyuLineDecisionCollector(puzzle)

    expect(lineDecisions.add(targetLine, 'line')).toBe(true)
    expect(lineDecisions.add(targetLine, 'line')).toBe(true)
    expect(lineDecisions.add(targetLine, 'blank')).toBe(false)
    expect(lineDecisions.diffs()).toEqual([
      { kind: 'line', lineKey: targetLine, from: 'unknown', to: 'line' },
    ])

    const targetTile = tileKey(1, 1)
    const tileDecisions = createMasyuTileDecisionCollector(puzzle)
    expect(tileDecisions.add(targetTile, 'green')).toBe(true)
    expect(tileDecisions.add(targetTile, 'yellow')).toBe(false)
    expect(tileDecisions.diffs()).toEqual([
      { kind: 'tile', tileKey: targetTile, fromFill: null, toFill: 'green' },
    ])
  })

  it('guards line decisions that would overflow endpoint degree', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    const guarded = createMasyuLineDecisionCollector(puzzle, {
      guardLineDegree: true,
    })

    expect(guarded.add(lineKey([1, 1], [1, 2]), 'line')).toBe(false)
    expect(guarded.hasChanges()).toBe(false)
  })

  it('selects pearl keys and colors in puzzle order', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    addPearl(puzzle, 0, 0, 'black')
    addPearl(puzzle, 1, 1, 'white')

    expect(getMasyuPearlKeys(puzzle)).toEqual([cellKey(0, 0), cellKey(1, 1)])
    expect(getMasyuBlackPearlKeys(puzzle)).toEqual([cellKey(0, 0)])
    expect(getMasyuWhitePearlKeys(puzzle)).toEqual([cellKey(1, 1)])
    expect(getMasyuPearlColor(puzzle, cellKey(1, 1))).toBe('white')
  })

  it('shares line graph vocabulary for premature closures and required sources', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    addPearl(puzzle, 2, 2, 'white')
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')
    markLine(puzzle, lineKey([3, 2], [3, 3]), 'line')
    const closingLine = lineKey([0, 0], [1, 0])

    expect(findMasyuPrematureLoopClosingLines(puzzle)).toEqual([closingLine])
    expect(
      getMasyuRequiredSources(puzzle, buildMasyuCandidateGraph(puzzle)),
    ).toEqual(
      new Set([
        cellKey(2, 2),
        cellKey(0, 0),
        cellKey(0, 1),
        cellKey(1, 1),
        cellKey(1, 0),
        cellKey(3, 2),
        cellKey(3, 3),
      ]),
    )
  })

  it('builds tile parity from boundary, line, blank, and fixed color anchors', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'blank')
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }

    const parity = buildMasyuTileParityGraph(puzzle)

    expect(parity.getInferredColor(tileKey(0, 1))).toBe('yellow')
    expect(parity.getInferredColor(tileKey(1, 1))).toBe('green')
    expect(parity.getInferredColor(tileKey(2, 1))).toBe('green')
    expect(parity.firstConflict).toBeNull()
  })
})
