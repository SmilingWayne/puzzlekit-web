import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCellEdgeKeys, sectorKey } from '../../../ir/keys'
import type { Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_ONLY_1,
  sectorMaskIsSingle,
  type PuzzleIR,
  type SectorCorner,
} from '../../../ir/types'
import { getCellNeighborKeys, isSlitherCellColor, oppositeSlitherCellColor, type SlitherCellColor } from './shared'
import { runTrialUntilFixpoint } from './trial'

const COLOR_ASSUMPTION_MAX_CANDIDATES = 120
const COLOR_ASSUMPTION_MAX_TRIAL_STEPS = 120
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

const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']

const collectColorAssumptionCandidates = (puzzle: PuzzleIR, maxCandidates: number): ColorAssumptionCandidate[] => {
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
  `candidate=cell(${candidate.row}, ${candidate.col})`

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

export const createColorAssumptionInferenceRule = (
  getDeterministicRules: () => Rule[],
  options: ColorAssumptionInferenceOptions = {},
): Rule => ({
  id: 'color-assumption-inference',
  name: 'Color Assumption Inference',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = getDeterministicRules()
    const candidates = collectColorAssumptionCandidates(
      puzzle,
      options.maxCandidates ?? COLOR_ASSUMPTION_MAX_CANDIDATES,
    )
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + (options.maxMs ?? COLOR_ASSUMPTION_MAX_MS)
    for (const candidate of candidates) {
      if (Date.now() > deadlineMs) {
        break
      }

      const greenBranch = clonePuzzle(puzzle)
      const yellowBranch = clonePuzzle(puzzle)
      const greenSetupOk = applyCellAssumption(greenBranch, candidate.cellKey, 'green')
      const yellowSetupOk = applyCellAssumption(yellowBranch, candidate.cellKey, 'yellow')

      const greenResult = greenSetupOk
        ? runTrialUntilFixpoint(
            greenBranch,
            deterministicRules,
            options.maxTrialSteps ?? COLOR_ASSUMPTION_MAX_TRIAL_STEPS,
            deadlineMs,
          )
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: greenBranch }
      const yellowResult = yellowSetupOk
        ? runTrialUntilFixpoint(
            yellowBranch,
            deterministicRules,
            options.maxTrialSteps ?? COLOR_ASSUMPTION_MAX_TRIAL_STEPS,
            deadlineMs,
          )
        : { contradiction: true, timedOut: false, exhausted: false, puzzle: yellowBranch }

      if (greenResult.timedOut || yellowResult.timedOut) {
        break
      }
      if (greenResult.exhausted || yellowResult.exhausted) {
        continue
      }
      if (greenResult.contradiction === yellowResult.contradiction) {
        continue
      }

      const failingColor: SlitherCellColor = greenResult.contradiction ? 'green' : 'yellow'
      const inferredColor = oppositeSlitherCellColor(failingColor)
      const diffs = getCellAssumptionDiff(puzzle, candidate, inferredColor)

      return {
        message: `Color assumption ${describeCandidate(candidate)} result=contradiction: ${failingColor} fails, so ${candidate.cellKey}=${inferredColor}.`,
        diffs,
        affectedCells: [candidate.cellKey],
      }
    }

    return null
  },
})
