import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCornerEdgeKeys, parseSectorKey } from '../../../ir/keys'
import type { InferenceDetails, Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_NOT_1,
  type EdgeMark,
  type PuzzleIR,
} from '../../../ir/types'
import { applyEdgeAssumption, buildSlitherInferenceBranch, runTrialUntilFixpoint, type TrialResult } from './trial'
import { formatEdgeLabel, formatSectorKeyLabel } from './shared'

const SECTOR_PARITY_MAX_CANDIDATES = 200
const SECTOR_PARITY_MAX_TRIAL_STEPS = 50
const SECTOR_PARITY_MAX_MS = 2000

type SectorParityInferenceOptions = {
  maxCandidates?: number
  maxTrialSteps?: number
  maxMs?: number
}

type SectorParityCandidate = {
  sectorKey: string
  row: number
  col: number
  edgeA: string
  edgeB: string
}

type SectorParityBranch = {
  setupOk: boolean
  diffs: RuleApplication['diffs']
}

const immediateContradictionResult = (puzzle: PuzzleIR): TrialResult => ({
  contradiction: true,
  timedOut: false,
  exhausted: false,
  puzzle,
  stepsRun: 0,
  elapsedMs: 0,
  contradictionReason: {
    kind: 'sector-mask',
    message: 'setup contradiction: this parity branch is already incompatible with the current edge state',
  },
  traceSteps: [],
})

const buildInferenceDetails = (
  puzzle: PuzzleIR,
  conclusion: InferenceDetails['conclusion'],
  lineBranch: SectorParityBranch,
  lineResult: TrialResult,
  blankBranch: SectorParityBranch,
  blankResult: TrialResult,
): InferenceDetails => ({
  kind: 'slither-sector-parity',
  conclusion,
  basePuzzle: clonePuzzle(puzzle),
  defaultBranchId:
    lineResult.contradiction !== blankResult.contradiction
      ? lineResult.contradiction
        ? 'line'
        : 'blank'
      : 'line',
  branches: [
    buildSlitherInferenceBranch('line', 'Line parity branch', lineBranch.diffs, lineResult),
    buildSlitherInferenceBranch('blank', 'Blank parity branch', blankBranch.diffs, blankResult),
  ],
})

const deriveProbeBudgets = (maxTrialSteps: number): number[] => {
  const cappedMax = Math.max(1, maxTrialSteps)
  const budgets = [24, 96, 384, cappedMax]
    .map((budget) => Math.min(budget, cappedMax))
    .filter((budget, index, arr) => arr.indexOf(budget) === index)
  return budgets.length > 0 ? budgets : [cappedMax]
}

const collectSectorParityCandidates = (puzzle: PuzzleIR, maxCandidates: number): SectorParityCandidate[] => {
  const candidates: SectorParityCandidate[] = []

  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    if ((sectorState?.constraintsMask ?? 0) !== SECTOR_MASK_NOT_1) {
      continue
    }
    const [row, col, corner] = parseSectorKey(sectorKeyValue)
    const [edgeA, edgeB] = getCornerEdgeKeys(row, col, corner)
    if ((puzzle.edges[edgeA]?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    if ((puzzle.edges[edgeB]?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    candidates.push({
      sectorKey: sectorKeyValue,
      row,
      col,
      edgeA,
      edgeB,
    })
  }

  return candidates.slice(0, maxCandidates)
}

const buildParityBranch = (
  puzzle: PuzzleIR,
  edgeA: string,
  edgeB: string,
  to: EdgeMark,
): { branch: PuzzleIR; info: SectorParityBranch } => {
  const branch = clonePuzzle(puzzle)
  const setupOk = applyEdgeAssumption(branch, edgeA, to) && applyEdgeAssumption(branch, edgeB, to)

  return {
    branch,
    info: {
      setupOk,
      diffs: [
        { kind: 'edge', edgeKey: edgeA, from: 'unknown', to },
        { kind: 'edge', edgeKey: edgeB, from: 'unknown', to },
      ],
    },
  }
}

const collectSharedEdgeDiffs = (basePuzzle: PuzzleIR, branchA: PuzzleIR, branchB: PuzzleIR): RuleApplication['diffs'] => {
  const diffs: RuleApplication['diffs'] = []
  for (const [edgeKeyValue, edgeState] of Object.entries(basePuzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    const branchAMark = branchA.edges[edgeKeyValue]?.mark ?? 'unknown'
    const branchBMark = branchB.edges[edgeKeyValue]?.mark ?? 'unknown'
    if (branchAMark === 'unknown' || branchAMark !== branchBMark) {
      continue
    }
    diffs.push({
      kind: 'edge',
      edgeKey: edgeKeyValue,
      from: 'unknown',
      to: branchAMark,
    })
  }
  return diffs
}

const describeBranch = (diffs: RuleApplication['diffs']): string =>
  diffs
    .filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
    .map((diff) => `${formatEdgeLabel(diff.edgeKey)} ${diff.to}`)
    .join(', ')

const summarizeFixedDiffs = (diffs: RuleApplication['diffs']): string => {
  const edgeDiffs = diffs.filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
  if (edgeDiffs.length <= 3) {
    return `fixed ${edgeDiffs.map((diff) => `${formatEdgeLabel(diff.edgeKey)} ${diff.to}`).join(', ')}`
  }
  const preview = edgeDiffs
    .slice(0, 3)
    .map((diff) => `${formatEdgeLabel(diff.edgeKey)} ${diff.to}`)
    .join(', ')
  return `fixed ${edgeDiffs.length} edges (${preview}, ...)`
}

const describeTrialBranch = (label: string, result: TrialResult): string => {
  if (result.contradiction) {
    return `${label} branch contradicted after ${result.stepsRun} ${result.stepsRun === 1 ? 'step' : 'steps'}`
  }
  return `${label} branch unresolved after ${result.stepsRun} ${result.stepsRun === 1 ? 'step' : 'steps'}`
}

export const createSectorParityInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: SectorParityInferenceOptions = {},
): Rule => ({
  id: 'sector-parity-inference',
  name: 'Sector Parity Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectSectorParityCandidates(
      puzzle,
      options.maxCandidates ?? SECTOR_PARITY_MAX_CANDIDATES,
    )
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? SECTOR_PARITY_MAX_MS)
    const maxTrialSteps = options.maxTrialSteps ?? SECTOR_PARITY_MAX_TRIAL_STEPS
    const probeBudgets = deriveProbeBudgets(maxTrialSteps)
    for (const budget of probeBudgets) {
      for (const candidate of candidates) {
        if (Date.now() > deadlineMs) {
          return null
        }

        const lineBranch = buildParityBranch(puzzle, candidate.edgeA, candidate.edgeB, 'line')
        const blankBranch = buildParityBranch(puzzle, candidate.edgeA, candidate.edgeB, 'blank')

        const lineResult = lineBranch.info.setupOk
          ? runTrialUntilFixpoint(
              lineBranch.branch,
              deterministicRules,
              budget,
              deadlineMs,
            )
          : immediateContradictionResult(lineBranch.branch)
        const blankResult = blankBranch.info.setupOk
          ? runTrialUntilFixpoint(
              blankBranch.branch,
              deterministicRules,
              budget,
              deadlineMs,
            )
          : immediateContradictionResult(blankBranch.branch)

        if (lineResult.timedOut || blankResult.timedOut) {
          return null
        }

        const candidateLabel = formatSectorKeyLabel(candidate.sectorKey)
        if (lineResult.contradiction !== blankResult.contradiction) {
          const contradictionBranch = lineResult.contradiction ? lineBranch.info : blankBranch.info
          const survivingBranch = lineResult.contradiction ? blankBranch.info : lineBranch.info

          return {
            message: `Sector ${candidateLabel} cannot have exactly one line. The branch ${describeBranch(contradictionBranch.diffs)} contradicts the puzzle at probe budget ${budget}, so the other parity branch is forced and ${summarizeFixedDiffs(survivingBranch.diffs)}. ${describeTrialBranch('line', lineResult)}; ${describeTrialBranch('blank', blankResult)}.`,
            diffs: survivingBranch.diffs,
            affectedCells: [cellKey(candidate.row, candidate.col)],
            affectedSectors: [candidate.sectorKey],
            inferenceDetails: buildInferenceDetails(
              puzzle,
              'opposite-branch',
              lineBranch.info,
              lineResult,
              blankBranch.info,
              blankResult,
            ),
          }
        }
        if (lineResult.contradiction && blankResult.contradiction) {
          continue
        }

        const diffs = collectSharedEdgeDiffs(puzzle, lineResult.puzzle, blankResult.puzzle)
        if (diffs.length === 0) {
          continue
        }

        return {
          message: `Sector ${candidateLabel} cannot have exactly one line. Both parity branches lead to the same consequence at probe budget ${budget}, so ${summarizeFixedDiffs(diffs)}. ${describeTrialBranch('line', lineResult)}; ${describeTrialBranch('blank', blankResult)}.`,
          diffs,
          affectedCells: [cellKey(candidate.row, candidate.col)],
          affectedSectors: [candidate.sectorKey],
          inferenceDetails: buildInferenceDetails(
            puzzle,
            'shared-consequence',
            lineBranch.info,
            lineResult,
            blankBranch.info,
            blankResult,
          ),
        }
      }
    }

    return null
  },
})
