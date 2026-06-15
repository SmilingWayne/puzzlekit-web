import { cellKey, edgeKey, lineKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import type { PuzzleIR } from '../../domain/ir/types'
import type { RuleDiff } from '../../domain/rules/types'

export type RuleExampleData = {
  puzzle: PuzzleIR
  before?: RuleDiff[]
  after: RuleDiff[]
  explanation: string
}

const createWhitePearlExample = (): RuleExampleData => {
  const puzzle = createMasyuPuzzle(3, 3)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'pearl', color: 'white' } }
  const left = lineKey([1, 0], [1, 1])
  const right = lineKey([1, 1], [1, 2])
  const up = lineKey([0, 1], [1, 1])
  const down = lineKey([1, 1], [2, 1])
  return {
    puzzle,
    before: [{ kind: 'line', lineKey: left, from: 'unknown', to: 'line' }],
    after: [
      { kind: 'line', lineKey: right, from: 'unknown', to: 'line' },
      { kind: 'line', lineKey: up, from: 'unknown', to: 'blank' },
      { kind: 'line', lineKey: down, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'A known horizontal exit forces the white pearl to continue horizontally and rejects both vertical exits.',
  }
}

const createBlackPearlExample = (): RuleExampleData => {
  const puzzle = createMasyuPuzzle(4, 3)
  puzzle.cells[cellKey(2, 1)] = { clue: { kind: 'pearl', color: 'black' } }
  const up = lineKey([1, 1], [2, 1])
  const upExtension = lineKey([0, 1], [1, 1])
  const down = lineKey([2, 1], [3, 1])
  return {
    puzzle,
    before: [{ kind: 'line', lineKey: up, from: 'unknown', to: 'line' }],
    after: [
      { kind: 'line', lineKey: upExtension, from: 'unknown', to: 'line' },
      { kind: 'line', lineKey: down, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'Once the loop exits upward from a black pearl, it must continue straight for another cell and cannot also exit downward.',
  }
}

const createVertexDegreeExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(2, 2)
  const top = edgeKey([0, 1], [1, 1])
  const left = edgeKey([1, 0], [1, 1])
  const right = edgeKey([1, 1], [1, 2])
  const bottom = edgeKey([1, 1], [2, 1])
  return {
    puzzle,
    before: [
      { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'line' },
    ],
    after: [
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'A loop vertex already containing two used edges cannot accept either remaining edge.',
  }
}

const createAdjacentThreesExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(3, 4)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'number', value: 3 } }
  puzzle.cells[cellKey(1, 2)] = { clue: { kind: 'number', value: 3 } }
  const left = edgeKey([1, 1], [2, 1])
  const shared = edgeKey([1, 2], [2, 2])
  const right = edgeKey([1, 3], [2, 3])
  const sharedAbove = edgeKey([0, 2], [1, 2])
  const sharedBelow = edgeKey([2, 2], [3, 2])
  return {
    puzzle,
    after: [
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: shared, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: sharedAbove, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: sharedBelow, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'Adjacent 3s force every perpendicular edge to be a line and cross out both straight extensions of their shared edge. The vertical pattern is the rotated equivalent, and longer runs apply the same deduction pairwise.',
  }
}

const createCellClueCompletionExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(3, 3)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'number', value: 1 } }
  const top = edgeKey([1, 1], [1, 2])
  const bottom = edgeKey([2, 1], [2, 2])
  const left = edgeKey([1, 1], [2, 1])
  const right = edgeKey([1, 2], [2, 2])
  return {
    puzzle,
    before: [{ kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' }],
    after: [
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'Once the clue already has one line, every remaining unknown edge must be crossed out.',
  }
}

const createAdjacentTwoThreeOppositeCrossExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(4, 4)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'number', value: 2 } }
  puzzle.cells[cellKey(1, 2)] = { clue: { kind: 'number', value: 3 } }
  const twoOpposite = edgeKey([1, 1], [2, 1])
  const threeOpposite = edgeKey([1, 3], [2, 3])
  const extensionAbove = edgeKey([0, 2], [1, 2])
  const extensionBelow = edgeKey([2, 2], [3, 2])
  return {
    puzzle,
    before: [{ kind: 'edge', edgeKey: twoOpposite, from: 'unknown', to: 'blank' }],
    after: [
      { kind: 'edge', edgeKey: threeOpposite, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: extensionAbove, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: extensionBelow, from: 'unknown', to: 'blank' },
    ],
    explanation:
      "With the 2's far-side edge crossed out, the 3's opposite edge is a line and the shared-side extensions are blank.",
  }
}

const createDiagonalThreesExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(4, 4)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'number', value: 3 } }
  puzzle.cells[cellKey(2, 2)] = { clue: { kind: 'number', value: 3 } }
  const firstLeft = edgeKey([1, 1], [2, 1])
  const firstTop = edgeKey([1, 1], [1, 2])
  const secondRight = edgeKey([2, 3], [3, 3])
  const secondBottom = edgeKey([3, 2], [3, 3])
  const decidedEdges = [firstLeft, firstTop, secondRight, secondBottom]
  return {
    puzzle,
    after: decidedEdges.map((key) => ({
      kind: 'edge' as const,
      edgeKey: key,
      from: 'unknown' as const,
      to: 'line' as const,
    })),
    explanation:
      'Diagonal 3s force the two edges at each outer corner, giving four lines in total.',
  }
}

export const ruleExamples: Record<string, RuleExampleData> = {
  'masyu:white-pearl-rule': createWhitePearlExample(),
  'masyu:black-pearl-rule': createBlackPearlExample(),
  'slitherlink:vertex-degree': createVertexDegreeExample(),
  'slitherlink:contiguous-three-run-boundaries': createAdjacentThreesExample(),
  'slitherlink:diagonal-adjacent-three-outer-corners':
    createDiagonalThreesExample(),
  'slitherlink:cell-count-completion': createCellClueCompletionExample(),
  'slitherlink:adjacent-two-three-opposite-cross':
    createAdjacentTwoThreeOppositeCrossExample(),
}
