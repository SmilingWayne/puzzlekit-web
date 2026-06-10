import { cellKey, edgeKey, lineKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import type { PuzzleIR } from '../../domain/ir/types'
import type { InferenceFocus, RuleDiff } from '../../domain/rules/types'

export type RuleExampleData = {
  puzzle: PuzzleIR
  before?: RuleDiff[]
  after: RuleDiff[]
  highlights?: InferenceFocus
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
    highlights: { cells: [cellKey(1, 1)], lines: [right, up, down] },
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
    highlights: { cells: [cellKey(2, 1)], lines: [upExtension, down] },
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
    highlights: { edges: [right, bottom], vertices: ['1,1'] },
    explanation:
      'A loop vertex already containing two used edges cannot accept either remaining edge.',
  }
}

export const ruleExamples: Record<string, RuleExampleData> = {
  'masyu:white-pearl-rule': createWhitePearlExample(),
  'masyu:black-pearl-rule': createBlackPearlExample(),
  'slitherlink:vertex-degree': createVertexDegreeExample(),
}
