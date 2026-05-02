import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCornerEdgeKeys, getVertexIncidentEdges, parseSectorKey } from '../../../ir/keys'
import type { Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_ALL,
  sectorMaskSingleValue,
  type PuzzleIR,
} from '../../../ir/types'
import { applyEdgeAssumption, runTrialUntilFixpoint } from './trial'

// const STRONG_MAX_CANDIDATES = 1000
// const STRONG_MAX_TRIAL_STEPS = 2000
// const STRONG_MAX_MS = 1000
const STRONG_MAX_CANDIDATES = 200
const STRONG_MAX_TRIAL_STEPS = 120
const STRONG_MAX_MS = 2000

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
    return `candidate=sector-only-one(${candidate.sectorKey})`
  }
  if (candidate.kind === 'vertex-two-choice') {
    return `candidate=vertex-two-choice((${candidate.vertexRow}, ${candidate.vertexCol}))`
  }
  return `candidate=edge(${candidate.edgeKey})`
}

const describeBranch = (diffs: RuleApplication['diffs']): string =>
  diffs
    .filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
    .map((diff) => `${diff.edgeKey}=${diff.to}`)
    .join(', ')

const summarizeFixedDiffs = (diffs: RuleApplication['diffs']): string => {
  const edgeDiffs = diffs.filter((diff): diff is Extract<(typeof diffs)[number], { kind: 'edge' }> => diff.kind === 'edge')
  if (edgeDiffs.length === 0) {
    return 'fixed no edges'
  }
  if (edgeDiffs.length <= 3) {
    return `fixed ${edgeDiffs.map((diff) => `${diff.edgeKey}=${diff.to}`).join(', ')}`
  }
  const preview = edgeDiffs
    .slice(0, 3)
    .map((diff) => `${diff.edgeKey}=${diff.to}`)
    .join(', ')
  return `fixed ${edgeDiffs.length} edges (${preview}, ...)`
}

export const createStrongInferenceRule = (getDeterministicRules: () => Rule[]): Rule => ({
  id: 'strong-inference',
  name: 'Strong Inference (Conservative)',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectStrongCandidates(puzzle, STRONG_MAX_CANDIDATES)
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + STRONG_MAX_MS
    for (const candidate of candidates) {
      if (Date.now() > deadlineMs) {
        break
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
        ? runTrialUntilFixpoint(branchA, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: branchA }
      const branchBResult = branchBInfo.setupOk
        ? runTrialUntilFixpoint(branchB, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: branchB }

      if (branchAResult.timedOut || branchBResult.timedOut) {
        break
      }
      if (branchAResult.exhausted || branchBResult.exhausted) {
        continue
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
          message: `Strong inference ${describeCandidate(candidate)} result=contradiction: branch ${describeBranch(contradictionBranch.diffs)} fails, so ${summarizeFixedDiffs(diffs)}.`,
          diffs,
          affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
          affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
        }
      }

      const diffs = collectSharedEdgeDiffs(puzzle, branchAResult.puzzle, branchBResult.puzzle)
      if (diffs.length === 0) {
        continue
      }

      return {
        message: `Strong inference ${describeCandidate(candidate)} result=shared-consequence: both branches agree and ${summarizeFixedDiffs(diffs)}.`,
        diffs,
        affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
        affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
      }
    }

    return null
  },
})
