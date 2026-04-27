import type { PuzzleIR } from '../ir/types'
import type { Rule, RuleDiff, RuleStep } from './types'

type WritableBuckets = {
  cells: PuzzleIR['cells'] | null
  edges: PuzzleIR['edges'] | null
  sectors: PuzzleIR['sectors'] | null
}

const applyDiffEntry = (
  next: PuzzleIR,
  diff: RuleDiff,
  mode: 'forward' | 'backward',
  writable: WritableBuckets,
): void => {
  if (diff.kind === 'edge') {
    const mark = mode === 'forward' ? diff.to : diff.from
    if (!writable.edges) {
      writable.edges = { ...next.edges }
      next.edges = writable.edges
    }
    const prev = writable.edges[diff.edgeKey]
    writable.edges[diff.edgeKey] = prev ? { ...prev, mark } : { mark }
    return
  }
  if (diff.kind === 'sector') {
    const constraintsMask = mode === 'forward' ? diff.toMask : diff.fromMask
    if (!writable.sectors) {
      writable.sectors = { ...next.sectors }
      next.sectors = writable.sectors
    }
    const prev = writable.sectors[diff.sectorKey]
    writable.sectors[diff.sectorKey] = prev ? { ...prev, constraintsMask } : { constraintsMask }
    return
  }
  const toFill = mode === 'forward' ? diff.toFill : diff.fromFill
  if (!writable.cells) {
    writable.cells = { ...next.cells }
    next.cells = writable.cells
  }
  const prev = writable.cells[diff.cellKey]
  const cell = prev ? { ...prev } : {}
  if (toFill === null) {
    delete cell.fill
  } else {
    cell.fill = toFill
  }
  writable.cells[diff.cellKey] = cell
}

const applyRuleDiffsInternal = (
  puzzle: PuzzleIR,
  diffs: RuleDiff[],
  mode: 'forward' | 'backward',
): PuzzleIR => {
  const next: PuzzleIR = { ...puzzle }
  const writable: WritableBuckets = {
    cells: null,
    edges: null,
    sectors: null,
  }
  if (mode === 'forward') {
    for (const diff of diffs) {
      applyDiffEntry(next, diff, mode, writable)
    }
    return next
  }
  for (let i = diffs.length - 1; i >= 0; i -= 1) {
    applyDiffEntry(next, diffs[i], mode, writable)
  }
  return next
}

export const applyRuleDiffs = (puzzle: PuzzleIR, diffs: RuleDiff[]): PuzzleIR =>
  applyRuleDiffsInternal(puzzle, diffs, 'forward')

export const revertRuleDiffs = (puzzle: PuzzleIR, diffs: RuleDiff[]): PuzzleIR =>
  applyRuleDiffsInternal(puzzle, diffs, 'backward')

const applyDiffs = (puzzle: PuzzleIR, step: RuleStep): PuzzleIR => applyRuleDiffs(puzzle, step.diffs)

export const buildPuzzleFromSteps = (initialPuzzle: PuzzleIR, steps: RuleStep[], pointer: number): PuzzleIR => {
  const clamped = Math.max(0, Math.min(pointer, steps.length))
  let next = initialPuzzle
  for (let i = 0; i < clamped; i += 1) {
    next = applyRuleDiffs(next, steps[i].diffs)
  }
  return next
}

export const rewindPuzzleByStep = (puzzle: PuzzleIR, step: RuleStep | undefined): PuzzleIR => {
  if (!step) {
    return puzzle
  }
  return revertRuleDiffs(puzzle, step.diffs)
}

export const runNextRule = (
  puzzle: PuzzleIR,
  rules: Rule[],
  stepNumber: number,
): { nextPuzzle: PuzzleIR; step: RuleStep | null } => {
  const startedAt = performance.now()
  for (const rule of rules) {
    const result = rule.apply(puzzle)
    if (!result || result.diffs.length === 0) {
      continue
    }
    const step: RuleStep = {
      id: `step-${stepNumber}`,
      ruleId: rule.id,
      ruleName: rule.name,
      message: result.message,
      diffs: result.diffs,
      affectedCells: result.affectedCells,
      affectedEdges: result.diffs.flatMap((d) => (d.kind === 'edge' ? [d.edgeKey] : [])),
      affectedSectors:
        result.affectedSectors ??
        result.diffs.flatMap((d) => (d.kind === 'sector' ? [d.sectorKey] : [])),
      timestamp: Date.now(),
      durationMs: Math.max(0, performance.now() - startedAt),
    }
    return {
      nextPuzzle: applyDiffs(puzzle, step),
      step,
    }
  }

  return { nextPuzzle: puzzle, step: null }
}
