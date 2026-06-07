import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../../parsers/puzzlink'
import { cellKey, edgeKey } from '../../../ir/keys'
import { createSlitherPuzzle } from '../../../ir/slither'
import { runNextRule } from '../../engine'
import { slitherRules } from '../rules'
import { setClue } from './testUtils'

describe('slither inside reachability coloring rule', () => {
  const reachabilityRule = slitherRules.find(
    (rule) => rule.id === 'inside-reachability-coloring',
  )
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
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
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
        {
          kind: 'cell',
          cellKey: cellKey(0, 1),
          fromFill: null,
          toFill: 'yellow',
        },
        {
          kind: 'cell',
          cellKey: cellKey(0, 2),
          fromFill: null,
          toFill: 'yellow',
        },
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
      {
        kind: 'cell',
        cellKey: cellKey(0, 2),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
  })

  it('does not traverse into clue-3 cells and does not color clue-3 cells yellow', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    setClue(puzzle, 0, 1, 3)

    const result = reachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(0, 2),
        fromFill: null,
        toFill: 'yellow',
      },
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
      const { nextPuzzle, step } = runNextRule(
        current,
        slitherRules,
        stepNumber,
      )
      if (!step) {
        break
      }
      if (
        step.ruleId === 'inside-reachability-coloring' &&
        step.diffs.some(
          (diff) => diff.kind === 'cell' && diff.toFill === 'yellow',
        )
      ) {
        sawReachabilityColoring = true
        break
      }
      current = nextPuzzle
    }

    expect(sawReachabilityColoring).toBe(true)
  })
})

describe('slither outside reachability coloring rule', () => {
  const outsideReachabilityRule = slitherRules.find(
    (rule) => rule.id === 'outside-reachability-coloring',
  )
  if (!outsideReachabilityRule) {
    throw new Error('Expected outside-reachability-coloring rule')
  }

  it('colors a fully line-enclosed unknown cell green', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
    ])
  })

  it('does not color a boundary cell reachable through an unknown outside edge', () => {
    const puzzle = createSlitherPuzzle(1, 1)

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not color a boundary cell reachable through a blank outside edge', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'blank'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('traverses unknown and blank edges but does not cross a line edge', () => {
    const puzzle = createSlitherPuzzle(1, 4)
    for (let col = 0; col < 3; col += 1) {
      puzzle.edges[edgeKey([0, col], [0, col + 1])].mark = 'line'
      puzzle.edges[edgeKey([1, col], [1, col + 1])].mark = 'line'
    }
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'blank'
    puzzle.edges[edgeKey([0, 3], [1, 3])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
      { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'green' },
    ])
  })

  it('treats existing green cells as traversal blockers without overwriting them', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
    ])
    expect(result?.diffs).not.toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: 'green',
      toFill: 'green',
    })
  })

  it('does not traverse into clue-3 cells and does not color clue-3 cells green', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    setClue(puzzle, 0, 1, 3)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
    ])
    expect(result?.diffs).not.toContainEqual({
      kind: 'cell',
      cellKey: cellKey(0, 1),
      fromFill: null,
      toFill: 'green',
    })
  })

  it('uses existing yellow cells as outside reachability sources', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
    for (let col = 0; col < 3; col += 1) {
      puzzle.edges[edgeKey([0, col], [0, col + 1])].mark = 'line'
      puzzle.edges[edgeKey([1, col], [1, col + 1])].mark = 'line'
    }
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 3], [1, 3])].mark = 'line'

    const result = outsideReachabilityRule.apply(puzzle)

    expect(result).toBeNull()
  })
})

describe('slither color connectivity cut coloring rule', () => {
  const cutColorRule = slitherRules.find(
    (rule) => rule.id === 'color-connectivity-cut-coloring',
  )
  if (!cutColorRule) {
    throw new Error('Expected color-connectivity-cut-coloring rule')
  }

  it('colors an unknown articulation cell green between two green components', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }

    const result = cutColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
  })

  it('does not apply when there is only one green source component', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = cutColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('does not color across a line-separated green component', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'line'

    const result = cutColorRule.apply(puzzle)

    expect(result).toBeNull()
  })

  it('treats an unknown clue-3 cell as a colorable connectivity candidate', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 2)] = { fill: 'green' }
    setClue(puzzle, 0, 1, 3)

    const result = cutColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
    ])
  })

  it('colors every unknown cell inside a blank-compressed green bottleneck', () => {
    const puzzle = createSlitherPuzzle(1, 4)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(0, 3)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 2], [1, 2])].mark = 'blank'

    const result = cutColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 1), fromFill: null, toFill: 'green' },
      { kind: 'cell', cellKey: cellKey(0, 2), fromFill: null, toFill: 'green' },
    ])
  })

  it('colors an outside-to-yellow bottleneck yellow', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(1, 1)] = { fill: 'yellow' }
    puzzle.cells[cellKey(1, 0)] = { fill: 'green' }
    puzzle.cells[cellKey(1, 2)] = { fill: 'green' }
    puzzle.cells[cellKey(2, 1)] = { fill: 'green' }

    const result = cutColorRule.apply(puzzle)

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

  it('colors cells unreachable from green sources yellow', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = cutColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      {
        kind: 'cell',
        cellKey: cellKey(0, 1),
        fromFill: null,
        toFill: 'yellow',
      },
      {
        kind: 'cell',
        cellKey: cellKey(0, 2),
        fromFill: null,
        toFill: 'yellow',
      },
    ])
  })

  it('colors cells unreachable from the exterior green without an existing yellow source', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    puzzle.edges[edgeKey([0, 0], [0, 1])].mark = 'line'
    puzzle.edges[edgeKey([1, 0], [1, 1])].mark = 'line'
    puzzle.edges[edgeKey([0, 0], [1, 0])].mark = 'line'
    puzzle.edges[edgeKey([0, 1], [1, 1])].mark = 'line'

    const result = cutColorRule.apply(puzzle)

    expect(result).not.toBeNull()
    expect(result?.diffs).toEqual([
      { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
    ])
  })

  it('keeps unknown edges passable for connectivity reachability', () => {
    const puzzle = createSlitherPuzzle(1, 2)
    puzzle.cells[cellKey(0, 0)] = { fill: 'green' }

    const result = cutColorRule.apply(puzzle)

    expect(result).toBeNull()
  })
})
