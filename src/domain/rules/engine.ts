import type { PuzzleIR } from '../ir/types'
import type {
  Rule,
  RuleAttempt,
  RuleDiff,
  RuleRuntimeContext,
  RuleStep,
} from './types'

type WritableBuckets = {
  cells: PuzzleIR['cells'] | null
  tiles: PuzzleIR['tiles'] | null
  edges: PuzzleIR['edges'] | null
  lines: PuzzleIR['lines'] | null
  sectors: PuzzleIR['sectors'] | null
  vertices: PuzzleIR['vertices'] | null
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
  if (diff.kind === 'line') {
    const mark = mode === 'forward' ? diff.to : diff.from
    if (!writable.lines) {
      writable.lines = { ...(next.lines ?? {}) }
      next.lines = writable.lines
    }
    const prev = writable.lines[diff.lineKey]
    writable.lines[diff.lineKey] = prev ? { ...prev, mark } : { mark }
    return
  }
  if (diff.kind === 'sector') {
    const constraintsMask = mode === 'forward' ? diff.toMask : diff.fromMask
    if (!writable.sectors) {
      writable.sectors = { ...next.sectors }
      next.sectors = writable.sectors
    }
    const prev = writable.sectors[diff.sectorKey]
    writable.sectors[diff.sectorKey] = prev
      ? { ...prev, constraintsMask }
      : { constraintsMask }
    return
  }
  if (diff.kind === 'vertex') {
    const candidateEdgeSets =
      mode === 'forward' ? diff.toCandidates : diff.fromCandidates
    if (!writable.vertices) {
      writable.vertices = { ...(next.vertices ?? {}) }
      next.vertices = writable.vertices
    }
    writable.vertices[diff.vertexKey] = {
      candidateEdgeSets: candidateEdgeSets.map((candidate) => [...candidate]),
    }
    return
  }
  if (diff.kind === 'tile') {
    const toFill = mode === 'forward' ? diff.toFill : diff.fromFill
    if (!writable.tiles) {
      writable.tiles = { ...(next.tiles ?? {}) }
      next.tiles = writable.tiles
    }
    const prev = writable.tiles[diff.tileKey]
    const tile = prev ? { ...prev } : {}
    if (toFill === null) {
      delete tile.fill
    } else {
      tile.fill = toFill
    }
    writable.tiles[diff.tileKey] = tile
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
    tiles: null,
    edges: null,
    lines: null,
    sectors: null,
    vertices: null,
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

export const revertRuleDiffs = (
  puzzle: PuzzleIR,
  diffs: RuleDiff[],
): PuzzleIR => applyRuleDiffsInternal(puzzle, diffs, 'backward')

const applyDiffs = (puzzle: PuzzleIR, step: RuleStep): PuzzleIR =>
  applyRuleDiffs(puzzle, step.diffs)

export const buildPuzzleFromSteps = (
  initialPuzzle: PuzzleIR,
  steps: RuleStep[],
  pointer: number,
): PuzzleIR => {
  const clamped = Math.max(0, Math.min(pointer, steps.length))
  let next = initialPuzzle
  for (let i = 0; i < clamped; i += 1) {
    next = applyRuleDiffs(next, steps[i].diffs)
  }
  return next
}

export const rewindPuzzleByStep = (
  puzzle: PuzzleIR,
  step: RuleStep | undefined,
): PuzzleIR => {
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
  const runtimeContext: RuleRuntimeContext = {
    cache: new Map<string, unknown>(),
  }
  const attempts: RuleAttempt[] = []
  for (const rule of rules) {
    const ruleStartedAt = performance.now()
    const result = rule.apply(puzzle, runtimeContext)
    const ruleApplyMs = Math.max(0, performance.now() - ruleStartedAt)
    const hit = Boolean(result && result.diffs.length > 0)
    attempts.push({
      ruleId: rule.id,
      ruleName: rule.name,
      durationMs: ruleApplyMs,
      hit,
    })
    if (!result || result.diffs.length === 0) {
      continue
    }
    const chainDurationMs = Math.max(0, performance.now() - startedAt)
    const step: RuleStep = {
      id: `step-${stepNumber}`,
      ruleId: rule.id,
      ruleName: rule.name,
      message: result.message,
      diffs: result.diffs,
      affectedCells: result.affectedCells,
      affectedTiles:
        result.affectedTiles ??
        result.diffs.flatMap((d) => (d.kind === 'tile' ? [d.tileKey] : [])),
      affectedEdges: result.diffs.flatMap((d) =>
        d.kind === 'edge' ? [d.edgeKey] : [],
      ),
      affectedLines:
        result.affectedLines ??
        result.diffs.flatMap((d) => (d.kind === 'line' ? [d.lineKey] : [])),
      affectedSectors:
        result.affectedSectors ??
        result.diffs.flatMap((d) => (d.kind === 'sector' ? [d.sectorKey] : [])),
      timestamp: Date.now(),
      durationMs: chainDurationMs,
      chainDurationMs,
      ruleApplyMs,
      ruleAttempts: attempts,
    }
    return {
      nextPuzzle: applyDiffs(puzzle, step),
      step,
    }
  }

  return { nextPuzzle: puzzle, step: null }
}
