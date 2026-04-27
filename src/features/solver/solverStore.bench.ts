import { bench, describe } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../domain/parsers/puzzlink'
import { buildPuzzleFromSteps, rewindPuzzleByStep, runNextRule } from '../../domain/rules/engine'
import { slitherRules } from '../../domain/rules/slither/rules'
import type { RuleStep } from '../../domain/rules/types'

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

describe('solver prev-step benchmark', () => {
  bench('rebuild prefix from initial puzzle', () => {
    buildPuzzleFromSteps(initialPuzzle, steps, pointer - 1)
  })

  bench('incremental rewind by one step', () => {
    rewindPuzzleByStep(currentPuzzle, stepToUndo)
  })
})
