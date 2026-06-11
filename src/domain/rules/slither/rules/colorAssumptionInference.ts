import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCellEdgeKeys, sectorKey } from '../../../ir/keys'
import type { InferenceDetails, Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_ONLY_1,
  sectorMaskIsSingle,
  type PuzzleIR,
  type SectorCorner,
} from '../../../ir/types'
import {
  formatCellLabel,
  getCellNeighborKeys,
  getEdgeAdjacentCellKeys,
  isSlitherCellColor,
  oppositeSlitherCellColor,
  type SlitherCellColor,
} from './shared'
import { buildSlitherInferenceBranch, runTrialUntilFixpoint, type TrialResult } from './trial'

const COLOR_ASSUMPTION_MAX_CANDIDATES = 200
const COLOR_ASSUMPTION_MAX_TRIAL_STEPS = 50
const COLOR_ASSUMPTION_MAX_MS = 2000

type ColorAssumptionInferenceOptions = {
  maxCandidates?: number
  maxTrialSteps?: number
  maxMs?: number
}

type ColorAssumptionCandidate = {
  cellKey: string
  row: number
  col: number
  score: number
}

type ColorAssumptionCandidateSet = {
  candidates: ColorAssumptionCandidate[]
  rawCandidateCount: number
  componentCount: number
}

const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']

const collectRawColorAssumptionCandidates = (puzzle: PuzzleIR, maxCandidates: number): ColorAssumptionCandidate[] => {
  const candidates: ColorAssumptionCandidate[] = []

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      if (isSlitherCellColor(puzzle.cells[key]?.fill)) {
        continue
      }

      const neighbors = getCellNeighborKeys(puzzle, key)
      const coloredNeighborCount = neighbors.filter((neighbor) => isSlitherCellColor(puzzle.cells[neighbor]?.fill)).length
      if (coloredNeighborCount === 0) {
        continue
      }

      const knownEdgeCount = getCellEdgeKeys(row, col).filter(
        (edgeKeyValue) => (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown') !== 'unknown',
      ).length
      const sectorScore = corners.reduce((score, corner) => {
        const mask = puzzle.sectors[sectorKey(row, col, corner)]?.constraintsMask ?? SECTOR_MASK_ALL
        if (mask === SECTOR_MASK_ONLY_1) {
          return score + 4
        }
        if (sectorMaskIsSingle(mask)) {
          return score + 3
        }
        if (mask !== SECTOR_MASK_ALL) {
          return score + 1
        }
        return score
      }, 0)

      candidates.push({
        cellKey: key,
        row,
        col,
        score: knownEdgeCount * 10 + sectorScore * 5 + coloredNeighborCount,
      })
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.row - b.row || a.col - b.col)
    .slice(0, maxCandidates)
}

const compressColorAssumptionCandidates = (
  puzzle: PuzzleIR,
  candidates: ColorAssumptionCandidate[],
): ColorAssumptionCandidate[] => {
  type Parity = 0 | 1

  const parent = new Map<string, string>()
  const rank = new Map<string, number>()
  const parityToParent = new Map<string, Parity>()

  const ensureCell = (key: string): void => {
    if (parent.has(key)) {
      return
    }
    parent.set(key, key)
    rank.set(key, 0)
    parityToParent.set(key, 0)
  }

  const find = (key: string): { root: string; parity: Parity } => {
    ensureCell(key)
    const currentParent = parent.get(key)
    if (currentParent === undefined || currentParent === key) {
      return { root: key, parity: 0 }
    }

    const parentResult = find(currentParent)
    const currentParity = parityToParent.get(key) ?? 0
    const compressedParity = (currentParity ^ parentResult.parity) as Parity
    parent.set(key, parentResult.root)
    parityToParent.set(key, compressedParity)
    return { root: parentResult.root, parity: compressedParity }
  }

  const union = (cellA: string, cellB: string, relation: Parity): void => {
    const rootA = find(cellA)
    const rootB = find(cellB)
    if (rootA.root === rootB.root) {
      return
    }

    const mergedParity = (rootA.parity ^ rootB.parity ^ relation) as Parity
    const rankA = rank.get(rootA.root) ?? 0
    const rankB = rank.get(rootB.root) ?? 0
    if (rankA < rankB) {
      parent.set(rootA.root, rootB.root)
      parityToParent.set(rootA.root, mergedParity)
      return
    }

    parent.set(rootB.root, rootA.root)
    parityToParent.set(rootB.root, mergedParity)
    if (rankA === rankB) {
      rank.set(rootA.root, rankA + 1)
    }
  }

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      ensureCell(cellKey(row, col))
    }
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    const mark = edgeState?.mark ?? 'unknown'
    if (mark !== 'line' && mark !== 'blank') {
      continue
    }
    const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
    if (adjacentCells.length !== 2) {
      continue
    }
    union(adjacentCells[0], adjacentCells[1], mark === 'line' ? 1 : 0)
  }

  const representatives = new Map<string, ColorAssumptionCandidate>()
  for (const candidate of candidates) {
    const { root } = find(candidate.cellKey)
    const current = representatives.get(root)
    if (
      current === undefined ||
      candidate.score > current.score ||
      (candidate.score === current.score && (candidate.row < current.row || (candidate.row === current.row && candidate.col < current.col)))
    ) {
      representatives.set(root, candidate)
    }
  }

  return [...representatives.values()].sort((a, b) => b.score - a.score || a.row - b.row || a.col - b.col)
}

const collectColorAssumptionCandidates = (puzzle: PuzzleIR, maxCandidates: number): ColorAssumptionCandidateSet => {
  const rawCandidates = collectRawColorAssumptionCandidates(puzzle, maxCandidates)
  const candidates = compressColorAssumptionCandidates(puzzle, rawCandidates)
  return {
    candidates,
    rawCandidateCount: rawCandidates.length,
    componentCount: candidates.length,
  }
}

const applyCellAssumption = (puzzle: PuzzleIR, key: string, toFill: SlitherCellColor): boolean => {
  const currentFill = puzzle.cells[key]?.fill
  if (isSlitherCellColor(currentFill)) {
    return currentFill === toFill
  }
  puzzle.cells[key] = {
    ...(puzzle.cells[key] ?? {}),
    fill: toFill,
  }
  return true
}

const describeCandidate = (candidate: ColorAssumptionCandidate): string =>
  formatCellLabel(candidate.row, candidate.col)

const getCellAssumptionDiff = (
  puzzle: PuzzleIR,
  candidate: ColorAssumptionCandidate,
  toFill: SlitherCellColor,
): RuleApplication['diffs'] => [
  {
    kind: 'cell',
    cellKey: candidate.cellKey,
    fromFill: (puzzle.cells[candidate.cellKey]?.fill ?? null) as string | null,
    toFill,
  },
]

const immediateContradictionResult = (puzzle: PuzzleIR): TrialResult => ({
  contradiction: true,
  timedOut: false,
  exhausted: false,
  puzzle,
  stepsRun: 0,
  elapsedMs: 0,
  contradictionReason: {
    kind: 'color-edge',
    message: 'setup contradiction: the assumed color is already incompatible with the current cell state',
  },
  traceSteps: [],
})

const buildInferenceDetails = (
  puzzle: PuzzleIR,
  candidate: ColorAssumptionCandidate,
  greenResult: TrialResult,
  yellowResult: TrialResult,
): InferenceDetails => ({
  kind: 'slither-color-assumption',
  conclusion: 'opposite-branch',
  basePuzzle: clonePuzzle(puzzle),
  defaultBranchId: greenResult.contradiction ? 'green' : 'yellow',
  branches: [
    buildSlitherInferenceBranch(
      'green',
      'Green assumption',
      getCellAssumptionDiff(puzzle, candidate, 'green'),
      greenResult,
    ),
    buildSlitherInferenceBranch(
      'yellow',
      'Yellow assumption',
      getCellAssumptionDiff(puzzle, candidate, 'yellow'),
      yellowResult,
    ),
  ],
})

const formatElapsedMs = (elapsedMs: number): string => `${Math.max(0, Math.round(elapsedMs))} ms`

const formatTrialStepCount = (stepsRun: number): string =>
  `${stepsRun} trial ${stepsRun === 1 ? 'step' : 'steps'}`

const describeTrialBranch = (color: SlitherCellColor, result: TrialResult): string =>
  `${color} branch: ${result.stepsRun} ${result.stepsRun === 1 ? 'step' : 'steps'}, ${formatElapsedMs(result.elapsedMs)}`

const describeContradiction = (result: TrialResult): string =>
  result.contradictionReason?.message ?? 'a contradiction'

const deriveProbeBudgets = (maxTrialSteps: number): number[] => {
  const cappedMax = Math.max(1, maxTrialSteps)
  const budgets = [24, 96, 384, cappedMax]
    .map((budget) => Math.min(budget, cappedMax))
    .filter((budget, index, arr) => arr.indexOf(budget) === index)
  return budgets.length > 0 ? budgets : [cappedMax]
}

const describeProbeBranch = (color: SlitherCellColor, result: TrialResult): string => {
  if (result.contradiction) {
    return describeTrialBranch(color, result)
  }
  return `${color} branch: unresolved after ${result.stepsRun} ${result.stepsRun === 1 ? 'step' : 'steps'}, ${formatElapsedMs(result.elapsedMs)}`
}

export const createColorAssumptionInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: ColorAssumptionInferenceOptions = {},
): Rule => ({
  id: 'color-assumption-inference',
  name: 'Color Assumption Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidateSet = collectColorAssumptionCandidates(
      puzzle,
      options.maxCandidates ?? COLOR_ASSUMPTION_MAX_CANDIDATES,
    )
    const { candidates, rawCandidateCount, componentCount } = candidateSet
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? COLOR_ASSUMPTION_MAX_MS)
    const maxTrialSteps = options.maxTrialSteps ?? COLOR_ASSUMPTION_MAX_TRIAL_STEPS
    const probeBudgets = deriveProbeBudgets(maxTrialSteps)

    for (const budget of probeBudgets) {
      let componentsSearched = 0
      for (const candidate of candidates) {
        if (Date.now() > deadlineMs) {
          return null
        }
        componentsSearched += 1

        const greenBranch = clonePuzzle(puzzle)
        const yellowBranch = clonePuzzle(puzzle)
        const greenSetupOk = applyCellAssumption(greenBranch, candidate.cellKey, 'green')
        const yellowSetupOk = applyCellAssumption(yellowBranch, candidate.cellKey, 'yellow')

        const greenResult = greenSetupOk
          ? runTrialUntilFixpoint(greenBranch, deterministicRules, budget, deadlineMs)
          : immediateContradictionResult(greenBranch)
        const yellowResult = yellowSetupOk
          ? runTrialUntilFixpoint(yellowBranch, deterministicRules, budget, deadlineMs)
          : immediateContradictionResult(yellowBranch)

        if (greenResult.timedOut || yellowResult.timedOut) {
          return null
        }
        if (greenResult.contradiction === yellowResult.contradiction) {
          continue
        }

        const failingColor: SlitherCellColor = greenResult.contradiction ? 'green' : 'yellow'
        const inferredColor = oppositeSlitherCellColor(failingColor)
        const failingResult = failingColor === 'green' ? greenResult : yellowResult
        const diffs = getCellAssumptionDiff(puzzle, candidate, inferredColor)

        return {
          message: `Assume ${describeCandidate(candidate)} is ${failingColor}; after ${formatTrialStepCount(failingResult.stepsRun)} / ${formatElapsedMs(failingResult.elapsedMs)}, deterministic propagation reaches ${describeContradiction(failingResult)}, so ${describeCandidate(candidate)} must be ${inferredColor}. Searched ${componentsSearched} candidate ${componentsSearched === 1 ? 'component' : 'components'} from ${rawCandidateCount} candidate ${rawCandidateCount === 1 ? 'cell' : 'cells'} at probe budget ${budget}; compressed to ${componentCount} ${componentCount === 1 ? 'component' : 'components'}; ${describeProbeBranch('green', greenResult)}; ${describeProbeBranch('yellow', yellowResult)}.`,
          diffs,
          affectedCells: [candidate.cellKey],
          inferenceDetails: buildInferenceDetails(puzzle, candidate, greenResult, yellowResult),
        }
      }
    }

    return null
  },
})
