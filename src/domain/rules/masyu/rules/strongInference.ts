import { clonePuzzle } from '../../../ir/normalize'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import {
  applyMasyuLineAssumption,
  type MasyuTrialResult,
} from './trial'
import { formatMasyuLineLabel } from './shared'

export type MasyuStrongInferenceOptions = {
  maxCandidates?: number
  maxTrialSteps?: number
  maxMs?: number
}

export type MasyuStrongBranch = {
  puzzle: PuzzleIR
  setupOk: boolean
  setupDescription: string
}

export type MasyuLineAssumption = [lineKey: string, mark: LineMark]

export const STRONG_MAX_CANDIDATES = 200
export const STRONG_MAX_TRIAL_STEPS = 100
export const STRONG_MAX_MS = 10000

export const deriveMasyuStrongProbeBudgets = (
  maxTrialSteps: number,
): number[] => {
  const cappedMax = Math.max(1, maxTrialSteps)
  return [12, 36, cappedMax]
    .map((budget) => Math.min(budget, cappedMax))
    .filter((budget, index, arr) => arr.indexOf(budget) === index)
}

export const buildMasyuStrongBranch = (
  puzzle: PuzzleIR,
  assumptions: MasyuLineAssumption[],
): MasyuStrongBranch => {
  const branch = clonePuzzle(puzzle)
  let setupOk = true
  for (const [lineKeyValue, mark] of assumptions) {
    setupOk = applyMasyuLineAssumption(branch, lineKeyValue, mark) && setupOk
  }

  const setupDescription = assumptions
    .map(
      ([lineKeyValue, mark]) => `${formatMasyuLineLabel(lineKeyValue)} ${mark}`,
    )
    .join(', ')

  return { puzzle: branch, setupOk, setupDescription }
}

export const immediateMasyuStrongContradictionResult = (
  puzzle: PuzzleIR,
): MasyuTrialResult => ({
  contradiction: true,
  timedOut: false,
  exhausted: false,
  puzzle,
  stepsRun: 0,
  elapsedMs: 0,
  contradictionReason: {
    kind: 'line-assumption',
    message:
      'line-assumption contradiction: this assumption conflicts with an already decided Masyu line',
  },
})

export const describeMasyuStrongTrialResult = (
  result: MasyuTrialResult,
): string => {
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
