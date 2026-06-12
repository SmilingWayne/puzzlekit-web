import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication, RuleRuntimeContext } from '../../types'
import { runMasyuTrialUntilFixpoint } from './trial'
import { getMasyuBlackPearlKeys } from './pearlSelectors'
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
import {
  buildMasyuStrongBranch,
  buildMasyuInferenceDetails,
  createMasyuStrongInferenceTracker,
  deriveMasyuStrongProbeBudgets,
  describeMasyuStrongTrialResult,
  immediateMasyuStrongContradictionResult,
  STRONG_MAX_CANDIDATES,
  STRONG_MAX_MS,
  STRONG_MAX_TRIAL_STEPS,
  type MasyuLineAssumption,
  type MasyuStrongInferenceOptions,
} from './strongInference'

type BlackPearlExitCandidate = {
  pearlKey: string
  direction: MasyuDirection
  firstLine: string
  secondLine: string
  oppositeLine: string | null
}

const isUndecidedBlackPearl = (puzzle: PuzzleIR, pearlKey: string): boolean =>
  Object.values(getMasyuIncidentDirectionalLines(puzzle, pearlKey)).some(
    (line) => line?.mark === 'unknown',
  )

const collectBlackPearlExitCandidates = (
  puzzle: PuzzleIR,
  maxCandidates: number,
): BlackPearlExitCandidate[] => {
  const candidates: BlackPearlExitCandidate[] = []
  for (const pearlKey of getMasyuBlackPearlKeys(puzzle)) {
    if (!isUndecidedBlackPearl(puzzle, pearlKey)) {
      continue
    }
    for (const direction of MASYU_DIRECTIONS) {
      const { first, second } = getMasyuTwoStepLine(puzzle, pearlKey, direction)
      if (!first || !second || first.mark !== 'unknown') {
        continue
      }
      const opposite = getMasyuDirectionalLine(
        puzzle,
        pearlKey,
        oppositeMasyuDirection(direction),
      )
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

const buildBranch = (
  puzzle: PuzzleIR,
  candidate: BlackPearlExitCandidate,
): ReturnType<typeof buildMasyuStrongBranch> => {
  const assumptions: MasyuLineAssumption[] = [
    [candidate.firstLine, 'line'],
    [candidate.secondLine, 'line'],
  ]
  if (candidate.oppositeLine) {
    assumptions.push([candidate.oppositeLine, 'blank'])
  }
  return buildMasyuStrongBranch(puzzle, assumptions)
}

export const createBlackPearlStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: MasyuStrongInferenceOptions = {},
): Rule => {
  const id = 'masyu-black-pearl-strong-inference'
  const name = 'Black Pearl Strong Inference'
  return {
    id,
    name,
    apply: (
      puzzle: PuzzleIR,
      runtimeContext?: RuleRuntimeContext,
    ): RuleApplication | null => {
      const deterministicRules = getDeterministicRules()
      const candidates = collectBlackPearlExitCandidates(
        puzzle,
        options.maxCandidates ?? STRONG_MAX_CANDIDATES,
      )
      const tracker = createMasyuStrongInferenceTracker(
        runtimeContext,
        id,
        name,
        candidates.length,
      )
      if (candidates.length === 0) {
        tracker.complete('miss')
        return null
      }

      const deadlineMs = Date.now() + (options.maxMs ?? STRONG_MAX_MS)
      const budgets = deriveMasyuStrongProbeBudgets(
        options.maxTrialSteps ?? STRONG_MAX_TRIAL_STEPS,
      )
      let eligibleCandidates: Set<BlackPearlExitCandidate> | null = null
      for (const budget of budgets) {
        const exhaustedCandidates = new Set<BlackPearlExitCandidate>()
        for (const candidate of candidates) {
          if (
            eligibleCandidates !== null &&
            !eligibleCandidates.has(candidate)
          ) {
            continue
          }
          if (Date.now() > deadlineMs) {
            tracker.complete('timeout')
            return null
          }

          const branch = buildBranch(puzzle, candidate)
          const result = branch.setupOk
            ? runMasyuTrialUntilFixpoint(
                branch.puzzle,
                deterministicRules,
                budget,
                deadlineMs,
              )
            : immediateMasyuStrongContradictionResult(branch.puzzle)
          tracker.recordProbe(result)
          if (result.timedOut) {
            tracker.complete('timeout')
            return null
          }
          if (!result.contradiction) {
            if (result.exhausted) {
              exhaustedCandidates.add(candidate)
            }
            continue
          }
          if (
            (puzzle.lines[candidate.firstLine]?.mark ?? 'unknown') !== 'unknown'
          ) {
            continue
          }

          const diffs: RuleApplication['diffs'] = [
            {
              kind: 'line',
              lineKey: candidate.firstLine,
              from: 'unknown',
              to: 'blank',
            },
          ]
          tracker.complete('hit', diffs.length)
          return {
            message:
              `Black Pearl Strong Inference: assuming ${formatMasyuCellKeyLabel(candidate.pearlKey)} exits ${candidate.direction} ` +
              `(${branch.setupDescription}) leads to ${describeMasyuStrongTrialResult(result)}, so ${formatMasyuLineLabel(
                candidate.firstLine,
              )} is crossed out.`,
            diffs,
            affectedCells: [candidate.pearlKey],
            affectedLines: [candidate.firstLine],
            inferenceDetails: buildMasyuInferenceDetails(
              puzzle,
              `Assume ${formatMasyuCellKeyLabel(candidate.pearlKey)} exits ${candidate.direction}`,
              branch,
              result,
              diffs,
            ),
          }
        }
        eligibleCandidates = exhaustedCandidates
        if (eligibleCandidates.size === 0) {
          break
        }
      }

      tracker.complete('miss')
      return null
    },
  }
}
