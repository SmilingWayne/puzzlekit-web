import { clonePuzzle } from '../../../ir/normalize'
import { cellKey, getCellEdgeKeys, getCornerEdgeKeys, getVertexIncidentEdges, parseEdgeKey, parseSectorKey } from '../../../ir/keys'
import { runNextRule } from '../../engine'
import type { Rule, RuleApplication } from '../../types'
import {
  SECTOR_MASK_ALL,
  sectorMaskAllows,
  sectorMaskIsValid,
  sectorMaskSingleValue,
  type EdgeMark,
  type PuzzleIR,
} from '../../../ir/types'

// const STRONG_MAX_CANDIDATES = 1000
// const STRONG_MAX_TRIAL_STEPS = 2000
// const STRONG_MAX_MS = 1000
const STRONG_MAX_CANDIDATES = 200
const STRONG_MAX_TRIAL_STEPS = 120
const STRONG_MAX_MS = 60

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
      kind: 'edge'
      edgeKey: string
    }

const collectStrongCandidates = (puzzle: PuzzleIR, maxCandidates: number): StrongCandidate[] => {
  const candidates: StrongCandidate[] = []
  const seenOnlyOneEdges = new Set<string>()

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
    candidates.push({
      kind: 'sector-only-one',
      sectorKey: sectorKeyValue,
      row,
      col,
      edgeA,
      edgeB,
    })
    seenOnlyOneEdges.add(edgeA)
    seenOnlyOneEdges.add(edgeB)
    if (candidates.length >= maxCandidates) {
      return candidates
    }
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    if (seenOnlyOneEdges.has(edgeKeyValue)) {
      continue
    }
    candidates.push({ kind: 'edge', edgeKey: edgeKeyValue })
    if (candidates.length >= maxCandidates) {
      break
    }
  }

  return candidates
}

const applyEdgeAssumption = (puzzle: PuzzleIR, edgeKeyValue: string, to: EdgeMark): boolean => {
  const current = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown') {
    return current === to
  }
  puzzle.edges[edgeKeyValue].mark = to
  return true
}

const detectHardContradiction = (puzzle: PuzzleIR): boolean => {
  for (let r = 0; r <= puzzle.rows; r += 1) {
    for (let c = 0; c <= puzzle.cols; c += 1) {
      const incident = getVertexIncidentEdges(r, c, puzzle.rows, puzzle.cols)
      if (incident.length === 0) {
        continue
      }
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of incident) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > 2) {
        return true
      }
      if (unknownCount === 0 && lineCount !== 0 && lineCount !== 2) {
        return true
      }
    }
  }

  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const clue = puzzle.cells[cellKey(r, c)]?.clue
      if (clue?.kind !== 'number' || clue.value === '?') {
        continue
      }
      const target = Number(clue.value)
      const cellEdges = getCellEdgeKeys(r, c)
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of cellEdges) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > target || lineCount + unknownCount < target) {
        return true
      }
    }
  }

  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (!sectorMaskIsValid(mask)) {
      return true
    }
    const [row, col, corner] = parseSectorKey(sectorKeyValue)
    const sectorEdges = getCornerEdgeKeys(row, col, corner)
    let lineCount = 0
    let unknownCount = 0
    for (const edgeKeyValue of sectorEdges) {
      const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
      if (mark === 'line') lineCount += 1
      else if (mark === 'unknown') unknownCount += 1
    }
    if (unknownCount === 0 && !sectorMaskAllows(mask, lineCount as 0 | 1 | 2)) {
      return true
    }
    let hasFeasible = false
    for (let value = lineCount; value <= lineCount + unknownCount; value += 1) {
      if (value <= 2 && sectorMaskAllows(mask, value as 0 | 1 | 2)) {
        hasFeasible = true
        break
      }
    }
    if (!hasFeasible) {
      return true
    }
  }

  const lineEdges = Object.entries(puzzle.edges).filter(([, edgeState]) => (edgeState?.mark ?? 'unknown') === 'line')
  if (lineEdges.length === 0) {
    return false
  }
  const vertexCols = puzzle.cols + 1
  const vertexCount = (puzzle.rows + 1) * vertexCols
  const toVertexIndex = (row: number, col: number): number => row * vertexCols + col
  const parent = Array.from({ length: vertexCount }, (_, idx) => idx)
  const rank = new Array<number>(vertexCount).fill(0)
  const degree = new Map<number, number>()
  const find = (idx: number): number => {
    if (parent[idx] !== idx) {
      parent[idx] = find(parent[idx])
    }
    return parent[idx]
  }
  const union = (a: number, b: number): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA
    } else {
      parent[rootB] = rootA
      rank[rootA] += 1
    }
  }

  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  const componentEdgeCount = new Map<number, number>()
  const componentVertices = new Map<number, Set<number>>()
  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    const root = find(leftIdx)
    componentEdgeCount.set(root, (componentEdgeCount.get(root) ?? 0) + 1)
    const vertices = componentVertices.get(root) ?? new Set<number>()
    vertices.add(leftIdx)
    vertices.add(rightIdx)
    componentVertices.set(root, vertices)
  }

  let closedLoopEdges = 0
  let closedLoopComponents = 0
  for (const [root, vertices] of componentVertices.entries()) {
    const edgeCount = componentEdgeCount.get(root) ?? 0
    if (edgeCount !== vertices.size) {
      continue
    }
    let allDegreeTwo = true
    for (const vertexIdx of vertices) {
      if ((degree.get(vertexIdx) ?? 0) !== 2) {
        allDegreeTwo = false
        break
      }
    }
    if (!allDegreeTwo) {
      continue
    }
    closedLoopEdges += edgeCount
    closedLoopComponents += 1
  }
  if (closedLoopComponents > 1) {
    return true
  }
  if (closedLoopComponents === 1 && closedLoopEdges < lineEdges.length) {
    return true
  }

  return false
}

const runTrialUntilFixpoint = (
  puzzle: PuzzleIR,
  deterministicRules: Rule[],
  maxTrialSteps: number,
  deadlineMs: number,
): { contradiction: boolean; timedOut: boolean } => {
  if (detectHardContradiction(puzzle)) {
    return { contradiction: true, timedOut: false }
  }

  let trial = puzzle
  for (let stepNumber = 1; stepNumber <= maxTrialSteps; stepNumber += 1) {
    if (Date.now() > deadlineMs) {
      return { contradiction: false, timedOut: true }
    }
    const { nextPuzzle, step } = runNextRule(trial, deterministicRules, stepNumber)
    if (!step) {
      return { contradiction: detectHardContradiction(trial), timedOut: false }
    }
    trial = nextPuzzle
    if (detectHardContradiction(trial)) {
      return { contradiction: true, timedOut: false }
    }
  }
  return { contradiction: false, timedOut: Date.now() > deadlineMs }
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

      const branchA = clonePuzzle(puzzle)
      const branchB = clonePuzzle(puzzle)
      let branchASetupOk = true
      let branchBSetupOk = true
      const branchADiffs: RuleApplication['diffs'] = []
      const branchBDiffs: RuleApplication['diffs'] = []

      if (candidate.kind === 'sector-only-one') {
        branchASetupOk =
          applyEdgeAssumption(branchA, candidate.edgeA, 'line') &&
          applyEdgeAssumption(branchA, candidate.edgeB, 'blank')
        branchBSetupOk =
          applyEdgeAssumption(branchB, candidate.edgeA, 'blank') &&
          applyEdgeAssumption(branchB, candidate.edgeB, 'line')
        branchADiffs.push(
          { kind: 'edge', edgeKey: candidate.edgeA, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: candidate.edgeB, from: 'unknown', to: 'blank' },
        )
        branchBDiffs.push(
          { kind: 'edge', edgeKey: candidate.edgeA, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: candidate.edgeB, from: 'unknown', to: 'line' },
        )
      } else {
        branchASetupOk = applyEdgeAssumption(branchA, candidate.edgeKey, 'line')
        branchBSetupOk = applyEdgeAssumption(branchB, candidate.edgeKey, 'blank')
        branchADiffs.push({ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'line' })
        branchBDiffs.push({ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'blank' })
      }

      const branchAResult = branchASetupOk
        ? runTrialUntilFixpoint(branchA, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false }
      const branchBResult = branchBSetupOk
        ? runTrialUntilFixpoint(branchB, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false }

      if (branchAResult.timedOut || branchBResult.timedOut) {
        break
      }
      if (branchAResult.contradiction === branchBResult.contradiction) {
        continue
      }

      const forcedDiffs = branchAResult.contradiction ? branchBDiffs : branchADiffs
      const diffs = forcedDiffs.filter((diff) => {
        if (diff.kind !== 'edge') {
          return false
        }
        return (puzzle.edges[diff.edgeKey]?.mark ?? 'unknown') === 'unknown'
      })
      if (diffs.length === 0) {
        continue
      }

      return {
        message:
          candidate.kind === 'sector-only-one'
            ? `Strong inference on sector ${candidate.sectorKey} eliminated one branch and fixed both corner edges.`
            : `Strong inference on edge ${candidate.edgeKey} eliminated one branch and fixed its state.`,
        diffs,
        affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
        affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
      }
    }

    return null
  },
})
