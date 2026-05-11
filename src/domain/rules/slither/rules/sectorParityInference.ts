import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCornerEdgeKeys, parseSectorKey } from '../../../ir/keys'
import type { Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_NOT_1,
  type EdgeMark,
  type PuzzleIR,
} from '../../../ir/types'
import { applyEdgeAssumption, runTrialUntilFixpoint } from './trial'
import { formatEdgeLabel, formatSectorKeyLabel } from './shared'

const SECTOR_PARITY_MAX_CANDIDATES = 200
const SECTOR_PARITY_MAX_TRIAL_STEPS = 120
const SECTOR_PARITY_MAX_MS = 3000

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
    for (const candidate of candidates) {
      if (Date.now() > deadlineMs) {
        break
      }

      const lineBranch = buildParityBranch(puzzle, candidate.edgeA, candidate.edgeB, 'line')
      const blankBranch = buildParityBranch(puzzle, candidate.edgeA, candidate.edgeB, 'blank')

      const lineResult = lineBranch.info.setupOk
        ? runTrialUntilFixpoint(
            lineBranch.branch,
            deterministicRules,
            options.maxTrialSteps ?? SECTOR_PARITY_MAX_TRIAL_STEPS,
            deadlineMs,
          )
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: lineBranch.branch }
      const blankResult = blankBranch.info.setupOk
        ? runTrialUntilFixpoint(
            blankBranch.branch,
            deterministicRules,
            options.maxTrialSteps ?? SECTOR_PARITY_MAX_TRIAL_STEPS,
            deadlineMs,
          )
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: blankBranch.branch }

      if (lineResult.timedOut || blankResult.timedOut) {
        break
      }
      if (lineResult.exhausted || blankResult.exhausted) {
        continue
      }

      const candidateLabel = formatSectorKeyLabel(candidate.sectorKey)
      if (lineResult.contradiction !== blankResult.contradiction) {
        const contradictionBranch = lineResult.contradiction ? lineBranch.info : blankBranch.info
        const survivingBranch = lineResult.contradiction ? blankBranch.info : lineBranch.info

        return {
          message: `Sector ${candidateLabel} cannot have exactly one line. The branch ${describeBranch(contradictionBranch.diffs)} contradicts the puzzle, so the other parity branch is forced and ${summarizeFixedDiffs(survivingBranch.diffs)}.`,
          diffs: survivingBranch.diffs,
          affectedCells: [cellKey(candidate.row, candidate.col)],
          affectedSectors: [candidate.sectorKey],
        }
      }

      const diffs = collectSharedEdgeDiffs(puzzle, lineResult.puzzle, blankResult.puzzle)
      if (diffs.length === 0) {
        continue
      }

      return {
        message: `Sector ${candidateLabel} cannot have exactly one line. Both parity branches lead to the same consequence, so ${summarizeFixedDiffs(diffs)}.`,
        diffs,
        affectedCells: [cellKey(candidate.row, candidate.col)],
        affectedSectors: [candidate.sectorKey],
      }
    }

    return null
  },
})
