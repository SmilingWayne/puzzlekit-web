import { cellKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import {
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
  type MasyuDirectionalLine,
} from './shared'
import {
  buildMasyuStrongBranch,
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

type EmptyCellStrongCandidate = {
  cell: string
  mode: 'continuation' | 'degree-zero'
  unknowns: [MasyuDirectionalLine, MasyuDirectionalLine]
}

type EmptyCellStrongBranch = {
  label: string
  assumptions: MasyuLineAssumption[]
  forced: MasyuLineAssumption[]
}

const collectEmptyCellStrongCandidates = (
  puzzle: PuzzleIR,
  maxCandidates: number,
): EmptyCellStrongCandidate[] => {
  const candidates: EmptyCellStrongCandidate[] = []
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      if (puzzle.cells[key]?.clue?.kind === 'pearl') {
        continue
      }

      const incidentByDirection = getMasyuIncidentDirectionalLines(puzzle, key)
      const incident = MASYU_DIRECTIONS.flatMap((direction) => {
        const item = incidentByDirection[direction]
        return item ? [item] : []
      })
      const lineCount = incident.filter((item) => item.mark === 'line').length
      const unknowns = incident.filter((item) => item.mark === 'unknown')
      if (unknowns.length !== 2 || (lineCount !== 0 && lineCount !== 1)) {
        continue
      }

      candidates.push({
        cell: key,
        mode: lineCount === 1 ? 'continuation' : 'degree-zero',
        unknowns: [unknowns[0], unknowns[1]],
      })
      if (candidates.length >= maxCandidates) {
        return candidates
      }
    }
  }
  return candidates
}

const buildBranches = (
  candidate: EmptyCellStrongCandidate,
): EmptyCellStrongBranch[] => {
  const [first, second] = candidate.unknowns
  if (candidate.mode === 'continuation') {
    return [
      {
        label: `${formatMasyuLineLabel(first.lineKey)} as the continuation`,
        assumptions: [
          [first.lineKey, 'line'],
          [second.lineKey, 'blank'],
        ],
        forced: [
          [second.lineKey, 'line'],
          [first.lineKey, 'blank'],
        ],
      },
      {
        label: `${formatMasyuLineLabel(second.lineKey)} as the continuation`,
        assumptions: [
          [second.lineKey, 'line'],
          [first.lineKey, 'blank'],
        ],
        forced: [
          [first.lineKey, 'line'],
          [second.lineKey, 'blank'],
        ],
      },
    ]
  }

  return [
    {
      label: 'using both remaining exits',
      assumptions: [
        [first.lineKey, 'line'],
        [second.lineKey, 'line'],
      ],
      forced: [
        [first.lineKey, 'blank'],
        [second.lineKey, 'blank'],
      ],
    },
    {
      label: 'using neither remaining exit',
      assumptions: [
        [first.lineKey, 'blank'],
        [second.lineKey, 'blank'],
      ],
      forced: [
        [first.lineKey, 'line'],
        [second.lineKey, 'line'],
      ],
    },
  ]
}

const collectForcedDiffs = (
  puzzle: PuzzleIR,
  forced: MasyuLineAssumption[],
): ReturnType<ReturnType<typeof createMasyuLineDecisionCollector>['diffs']> | null => {
  const decisions = createMasyuLineDecisionCollector(puzzle, {
    guardLineDegree: true,
  })
  for (const [lineKeyValue, mark] of forced) {
    if (!decisions.add(lineKeyValue, mark)) {
      return null
    }
  }
  return decisions.hasChanges() ? decisions.diffs() : null
}

const describeForced = (forced: MasyuLineAssumption[]): string => {
  const lineCount = forced.filter(([, mark]) => mark === 'line').length
  const blankCount = forced.filter(([, mark]) => mark === 'blank').length
  if (lineCount === 2) {
    return 'both remaining exits must be lines'
  }
  if (blankCount === 2) {
    return 'both remaining exits are crossed out'
  }
  const line = forced.find(([, mark]) => mark === 'line')?.[0]
  return line
    ? `${formatMasyuLineLabel(line)} must be the continuation`
    : forced
        .map(
          ([lineKeyValue, mark]) =>
            `${formatMasyuLineLabel(lineKeyValue)} ${mark}`,
        )
        .join(', ')
}

export const createEmptyCellStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: MasyuStrongInferenceOptions = {},
): Rule => ({
  id: 'masyu-empty-cell-strong-inference',
  name: 'Empty Cell Strong Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectEmptyCellStrongCandidates(
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

    for (const budget of budgets) {
      for (const candidate of candidates) {
        if (Date.now() > deadlineMs) {
          return null
        }

        for (const trialBranch of buildBranches(candidate)) {
          const branch = buildMasyuStrongBranch(
            puzzle,
            trialBranch.assumptions,
          )
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
            continue
          }

          const diffs = collectForcedDiffs(puzzle, trialBranch.forced)
          if (!diffs || diffs.length === 0) {
            continue
          }
          const firstLine = diffs[0]?.lineKey
          return {
            message:
              `Empty Cell Strong Inference: assuming ${formatMasyuCellKeyLabel(
                candidate.cell,
              )} is ${trialBranch.label} (${branch.setupDescription}) leads to ${describeMasyuStrongTrialResult(
                result,
              )}, so ${describeForced(trialBranch.forced)} through ${formatMasyuLineLabel(
                firstLine,
              )}${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`,
            diffs,
            affectedCells: [candidate.cell],
            affectedLines: diffs.map((diff) => diff.lineKey),
          }
        }
      }
    }

    return null
  },
})
