import { cellKey, parseCellKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import { createMasyuLookaheadContext } from './lookahead'
import type { WhitePearlCandidate } from './pearlCandidates'
import { masyuPearlCandidateToOverlay } from './pearlCandidates'
import {
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionalLine,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
  type MasyuDirection,
} from './shared'
import {
  buildMasyuStrongBranch,
  buildMasyuInferenceDetails,
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

type WhitePearlAxisCandidate = {
  pearlKey: string
  candidates: [WhitePearlCandidate, WhitePearlCandidate]
  pearlNeighborCount: number
  decidedLocalLineCount: number
  order: number
}

const axisLabel = (axis: [MasyuDirection, MasyuDirection]): string =>
  axis[0] === 'N' || axis[0] === 'S' ? 'vertical' : 'horizontal'

const getNeighborPearlCount = (puzzle: PuzzleIR, pearlKey: string): number => {
  const [row, col] = parseCellKey(pearlKey)
  let count = 0
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) {
        continue
      }
      const nextRow = row + rowDelta
      const nextCol = col + colDelta
      if (
        nextRow < 0 ||
        nextRow >= puzzle.rows ||
        nextCol < 0 ||
        nextCol >= puzzle.cols
      ) {
        continue
      }
      const clue = puzzle.cells[cellKey(nextRow, nextCol)]?.clue
      if (clue?.kind === 'pearl') {
        count += 1
      }
    }
  }
  return count
}

const getDecidedLocalLineCount = (
  puzzle: PuzzleIR,
  pearlKey: string,
): number => {
  const localCells = new Set<string>([pearlKey])
  for (const direction of MASYU_DIRECTIONS) {
    const line = getMasyuDirectionalLine(puzzle, pearlKey, direction)
    if (line) {
      localCells.add(line.neighborKey)
    }
  }

  const localLines = new Set<string>()
  for (const key of localCells) {
    for (const line of Object.values(getMasyuIncidentDirectionalLines(puzzle, key))) {
      if (line) {
        localLines.add(line.lineKey)
      }
    }
  }

  return [...localLines].filter(
    (lineKeyValue) =>
      (puzzle.lines[lineKeyValue]?.mark ?? 'unknown') !== 'unknown',
  ).length
}

const collectWhitePearlAxisCandidates = (
  puzzle: PuzzleIR,
  maxCandidates: number,
): WhitePearlAxisCandidate[] => {
  const context = createMasyuLookaheadContext(puzzle)
  return context
    .getWhitePearlKeys()
    .flatMap((pearlKey, order): WhitePearlAxisCandidate[] => {
      const candidates = context.getFeasibleWhitePearlCandidates(pearlKey)
      if (candidates.length !== 2) {
        return []
      }
      return [
        {
          pearlKey,
          candidates: [candidates[0], candidates[1]],
          pearlNeighborCount: getNeighborPearlCount(puzzle, pearlKey),
          decidedLocalLineCount: getDecidedLocalLineCount(puzzle, pearlKey),
          order,
        },
      ]
    })
    .sort(
      (left, right) =>
        right.pearlNeighborCount - left.pearlNeighborCount ||
        right.decidedLocalLineCount - left.decidedLocalLineCount ||
        left.order - right.order,
    )
    .slice(0, maxCandidates)
}

const candidateAssumptions = (
  candidate: WhitePearlCandidate,
): MasyuLineAssumption[] => {
  const overlay = masyuPearlCandidateToOverlay(candidate)
  return overlay ? [...overlay.entries()] : []
}

const collectCandidateDiffs = (
  puzzle: PuzzleIR,
  candidate: WhitePearlCandidate,
): ReturnType<ReturnType<typeof createMasyuLineDecisionCollector>['diffs']> | null => {
  const overlay = masyuPearlCandidateToOverlay(candidate)
  if (!overlay) {
    return null
  }
  const decisions = createMasyuLineDecisionCollector(puzzle, {
    guardLineDegree: true,
  })
  for (const [lineKeyValue, mark] of overlay.entries()) {
    if (!decisions.add(lineKeyValue, mark)) {
      return null
    }
  }
  return decisions.hasChanges() ? decisions.diffs() : null
}

export const createWhitePearlStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: MasyuStrongInferenceOptions = {},
): Rule => ({
  id: 'masyu-white-pearl-strong-inference',
  name: 'White Pearl Strong Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectWhitePearlAxisCandidates(
      puzzle,
      options.maxCandidates ?? STRONG_MAX_CANDIDATES,
    )
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? STRONG_MAX_MS)
    const budgets = deriveMasyuStrongProbeBudgets(
      options.maxTrialSteps ?? STRONG_MAX_TRIAL_STEPS,
    )
    let eligibleTrialIndexes: Set<number> | null = null

    for (const budget of budgets) {
      const exhaustedTrialIndexes = new Set<number>()
      for (const [candidateIndex, pearlCandidate] of candidates.entries()) {
        if (Date.now() > deadlineMs) {
          return null
        }

        for (const assumedIndex of [0, 1] as const) {
          const trialIndex = candidateIndex * 2 + assumedIndex
          if (
            eligibleTrialIndexes !== null &&
            !eligibleTrialIndexes.has(trialIndex)
          ) {
            continue
          }
          const assumed = pearlCandidate.candidates[assumedIndex]
          const forced = pearlCandidate.candidates[assumedIndex === 0 ? 1 : 0]
          const assumptions = candidateAssumptions(assumed)
          if (assumptions.length === 0) {
            continue
          }
          const branch = buildMasyuStrongBranch(puzzle, assumptions)
          const result = branch.setupOk
            ? runMasyuTrialUntilFixpoint(
                branch.puzzle,
                deterministicRules,
                budget,
                deadlineMs,
              )
            : immediateMasyuStrongContradictionResult(branch.puzzle)
          if (result.timedOut) {
            return null
          }
          if (!result.contradiction) {
            if (result.exhausted) {
              exhaustedTrialIndexes.add(trialIndex)
            }
            continue
          }

          const diffs = collectCandidateDiffs(puzzle, forced)
          if (!diffs || diffs.length === 0) {
            continue
          }
          const firstLine = diffs[0]?.lineKey
          return {
            message:
              `White Pearl Strong Inference: assuming ${formatMasyuCellKeyLabel(pearlCandidate.pearlKey)} goes ${axisLabel(
                assumed.axis,
              )} (${branch.setupDescription}) leads to ${describeMasyuStrongTrialResult(
                result,
              )}, so it must go ${axisLabel(forced.axis)} through ${formatMasyuLineLabel(
                firstLine,
              )}${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`,
            diffs,
            affectedCells: [pearlCandidate.pearlKey],
            affectedLines: diffs.map((diff) => diff.lineKey),
            inferenceDetails: buildMasyuInferenceDetails(
              puzzle,
              `Assume ${formatMasyuCellKeyLabel(pearlCandidate.pearlKey)} goes ${axisLabel(assumed.axis)}`,
              branch,
              result,
              diffs,
            ),
          }
        }
      }
      eligibleTrialIndexes = exhaustedTrialIndexes
      if (eligibleTrialIndexes.size === 0) {
        break
      }
    }

    return null
  },
})
