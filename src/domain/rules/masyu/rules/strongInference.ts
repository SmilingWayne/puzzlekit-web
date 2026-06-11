import { clonePuzzle } from '../../../ir/normalize'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { InferenceDetails, RuleApplication } from '../../types'
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
  assumptionDiffs: RuleApplication['diffs']
}

export type MasyuLineAssumption = [lineKey: string, mark: LineMark]

export const STRONG_MAX_CANDIDATES = 300
export const STRONG_MAX_TRIAL_STEPS = 100
export const STRONG_MAX_MS = 30000

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

  return {
    puzzle: branch,
    setupOk,
    setupDescription,
    assumptionDiffs: assumptions.map(([lineKeyValue, mark]) => ({
      kind: 'line',
      lineKey: lineKeyValue,
      from: puzzle.lines[lineKeyValue]?.mark ?? 'unknown',
      to: mark,
    })),
  }
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
    lines: [],
  },
  traceSteps: [],
})

export const buildMasyuInferenceDetails = (
  puzzle: PuzzleIR,
  branchLabel: string,
  branch: MasyuStrongBranch,
  result: MasyuTrialResult,
  conclusionDiffs: RuleApplication['diffs'],
): InferenceDetails => {
  const contradiction =
    result.contradictionReason?.kind === 'line-assumption'
      ? {
          ...result.contradictionReason,
          lines: branch.assumptionDiffs.flatMap((diff) =>
            diff.kind === 'line' ? [diff.lineKey] : [],
          ),
        }
      : result.contradictionReason
  return {
    kind: 'masyu-strong',
    conclusion: 'opposite-branch',
    basePuzzle: clonePuzzle(puzzle),
    defaultBranchId: 'assumption',
    branches: [
      {
        id: 'assumption',
        label: branchLabel,
        role: 'trial',
        initialDiffs: branch.assumptionDiffs,
        status: result.contradiction
          ? 'contradiction'
          : result.exhausted
            ? 'exhausted'
            : 'unresolved',
        traceSteps: result.traceSteps,
        contradiction,
      },
      {
        id: 'conclusion',
        label: 'Forced conclusion',
        role: 'forced-conclusion',
        initialDiffs: conclusionDiffs,
        status: 'forced',
        traceSteps: [],
      },
    ],
  }
}

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
