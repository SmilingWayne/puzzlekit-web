import { bench, describe } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../domain/parsers/puzzlink'
import { buildPuzzleFromSteps, rewindPuzzleByStep, runNextRule } from '../../domain/rules/engine'
import { slitherRules } from '../../domain/rules/slither/rules'
import type { RuleStep } from '../../domain/rules/types'
import { createSlitherPuzzle } from '../../domain/ir/slither'

const SAMPLE_URL =
  'https://puzz.link/p?slither/18/10/i61ch28cg16dg122cg63bi3ah1di2dcg0bgb1bc6c8bchd8b6cd1cbg2cgb3ci1dh3ci18dg132bg72bg82bh36dg'

const initialPuzzle = decodeSlitherFromPuzzlink(SAMPLE_URL)

const collectSteps = (limit: number): { steps: RuleStep[] } => {
  const steps: RuleStep[] = []
  let puzzle = initialPuzzle
  for (let i = 1; i <= limit; i += 1) {
    const { nextPuzzle, step } = runNextRule(puzzle, slitherRules, i)
    if (!step) {
      break
    }
    steps.push(step)
    puzzle = nextPuzzle
  }
  return { steps }
}

const { steps } = collectSteps(80)
const pointer = steps.length
const currentPuzzle = buildPuzzleFromSteps(initialPuzzle, steps, pointer)
const stepToUndo = steps[pointer - 1]

const synthetic60 = createSlitherPuzzle(60, 60)
const syntheticEdgeKeys = Object.keys(synthetic60.edges)
const syntheticSteps: RuleStep[] = Array.from({ length: 2000 }, (_, index) => {
  const edge = syntheticEdgeKeys[index]
  return {
    id: `synthetic-step-${index + 1}`,
    ruleId: `synthetic-rule-${index % 24}`,
    ruleName: `Synthetic Rule ${index % 24}`,
    message: `synthetic step ${index + 1}`,
    diffs: [
      {
        kind: 'edge',
        edgeKey: edge,
        from: 'unknown',
        to: index % 2 === 0 ? 'line' : 'blank',
      },
    ],
    affectedCells: [],
    affectedEdges: [edge],
    affectedSectors: [],
    timestamp: index,
    durationMs: 1,
  }
})

describe('solver prev-step benchmark', () => {
  bench('rebuild prefix from initial puzzle', () => {
    buildPuzzleFromSteps(initialPuzzle, steps, pointer - 1)
  })

  bench('incremental rewind by one step', () => {
    rewindPuzzleByStep(currentPuzzle, stepToUndo)
  })
})

describe('60x60 replay benchmark', () => {
  bench('full rebuild to step 500', () => {
    buildPuzzleFromSteps(synthetic60, syntheticSteps, 500)
  })

  bench('full rebuild to step 1000', () => {
    buildPuzzleFromSteps(synthetic60, syntheticSteps, 1000)
  })

  bench('full rebuild to step 2000', () => {
    buildPuzzleFromSteps(synthetic60, syntheticSteps, 2000)
  })
})
