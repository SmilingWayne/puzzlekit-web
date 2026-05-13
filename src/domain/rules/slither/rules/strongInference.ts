import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCornerEdgeKeys, getVertexIncidentEdges, parseSectorKey } from '../../../ir/keys'
import type { Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_ALL,
  sectorMaskSingleValue,
  type PuzzleIR,
} from '../../../ir/types'
import { applyEdgeAssumption, runTrialUntilFixpoint, type TrialResult } from './trial'
import { formatEdgeLabel, formatSectorKeyLabel, formatVertexLabel } from './shared'

// const STRONG_MAX_CANDIDATES = 1000
// const STRONG_MAX_TRIAL_STEPS = 2000
// const STRONG_MAX_MS = 1000
const STRONG_MAX_CANDIDATES = 200
const STRONG_MAX_TRIAL_STEPS = 50
const STRONG_MAX_MS = 3000

type StrongInferenceOptions = {
  maxCandidates?: number
  maxTrialSteps?: number
  maxMs?: number
}

type StrongCandidate =
  | {
      kind: 'sector-only-one'
      sectorKey: string
      row: number
      col: number
      edgeA: string
      edgeB: string
    }
  | {
      kind: 'vertex-two-choice'
      vertexRow: number
      vertexCol: number
      edgeA: string
      edgeB: string
    }
  | {
      kind: 'edge'
      edgeKey: string
    }

const collectStrongCandidates = (puzzle: PuzzleIR, maxCandidates: number): StrongCandidate[] => {
  const sectorCandidates: StrongCandidate[] = []
  const vertexCandidates: StrongCandidate[] = []
  const edgeCandidates: StrongCandidate[] = []
  const seenOnlyOneEdges = new Set<string>()
  const seenBinaryPairs = new Set<string>()
  const getPairKey = (edgeA: string, edgeB: string): string => [edgeA, edgeB].sort().join('|')

  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (sectorMaskSingleValue(mask) !== 1) {
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
    sectorCandidates.push({
      kind: 'sector-only-one',
      sectorKey: sectorKeyValue,
      row,
      col,
      edgeA,
      edgeB,
    })
    seenBinaryPairs.add(getPairKey(edgeA, edgeB))
    seenOnlyOneEdges.add(edgeA)
    seenOnlyOneEdges.add(edgeB)
  }

  for (let vertexRow = 0; vertexRow <= puzzle.rows; vertexRow += 1) {
    for (let vertexCol = 0; vertexCol <= puzzle.cols; vertexCol += 1) {
      const incident = getVertexIncidentEdges(vertexRow, vertexCol, puzzle.rows, puzzle.cols)
      if (incident.length < 3) {
        continue
      }
      const lineEdges: string[] = []
      const unknownEdges: string[] = []
      for (const edgeKeyValue of incident) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') {
          lineEdges.push(edgeKeyValue)
        } else if (mark === 'unknown') {
          unknownEdges.push(edgeKeyValue)
        }
      }
      if (lineEdges.length !== 1 || unknownEdges.length !== 2) {
        continue
      }
      const [edgeA, edgeB] = unknownEdges
      const pairKey = getPairKey(edgeA, edgeB)
      if (seenBinaryPairs.has(pairKey)) {
        continue
      }
      vertexCandidates.push({
        kind: 'vertex-two-choice',
        vertexRow,
        vertexCol,
        edgeA,
        edgeB,
      })
      seenBinaryPairs.add(pairKey)
    }
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    if (seenOnlyOneEdges.has(edgeKeyValue)) {
      continue
    }
    edgeCandidates.push({ kind: 'edge', edgeKey: edgeKeyValue })
  }

  return [...vertexCandidates, ...sectorCandidates, ...edgeCandidates].slice(0, maxCandidates)
}

type StrongCandidateBranch = {
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
    message: 'setup contradiction: this branch is already incompatible with the current edge state',
  },
})

const deriveProbeBudgets = (maxTrialSteps: number): number[] => {
  const cappedMax = Math.max(1, maxTrialSteps)
  const budgets = [24, 96, 384, cappedMax]
    .map((budget) => Math.min(budget, cappedMax))
    .filter((budget, index, arr) => arr.indexOf(budget) === index)
  return budgets.length > 0 ? budgets : [cappedMax]
}

const buildBinaryCandidateBranches = (
  puzzle: PuzzleIR,
  edgeA: string,
  edgeB: string,
): { branchA: PuzzleIR; branchB: PuzzleIR; branchAInfo: StrongCandidateBranch; branchBInfo: StrongCandidateBranch } => {
  const branchA = clonePuzzle(puzzle)
  const branchB = clonePuzzle(puzzle)

  const branchASetupOk = applyEdgeAssumption(branchA, edgeA, 'line') && applyEdgeAssumption(branchA, edgeB, 'blank')
  const branchBSetupOk = applyEdgeAssumption(branchB, edgeA, 'blank') && applyEdgeAssumption(branchB, edgeB, 'line')

  return {
    branchA,
    branchB,
    branchAInfo: {
      setupOk: branchASetupOk,
      diffs: [
        { kind: 'edge', edgeKey: edgeA, from: 'unknown', to: 'line' },
        { kind: 'edge', edgeKey: edgeB, from: 'unknown', to: 'blank' },
      ],
    },
    branchBInfo: {
      setupOk: branchBSetupOk,
      diffs: [
        { kind: 'edge', edgeKey: edgeA, from: 'unknown', to: 'blank' },
        { kind: 'edge', edgeKey: edgeB, from: 'unknown', to: 'line' },
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

const describeCandidate = (candidate: StrongCandidate): string => {
  if (candidate.kind === 'sector-only-one') {
    return `sector ${formatSectorKeyLabel(candidate.sectorKey)} must have exactly one line`
  }
  if (candidate.kind === 'vertex-two-choice') {
    return `vertex ${formatVertexLabel(candidate.vertexRow, candidate.vertexCol)} has two possible continuations`
  }
  return `${formatEdgeLabel(candidate.edgeKey)} is undecided`
}

const describeBranch = (diffs: RuleApplication['diffs']): string =>
  diffs
    .filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
    .map((diff) => `${formatEdgeLabel(diff.edgeKey)} ${diff.to}`)
    .join(', ')

const summarizeFixedDiffs = (diffs: RuleApplication['diffs']): string => {
  const edgeDiffs = diffs.filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
  if (edgeDiffs.length === 0) {
    return 'fixed no edges'
  }
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

export const createStrongInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: StrongInferenceOptions = {},
): Rule => ({
  id: 'strong-inference',
  name: 'Strong Inference (Conservative)',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectStrongCandidates(puzzle, options.maxCandidates ?? STRONG_MAX_CANDIDATES)
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? STRONG_MAX_MS)
    const maxTrialSteps = options.maxTrialSteps ?? STRONG_MAX_TRIAL_STEPS
    const probeBudgets = deriveProbeBudgets(maxTrialSteps)
    for (const budget of probeBudgets) {
      for (const candidate of candidates) {
        if (Date.now() > deadlineMs) {
          return null
        }

        let branchA: PuzzleIR
        let branchB: PuzzleIR
        let branchAInfo: StrongCandidateBranch
        let branchBInfo: StrongCandidateBranch

        if (candidate.kind === 'sector-only-one' || candidate.kind === 'vertex-two-choice') {
          ;({ branchA, branchB, branchAInfo, branchBInfo } = buildBinaryCandidateBranches(
            puzzle,
            candidate.edgeA,
            candidate.edgeB,
          ))
        } else {
          branchA = clonePuzzle(puzzle)
          branchB = clonePuzzle(puzzle)
          branchAInfo = {
            setupOk: applyEdgeAssumption(branchA, candidate.edgeKey, 'line'),
            diffs: [{ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'line' }],
          }
          branchBInfo = {
            setupOk: applyEdgeAssumption(branchB, candidate.edgeKey, 'blank'),
            diffs: [{ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'blank' }],
          }
        }

        const branchAResult = branchAInfo.setupOk
          ? runTrialUntilFixpoint(branchA, deterministicRules, budget, deadlineMs)
          : immediateContradictionResult(branchA)
        const branchBResult = branchBInfo.setupOk
          ? runTrialUntilFixpoint(branchB, deterministicRules, budget, deadlineMs)
          : immediateContradictionResult(branchB)

        if (branchAResult.timedOut || branchBResult.timedOut) {
          return null
        }
        if (branchAResult.contradiction !== branchBResult.contradiction) {
          const contradictionBranch = branchAResult.contradiction ? branchAInfo : branchBInfo
          const survivingBranch = branchAResult.contradiction ? branchBInfo : branchAInfo
          const diffs = survivingBranch.diffs.filter((diff) => {
            if (diff.kind !== 'edge') {
              return false
            }
            return (puzzle.edges[diff.edgeKey]?.mark ?? 'unknown') === 'unknown'
          })
          if (diffs.length === 0) {
            continue
          }

          return {
            message: `Strong inference: ${describeCandidate(candidate)}. The branch ${describeBranch(contradictionBranch.diffs)} contradicts the puzzle at probe budget ${budget}, so the alternative is forced and ${summarizeFixedDiffs(diffs)}. ${describeTrialBranch('A', branchAResult)}; ${describeTrialBranch('B', branchBResult)}.`,
            diffs,
            affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
            affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
          }
        }
        if (branchAResult.contradiction && branchBResult.contradiction) {
          continue
        }

        const diffs = collectSharedEdgeDiffs(puzzle, branchAResult.puzzle, branchBResult.puzzle)
        if (diffs.length === 0) {
          continue
        }

        return {
          message: `Strong inference: ${describeCandidate(candidate)}. Both branches lead to the same consequence at probe budget ${budget}, so ${summarizeFixedDiffs(diffs)}. ${describeTrialBranch('A', branchAResult)}; ${describeTrialBranch('B', branchBResult)}.`,
          diffs,
          affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
          affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
        }
      }
    }

    return null
  },
})
