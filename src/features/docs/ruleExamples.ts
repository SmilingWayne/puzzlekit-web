import { cellKey, edgeKey, lineKey, sectorKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  type PuzzleIR,
} from '../../domain/ir/types'
import type { RuleDiff } from '../../domain/rules/types'

export type RuleExampleCaseData = {
  id: string
  title?: string
  puzzle: PuzzleIR
  before?: RuleDiff[]
  after: RuleDiff[]
  explanation: string
}

export type RuleExampleData = {
  cases: [RuleExampleCaseData, ...RuleExampleCaseData[]]
}

const example = (exampleCase: RuleExampleCaseData): RuleExampleData => ({
  cases: [exampleCase],
})

const createWhitePearlExample = (): RuleExampleData => {
  const puzzle = createMasyuPuzzle(3, 3)
  puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'pearl', color: 'white' } }
  const left = lineKey([1, 0], [1, 1])
  const right = lineKey([1, 1], [1, 2])
  const up = lineKey([0, 1], [1, 1])
  const down = lineKey([1, 1], [2, 1])
  return example({
    id: 'horizontal-exit',
    puzzle,
    before: [{ kind: 'line', lineKey: left, from: 'unknown', to: 'line' }],
    after: [
      { kind: 'line', lineKey: right, from: 'unknown', to: 'line' },
      { kind: 'line', lineKey: up, from: 'unknown', to: 'blank' },
      { kind: 'line', lineKey: down, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'A known horizontal exit forces the white pearl to continue horizontally and rejects both vertical exits.',
  })
}

const createBlackPearlExample = (): RuleExampleData => {
  const puzzle = createMasyuPuzzle(4, 3)
  puzzle.cells[cellKey(2, 1)] = { clue: { kind: 'pearl', color: 'black' } }
  const up = lineKey([1, 1], [2, 1])
  const upExtension = lineKey([0, 1], [1, 1])
  const down = lineKey([2, 1], [3, 1])
  return example({
    id: 'upward-exit',
    puzzle,
    before: [{ kind: 'line', lineKey: up, from: 'unknown', to: 'line' }],
    after: [
      { kind: 'line', lineKey: upExtension, from: 'unknown', to: 'line' },
      { kind: 'line', lineKey: down, from: 'unknown', to: 'blank' },
    ],
    explanation:
      'Once the loop exits upward from a black pearl, it must continue straight for another cell and cannot also exit downward.',
  })
}

const createVertexDegreeExample = (): RuleExampleData => {
  const closedPuzzle = createSlitherPuzzle(2, 2)
  const closedTop = edgeKey([0, 1], [1, 1])
  const closedLeft = edgeKey([1, 0], [1, 1])
  const closedRight = edgeKey([1, 1], [1, 2])
  const closedBottom = edgeKey([1, 1], [2, 1])

  const continuePuzzle = createSlitherPuzzle(2, 2)
  const continueTop = edgeKey([0, 1], [1, 1])
  const continueBottom = edgeKey([1, 1], [1, 2])
  const continueLeft = edgeKey([0, 0], [0, 1])
  const continueRight = edgeKey([0, 1], [0, 2])

  const deadEndPuzzle = createSlitherPuzzle(3, 3)
  const deadEndTop = edgeKey([1, 1], [2, 1])
  const deadEndBottom = edgeKey([2, 1], [3, 1])
  const deadEndLeft = edgeKey([2, 0], [2, 1])
  const deadEndRight = edgeKey([2, 1], [2, 2])

  return {
    cases: [
      {
        id: 'degree-two-closure',
        title: 'Degree already two',
        puzzle: closedPuzzle,
        before: [
          { kind: 'edge', edgeKey: closedTop, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: closedLeft, from: 'unknown', to: 'line' },
        ],
        after: [
          { kind: 'edge', edgeKey: closedRight, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: closedBottom, from: 'unknown', to: 'blank' },
        ],
        explanation:
          'Two incident lines already meet at the vertex, so every remaining unknown edge is crossed out.',
      },
      {
        id: 'degree-one-completion',
        title: 'One line remains to complete',
        puzzle: continuePuzzle,
        before: [
          { kind: 'edge', edgeKey: continueTop, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: continueBottom, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: continueLeft, from: 'unknown', to: 'blank' },
        ],
        after: [
          { kind: 'edge', edgeKey: continueRight, from: 'unknown', to: 'line' },
        ],
        explanation:
          'One line is already present and only one unknown edge remains, so that edge must complete degree two.',
      },
      {
        id: 'single-unknown-dead-end',
        title: 'Last edge would create a dead end',
        puzzle: deadEndPuzzle,
        before: [
          { kind: 'edge', edgeKey: deadEndTop, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: deadEndLeft, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: deadEndRight, from: 'unknown', to: 'blank' },
        ],
        after: [
          { kind: 'edge', edgeKey: deadEndBottom, from: 'unknown', to: 'blank' },
        ],
        explanation:
          'With no line yet and only one unknown edge left, using it would leave a degree-one dead end.',
      },
    ],
  }
}

const createSectorConstraintEdgePropagationExample = (): RuleExampleData => {
  const onlyTwoPuzzle = createSlitherPuzzle(2, 2)
  onlyTwoPuzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_2
  const onlyTwoTop = edgeKey([0, 0], [0, 1])
  const onlyTwoLeft = edgeKey([0, 0], [1, 0])

  const onlyZeroPuzzle = createSlitherPuzzle(2, 2)
  onlyZeroPuzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_ONLY_0
  const onlyZeroTop = edgeKey([0, 0], [0, 1])
  const onlyZeroLeft = edgeKey([0, 0], [1, 0])

  const onlyOnePuzzle = createSlitherPuzzle(2, 2)
  onlyOnePuzzle.sectors[sectorKey(1, 1, 'nw')].constraintsMask = SECTOR_MASK_ONLY_1
  const onlyOneTop = edgeKey([1, 1], [1, 2])
  const onlyOneLeft = edgeKey([1, 1], [2, 1])

  const notOnePuzzle = createSlitherPuzzle(2, 2)
  notOnePuzzle.sectors[sectorKey(0, 0, 'nw')].constraintsMask = SECTOR_MASK_NOT_1
  const notOneTop = edgeKey([0, 0], [0, 1])
  const notOneLeft = edgeKey([0, 0], [1, 0])

  return {
    cases: [
      {
        id: 'sector-exactly-two',
        title: 'Sector must have two lines',
        puzzle: onlyTwoPuzzle,
        after: [
          { kind: 'edge', edgeKey: onlyTwoTop, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: onlyTwoLeft, from: 'unknown', to: 'line' },
        ],
        explanation:
          'NOT_ONE (blue) + NOT_ZERO (green) = TWO LINES.',
      },
      {
        id: 'sector-exactly-zero',
        title: 'Sector must have zero lines',
        puzzle: onlyZeroPuzzle,
        after: [
          { kind: 'edge', edgeKey: onlyZeroTop, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: onlyZeroLeft, from: 'unknown', to: 'blank' },
        ],
        explanation:
          'NOT_ONE (blue) + NOT_TWO (yellow) = TWO CROSSES.',
      },
      {
        id: 'sector-exactly-one',
        title: 'Sector must have one line',
        puzzle: onlyOnePuzzle,
        before: [{ kind: 'edge', edgeKey: onlyOneTop, from: 'unknown', to: 'blank' }],
        after: [
          { kind: 'edge', edgeKey: onlyOneLeft, from: 'unknown', to: 'line' },
        ],
        explanation:
          'ONLY_ONE (red) + ONE CROSS = ONE LINE.',
      },
      {
        id: 'sector-not-one',
        title: 'Sector cannot have one line',
        puzzle: notOnePuzzle,
        before: [{ kind: 'edge', edgeKey: notOneTop, from: 'unknown', to: 'line' }],
        after: [
          { kind: 'edge', edgeKey: notOneLeft, from: 'unknown', to: 'line' },
        ],
        explanation:
          'NOT_ONE (blue) + ONE LINE = TWO LINES.',
      },
    ],
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
  return example({
    id: 'horizontal-pair',
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
  })
}

const createCellClueCompletionExample = (): RuleExampleData => {
  const satisfiedPuzzle = createSlitherPuzzle(3, 3)
  satisfiedPuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 1 },
  }
  const top = edgeKey([1, 1], [1, 2])
  const bottom = edgeKey([2, 1], [2, 2])
  const left = edgeKey([1, 1], [2, 1])
  const right = edgeKey([1, 2], [2, 2])

  const requiredPuzzle = createSlitherPuzzle(3, 3)
  requiredPuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 3 },
  }

  return {
    cases: [
      {
        id: 'satisfied-clue',
        title: 'Satisfied clue',
        puzzle: satisfiedPuzzle,
        before: [{ kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' }],
        after: [
          { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: right, from: 'unknown', to: 'blank' },
        ],
        explanation:
          'Once the clue already has one line, every remaining unknown edge must be crossed out.',
      },
      {
        id: 'all-edges-required',
        title: 'All remaining edges required',
        puzzle: requiredPuzzle,
        before: [
          { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: left, from: 'unknown', to: 'blank' },
        ],
        after: [
          { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
        ],
        explanation:
          'The clue still needs two lines and only two unknown edges remain, so both must be lines.',
      },
    ],
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
  return example({
    id: 'horizontal-pair',
    puzzle,
    before: [
      { kind: 'edge', edgeKey: twoOpposite, from: 'unknown', to: 'blank' },
    ],
    after: [
      { kind: 'edge', edgeKey: threeOpposite, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: extensionAbove, from: 'unknown', to: 'blank' },
      { kind: 'edge', edgeKey: extensionBelow, from: 'unknown', to: 'blank' },
    ],
    explanation:
      "With the 2's far-side edge crossed out, the 3's opposite edge is a line and the shared-side extensions are blank.",
  })
}

const createColorEdgePropagationExample = (): RuleExampleData => {
  const sameColorPuzzle = createSlitherPuzzle(2, 2)
  sameColorPuzzle.cells[cellKey(0, 0)] = { fill: 'green' }
  sameColorPuzzle.cells[cellKey(0, 1)] = { fill: 'green' }
  const sameColorEdge = edgeKey([0, 1], [1, 1])

  const differentColorPuzzle = createSlitherPuzzle(2, 2)
  differentColorPuzzle.cells[cellKey(0, 0)] = { fill: 'green' }
  differentColorPuzzle.cells[cellKey(0, 1)] = { fill: 'yellow' }
  const differentColorEdge = edgeKey([0, 1], [1, 1])

  const insideCornerPuzzle = createSlitherPuzzle(2, 2)
  const insideCornerTop = edgeKey([0, 0], [0, 1])
  const insideCornerLeft = edgeKey([0, 0], [1, 0])

  const lineInferencePuzzle = createSlitherPuzzle(2, 2)
  const lineInferenceEdge = edgeKey([0, 1], [1, 1])

  return {
    cases: [
      {
        id: 'same-color-blank',
        title: 'Same color across interior edge',
        puzzle: sameColorPuzzle,
        after: [
          {
            kind: 'edge',
            edgeKey: sameColorEdge,
            from: 'unknown',
            to: 'blank',
          },
        ],
        explanation:
          'Two inside cells share a region, so the edge between them is crossed out.',
      },
      {
        id: 'different-color-line',
        title: 'Different colors across interior edge',
        puzzle: differentColorPuzzle,
        after: [
          {
            kind: 'edge',
            edgeKey: differentColorEdge,
            from: 'unknown',
            to: 'line',
          },
        ],
        explanation:
          'Inside and outside meet on their shared edge, so that edge must be a line.',
      },
      {
        id: 'inside-corner-boundary',
        title: 'Inside cell at the boundary',
        puzzle: insideCornerPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'edge',
            edgeKey: insideCornerTop,
            from: 'unknown',
            to: 'line',
          },
          {
            kind: 'edge',
            edgeKey: insideCornerLeft,
            from: 'unknown',
            to: 'line',
          },
        ],
        explanation:
          'An inside corner cell must meet the exterior with lines on both boundary edges.',
      },
      {
        id: 'line-infers-opposite-color',
        title: 'Line fixes the opposite color',
        puzzle: lineInferencePuzzle,
        before: [
          {
            kind: 'edge',
            edgeKey: lineInferenceEdge,
            from: 'unknown',
            to: 'line',
          },
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'A line separates opposite colors, so the unknown neighbor must be outside.',
      },
    ],
  }
}

const createColorOutsideSeedingExample = (): RuleExampleData => {
  const blankBoundaryPuzzle = createSlitherPuzzle(2, 2)
  const blankBoundaryTop = edgeKey([0, 0], [0, 1])

  const lineBoundaryPuzzle = createSlitherPuzzle(2, 2)
  const lineBoundaryTop = edgeKey([0, 0], [0, 1])

  const anchorPropagationPuzzle = createSlitherPuzzle(2, 2)
  const anchorPropagationEdge = edgeKey([0, 1], [1, 1])

  const parityChainPuzzle = createSlitherPuzzle(2, 3)
  const parityChainTopLeft = edgeKey([0, 0], [0, 1])
  const parityChainMiddle = edgeKey([0, 1], [1, 1])
  const parityChainTopRight = edgeKey([0, 2], [1, 2])

  return {
    cases: [
      {
        id: 'blank-boundary-outside',
        title: 'Crossed-out boundary edge',
        puzzle: blankBoundaryPuzzle,
        before: [
          {
            kind: 'edge',
            edgeKey: blankBoundaryTop,
            from: 'unknown',
            to: 'blank',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'A crossed-out outer edge touches an outside cell, seeding the parity component.',
      },
      {
        id: 'line-boundary-inside',
        title: 'Line on the boundary',
        puzzle: lineBoundaryPuzzle,
        before: [
          {
            kind: 'edge',
            edgeKey: lineBoundaryTop,
            from: 'unknown',
            to: 'line',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'green',
          },
        ],
        explanation:
          'A boundary line separates the exterior from an inside cell.',
      },
      {
        id: 'known-inside-anchor',
        title: 'Known inside cell as anchor',
        puzzle: anchorPropagationPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'edge',
            edgeKey: anchorPropagationEdge,
            from: 'unknown',
            to: 'line',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'A known inside cell anchors the component; the line forces the neighbor outside.',
      },
      {
        id: 'parity-chain-from-boundary',
        title: 'Parity chain from boundary',
        puzzle: parityChainPuzzle,
        before: [
          {
            kind: 'edge',
            edgeKey: parityChainTopLeft,
            from: 'unknown',
            to: 'blank',
          },
          {
            kind: 'edge',
            edgeKey: parityChainMiddle,
            from: 'unknown',
            to: 'line',
          },
          {
            kind: 'edge',
            edgeKey: parityChainTopRight,
            from: 'unknown',
            to: 'blank',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 0),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(0, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        explanation:
          'One boundary anchor colors the whole top row through parity across decided edges.',
      },
    ],
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
  return example({
    id: 'down-right-diagonal',
    puzzle,
    after: decidedEdges.map((key) => ({
      kind: 'edge' as const,
      edgeKey: key,
      from: 'unknown' as const,
      to: 'line' as const,
    })),
    explanation:
      'Diagonal 3s force the two edges at each outer corner, giving four lines in total.',
  })
}

const createColorCluePropagationExample = (): RuleExampleData => {
  const cornerInsidePuzzle = createSlitherPuzzle(3, 3)
  cornerInsidePuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 1 },
  }

  const clueTwoOutsidePuzzle = createSlitherPuzzle(3, 3)
  clueTwoOutsidePuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 2 },
  }

  const outsideCluePuzzle = createSlitherPuzzle(3, 3)
  outsideCluePuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 1 },
    fill: 'yellow',
  }

  const forcedOutsidePuzzle = createSlitherPuzzle(3, 3)
  forcedOutsidePuzzle.cells[cellKey(1, 1)] = {
    clue: { kind: 'number', value: 3 },
  }

  return {
    cases: [
      {
        id: 'corner-clue-forced-inside',
        title: 'Corner clue forced inside',
        puzzle: cornerInsidePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'Cell 1 already has two yellow neighbors; if it were green, that would force two lines — invalid for clue 1.',
      },
      {
        id: 'clue-two-outside-neighbors',
        title: 'Clue 2 with two outside neighbors',
        puzzle: clueTwoOutsidePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        explanation:
          'Whatever its color, clue 2 must end with two yellow and two green neighbors — two crosses and two lines.',
      },
      {
        id: 'outside-clue-remaining-outside',
        title: 'Outside clue already satisfied',
        puzzle: outsideCluePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'Cell 1 is already settled, so the remaining sides must all be crosses; the neighbor colors follow.',
      },
      {
        id: 'too-many-inside-neighbors',
        title: 'Too many inside neighbors',
        puzzle: forcedOutsidePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'Cell 1 already has three green neighbors; if it were green, at most one line could remain — invalid for clue 3.',
      },
    ],
  }
}

const createColorSectorMaskPropagationExample = (): RuleExampleData => {
  const notOneColorPuzzle = createSlitherPuzzle(3, 3)
  notOneColorPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
    SECTOR_MASK_NOT_1

  const onlyOneColorPuzzle = createSlitherPuzzle(3, 3)
  onlyOneColorPuzzle.sectors[sectorKey(1, 1, 'se')].constraintsMask =
    SECTOR_MASK_ONLY_1

  const differentColorsPuzzle = createSlitherPuzzle(2, 2)

  const sameColorsPuzzle = createSlitherPuzzle(2, 2)

  return {
    cases: [
      {
        id: 'not-one-sector-same-color',
        title: 'Not-one sector, same color',
        puzzle: notOneColorPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'green',
          },
        ],
        explanation:
          'NOT_ONE (blue) sector requires matching outside-neighbor colors, as shown.',
      },
      {
        id: 'only-one-sector-opposite-color',
        title: 'Only-one sector, opposite color',
        puzzle: onlyOneColorPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'ONLY_ONE sector requires opposite outside-neighbor colors, as shown.',
      },
      {
        id: 'different-colors-force-only-one',
        title: 'Opposite colors force only one',
        puzzle: differentColorsPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        after: [
          {
            kind: 'sector',
            sectorKey: sectorKey(0, 0, 'se'),
            fromMask: SECTOR_MASK_ALL,
            toMask: SECTOR_MASK_ONLY_1,
          },
        ],
        explanation:
          'Opposite outside-neighbor colors force exactly one line in the shared corner sector.',
      },
      {
        id: 'same-colors-force-not-one',
        title: 'Matching colors forbid one line',
        puzzle: sameColorsPuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'sector',
            sectorKey: sectorKey(0, 0, 'se'),
            fromMask: SECTOR_MASK_ALL,
            toMask: SECTOR_MASK_NOT_1,
          },
        ],
        explanation:
          'Matching outside-neighbor colors forbid exactly one line in the shared corner sector.',
      },
    ],
  }
}

const createColorOrthogonalConsensusPropagationExample = (): RuleExampleData => {
  const insidePuzzle = createSlitherPuzzle(3, 3)
  const outsidePuzzle = createSlitherPuzzle(3, 3)

  return {
    cases: [
      {
        id: 'uniform-inside-neighbors',
        title: 'All neighbors inside',
        puzzle: insidePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'green',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'green',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 1),
            fromFill: null,
            toFill: 'green',
          },
        ],
        explanation:
          'Every orthogonal neighbor is inside, so the center cell must also be inside.',
      },
      {
        id: 'uniform-outside-neighbors',
        title: 'All neighbors outside',
        puzzle: outsidePuzzle,
        before: [
          {
            kind: 'cell',
            cellKey: cellKey(0, 1),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(2, 1),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 0),
            fromFill: null,
            toFill: 'yellow',
          },
          {
            kind: 'cell',
            cellKey: cellKey(1, 2),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        after: [
          {
            kind: 'cell',
            cellKey: cellKey(1, 1),
            fromFill: null,
            toFill: 'yellow',
          },
        ],
        explanation:
          'Every orthogonal neighbor is outside, so the center cell must also be outside.',
      },
    ],
  }
}

const createPreventPrematureLoopExample = (): RuleExampleData => {
  const puzzle = createSlitherPuzzle(3, 6)
  const top = edgeKey([1, 0], [1, 1])
  const right = edgeKey([1, 1], [2, 1])
  const bottom = edgeKey([2, 0], [2, 1])
  const closing = edgeKey([1, 0], [2, 0])
  const other = edgeKey([3, 2], [3, 6])

  return example({
    id: 'closing-edge-blank',
    puzzle,
    before: [
      { kind: 'edge', edgeKey: top, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: right, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: bottom, from: 'unknown', to: 'line' },
      { kind: 'edge', edgeKey: other, from: 'unknown', to: 'line' },
    ],
    after: [{ kind: 'edge', edgeKey: closing, from: 'unknown', to: 'blank' }],
    explanation:
      'The three drawn edges already connect both endpoints through another path, the remaining edge would close a smaller loop, considering we have another known lines.',
  })
}

export const ruleExamples: Record<string, RuleExampleData> = {
  'masyu:white-pearl-rule': createWhitePearlExample(),
  'masyu:black-pearl-rule': createBlackPearlExample(),
  'slitherlink:vertex-degree': createVertexDegreeExample(),
  'slitherlink:sector-constraint-edge-propagation':
    createSectorConstraintEdgePropagationExample(),
  'slitherlink:contiguous-three-run-boundaries': createAdjacentThreesExample(),
  'slitherlink:diagonal-adjacent-three-outer-corners':
    createDiagonalThreesExample(),
  'slitherlink:cell-count-completion': createCellClueCompletionExample(),
  'slitherlink:adjacent-two-three-opposite-cross':
    createAdjacentTwoThreeOppositeCrossExample(),
  'slitherlink:color-edge-propagation': createColorEdgePropagationExample(),
  'slitherlink:color-outside-seeding': createColorOutsideSeedingExample(),
  'slitherlink:color-clue-propagation': createColorCluePropagationExample(),
  'slitherlink:color-sector-mask-propagation':
    createColorSectorMaskPropagationExample(),
  'slitherlink:color-orthogonal-consensus-propagation':
    createColorOrthogonalConsensusPropagationExample(),
  'slitherlink:prevent-premature-loop': createPreventPrematureLoopExample(),
}
