import { parseCellKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication, RuleRuntimeContext } from '../../types'
import { getMasyuOpenLineComponents } from './lineGraph'
import {
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
  type MasyuDirectionalLine,
} from './shared'
import {
  buildMasyuInferenceDetails,
  buildMasyuStrongBranch,
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
import { runMasyuTrialUntilFixpoint } from './trial'

const ENDPOINT_STRONG_MAX_CANDIDATES = 60
const ENDPOINT_STRONG_MAX_MS = 3000

type LineComponentEndpointCandidate = {
  endpointKey: string
  endpointOrder: number
  componentEdgeCount: number
  unknowns: MasyuDirectionalLine[]
  assumed: MasyuDirectionalLine
}

const collectLineComponentEndpointCandidates = (
  puzzle: PuzzleIR,
  maxCandidates: number,
): LineComponentEndpointCandidate[] =>
  getMasyuOpenLineComponents(puzzle)
    .flatMap((component) =>
      component.endpointKeys.flatMap((endpointKey) => {
        const [row, col] = parseCellKey(endpointKey)
        const unknowns = MASYU_DIRECTIONS.flatMap((direction) => {
          const line = getMasyuIncidentDirectionalLines(puzzle, endpointKey)[
            direction
          ]
          return line?.mark === 'unknown' ? [line] : []
        })
        if (unknowns.length < 2) {
          return []
        }
        return unknowns.map((assumed) => ({
          endpointKey,
          endpointOrder: row * puzzle.cols + col,
          componentEdgeCount: component.edgeCount,
          unknowns,
          assumed,
        }))
      }),
    )
    .sort(
      (left, right) =>
        left.unknowns.length - right.unknowns.length ||
        right.componentEdgeCount - left.componentEdgeCount ||
        left.endpointOrder - right.endpointOrder ||
        MASYU_DIRECTIONS.indexOf(left.assumed.direction) -
          MASYU_DIRECTIONS.indexOf(right.assumed.direction),
    )
    .slice(0, maxCandidates)

const buildCandidateAssumptions = (
  candidate: LineComponentEndpointCandidate,
): MasyuLineAssumption[] => [
  [candidate.assumed.lineKey, 'line'],
  ...candidate.unknowns
    .filter((line) => line.lineKey !== candidate.assumed.lineKey)
    .map((line): MasyuLineAssumption => [line.lineKey, 'blank']),
]

export const createLineComponentEndpointStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: MasyuStrongInferenceOptions = {},
): Rule => {
  const id = 'masyu-line-component-endpoint-strong-inference'
  const name = 'Masyu Line Component Endpoint Strong Inference'
  return {
    id,
    name,
    apply: (
      puzzle: PuzzleIR,
      runtimeContext?: RuleRuntimeContext,
    ): RuleApplication | null => {
      const candidates = collectLineComponentEndpointCandidates(
        puzzle,
        options.maxCandidates ??
          Math.min(ENDPOINT_STRONG_MAX_CANDIDATES, STRONG_MAX_CANDIDATES),
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

      const deterministicRules = getDeterministicRules()
      const deadlineMs =
        Date.now() +
        (options.maxMs ?? Math.min(ENDPOINT_STRONG_MAX_MS, STRONG_MAX_MS))
      const budgets = deriveMasyuStrongProbeBudgets(
        options.maxTrialSteps ?? STRONG_MAX_TRIAL_STEPS,
      )
      let eligibleCandidates: Set<LineComponentEndpointCandidate> | null = null

      for (const budget of budgets) {
        const exhaustedCandidates = new Set<LineComponentEndpointCandidate>()
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
          const branch = buildMasyuStrongBranch(
            puzzle,
            buildCandidateAssumptions(candidate),
          )
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

          const diffs: RuleApplication['diffs'] = [
            {
              kind: 'line',
              lineKey: candidate.assumed.lineKey,
              from: 'unknown',
              to: 'blank',
            },
          ]
          tracker.complete('hit', diffs.length)
          return {
            message: `Masyu Line Component Endpoint Strong Inference: assuming the ${candidate.componentEdgeCount}-segment component at ${formatMasyuCellKeyLabel(
              candidate.endpointKey,
            )} continues ${candidate.assumed.direction} among ${candidate.unknowns.length} candidate directions (${branch.setupDescription}) leads to ${describeMasyuStrongTrialResult(
              result,
            )}, so ${formatMasyuLineLabel(candidate.assumed.lineKey)} is crossed out.`,
            diffs,
            affectedCells: [candidate.endpointKey],
            affectedLines: [candidate.assumed.lineKey],
            inferenceDetails: buildMasyuInferenceDetails(
              puzzle,
              `Assume the ${candidate.componentEdgeCount}-segment component at ${formatMasyuCellKeyLabel(
                candidate.endpointKey,
              )} continues ${candidate.assumed.direction}`,
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
