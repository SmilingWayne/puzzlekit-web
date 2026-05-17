import { clonePuzzle } from '../../../ir/normalize'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  applyMasyuLineAssumption,
  runMasyuTrialUntilFixpoint,
  type MasyuTrialResult,
} from './trial'
import {
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionalLine,
  getMasyuIncidentDirectionalLines,
  getMasyuTwoStepLine,
  MASYU_DIRECTIONS,
  oppositeMasyuDirection,
  type MasyuDirection,
} from './shared'

const STRONG_MAX_CANDIDATES = 200
const STRONG_MAX_TRIAL_STEPS = 60
const STRONG_MAX_MS = 4000

type BlackPearlStrongInferenceOptions = {
  maxCandidates?: number
  maxTrialSteps?: number
  maxMs?: number
}

type BlackPearlExitCandidate = {
  pearlKey: string
  direction: MasyuDirection
  firstLine: string
  secondLine: string
  oppositeLine: string | null
}

type StrongBranch = {
  puzzle: PuzzleIR
  setupOk: boolean
  setupDescription: string
}

const deriveProbeBudgets = (maxTrialSteps: number): number[] => {
  const cappedMax = Math.max(1, maxTrialSteps)
  return [12, 36, cappedMax]
    .map((budget) => Math.min(budget, cappedMax))
    .filter((budget, index, arr) => arr.indexOf(budget) === index)
}

const isUndecidedBlackPearl = (puzzle: PuzzleIR, pearlKey: string): boolean =>
  Object.values(getMasyuIncidentDirectionalLines(puzzle, pearlKey)).some((line) => line?.mark === 'unknown')

const collectBlackPearlExitCandidates = (puzzle: PuzzleIR, maxCandidates: number): BlackPearlExitCandidate[] => {
  const candidates: BlackPearlExitCandidate[] = []
  for (const [pearlKey, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'pearl' || cell.clue.color !== 'black' || !isUndecidedBlackPearl(puzzle, pearlKey)) {
      continue
    }
    for (const direction of MASYU_DIRECTIONS) {
      const { first, second } = getMasyuTwoStepLine(puzzle, pearlKey, direction)
      if (!first || !second || first.mark !== 'unknown') {
        continue
      }
      const opposite = getMasyuDirectionalLine(puzzle, pearlKey, oppositeMasyuDirection(direction))
      candidates.push({
        pearlKey,
        direction,
        firstLine: first.lineKey,
        secondLine: second.lineKey,
        oppositeLine: opposite?.lineKey ?? null,
      })
      if (candidates.length >= maxCandidates) {
        return candidates
      }
    }
  }
  return candidates
}

const buildBranch = (puzzle: PuzzleIR, candidate: BlackPearlExitCandidate): StrongBranch => {
  const branch = clonePuzzle(puzzle)
  const assumptions: Array<[lineKey: string, mark: 'line' | 'blank']> = [
    [candidate.firstLine, 'line'],
    [candidate.secondLine, 'line'],
  ]
  if (candidate.oppositeLine) {
    assumptions.push([candidate.oppositeLine, 'blank'])
  }

  let setupOk = true
  for (const [lineKeyValue, mark] of assumptions) {
    setupOk = applyMasyuLineAssumption(branch, lineKeyValue, mark) && setupOk
  }

  const setupDescription = assumptions
    .map(([lineKeyValue, mark]) => `${formatMasyuLineLabel(lineKeyValue)} ${mark}`)
    .join(', ')

  return { puzzle: branch, setupOk, setupDescription }
}

const immediateContradictionResult = (puzzle: PuzzleIR): MasyuTrialResult => ({
  contradiction: true,
  timedOut: false,
  exhausted: false,
  puzzle,
  stepsRun: 0,
  elapsedMs: 0,
  contradictionReason: {
    kind: 'line-assumption',
    message: 'line-assumption contradiction: this exit assumption conflicts with an already decided Masyu line',
  },
})

const describeTrialResult = (result: MasyuTrialResult): string => {
  if (result.contradiction) {
    return `${result.contradictionReason?.message ?? 'a contradiction'} after ${result.stepsRun} ${
      result.stepsRun === 1 ? 'step' : 'steps'
    }`
  }
  if (result.exhausted) {
    return `no contradiction within ${result.stepsRun} trial steps`
  }
  return `no contradiction after ${result.stepsRun} ${result.stepsRun === 1 ? 'step' : 'steps'}`
}

export const createBlackPearlStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: BlackPearlStrongInferenceOptions = {},
): Rule => ({
  id: 'masyu-black-pearl-strong-inference',
  name: 'Black Pearl Strong Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectBlackPearlExitCandidates(puzzle, options.maxCandidates ?? STRONG_MAX_CANDIDATES)
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? STRONG_MAX_MS)
    const budgets = deriveProbeBudgets(options.maxTrialSteps ?? STRONG_MAX_TRIAL_STEPS)
    for (const budget of budgets) {
      for (const candidate of candidates) {
        if (Date.now() > deadlineMs) {
          return null
        }

        const branch = buildBranch(puzzle, candidate)
        const result = branch.setupOk
          ? runMasyuTrialUntilFixpoint(branch.puzzle, deterministicRules, budget, deadlineMs)
          : immediateContradictionResult(branch.puzzle)
        if (result.timedOut) {
          return null
        }
        if (!result.contradiction) {
          continue
        }
        if ((puzzle.lines[candidate.firstLine]?.mark ?? 'unknown') !== 'unknown') {
          continue
        }

        return {
          message:
            `Black Pearl Strong Inference: assuming ${formatMasyuCellKeyLabel(candidate.pearlKey)} exits ${candidate.direction} ` +
            `(${branch.setupDescription}) leads to ${describeTrialResult(result)}, so ${formatMasyuLineLabel(
              candidate.firstLine,
            )} is crossed out.`,
          diffs: [
            {
              kind: 'line',
              lineKey: candidate.firstLine,
              from: 'unknown',
              to: 'blank',
            },
          ],
          affectedCells: [candidate.pearlKey],
          affectedLines: [candidate.firstLine],
        }
      }
    }

    return null
  },
})
