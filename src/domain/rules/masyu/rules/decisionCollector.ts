import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { LineDiff, TileDiff } from '../../types'
import {
  canMasyuLineBeAddedWithoutDegreeOverflow,
  formatMasyuLineLabel,
} from './shared'

export type MasyuTileColorDecision = 'green' | 'yellow'

const isMasyuTileColorDecision = (
  fill: string | undefined,
): fill is MasyuTileColorDecision => fill === 'green' || fill === 'yellow'

export type MasyuDecisionCollectorOptions = {
  guardLineDegree?: boolean
}

export type MasyuLineDecisionCollector = {
  add: (lineKey: string, to: LineMark) => boolean
  addNew: (lineKey: string, to: LineMark) => boolean
  hasChanges: () => boolean
  diffs: () => LineDiff[]
  affectedLines: () => string[]
  firstLine: () => string | null
  firstLineLabel: () => string | null
  decisions: ReadonlyMap<string, LineMark>
}

export type MasyuTileDecisionCollector = {
  add: (tileKey: string, toFill: MasyuTileColorDecision) => boolean
  addNew: (tileKey: string, toFill: MasyuTileColorDecision) => boolean
  hasChanges: () => boolean
  diffs: () => TileDiff[]
  affectedTiles: () => string[]
  firstTile: () => string | null
  decisions: ReadonlyMap<string, MasyuTileColorDecision>
}

export const createMasyuLineDecisionCollector = (
  puzzle: PuzzleIR,
  options: MasyuDecisionCollectorOptions = {},
): MasyuLineDecisionCollector => {
  const decisions = new Map<string, LineMark>()
  let first: string | null = null

  const add = (lineKeyValue: string, to: LineMark): boolean => {
    if (
      to === 'line' &&
      options.guardLineDegree &&
      !canMasyuLineBeAddedWithoutDegreeOverflow(puzzle, lineKeyValue, decisions)
    ) {
      return false
    }
    const current = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
    if (current === to) {
      return true
    }
    if (current !== 'unknown') {
      return false
    }
    const existing = decisions.get(lineKeyValue)
    if (existing !== undefined) {
      return existing === to
    }
    decisions.set(lineKeyValue, to)
    first ??= lineKeyValue
    return true
  }

  const addNew = (lineKeyValue: string, to: LineMark): boolean => {
    const beforeSize = decisions.size
    return add(lineKeyValue, to) && decisions.size > beforeSize
  }

  return {
    add,
    addNew,
    hasChanges: () => decisions.size > 0,
    diffs: () =>
      [...decisions.entries()].map(([lineKeyValue, to]) => ({
        kind: 'line' as const,
        lineKey: lineKeyValue,
        from: puzzle.lines[lineKeyValue]?.mark ?? 'unknown',
        to,
      })),
    affectedLines: () => [...decisions.keys()],
    firstLine: () => first,
    firstLineLabel: () => (first ? formatMasyuLineLabel(first) : null),
    decisions,
  }
}

export const createMasyuTileDecisionCollector = (
  puzzle: PuzzleIR,
): MasyuTileDecisionCollector => {
  const decisions = new Map<string, MasyuTileColorDecision>()
  let first: string | null = null

  const add = (
    tileKeyValue: string,
    toFill: MasyuTileColorDecision,
  ): boolean => {
    const currentFill = puzzle.tiles[tileKeyValue]?.fill
    if (isMasyuTileColorDecision(currentFill)) {
      return currentFill === toFill
    }
    const existing = decisions.get(tileKeyValue)
    if (existing !== undefined) {
      return existing === toFill
    }
    decisions.set(tileKeyValue, toFill)
    first ??= tileKeyValue
    return true
  }

  const addNew = (
    tileKeyValue: string,
    toFill: MasyuTileColorDecision,
  ): boolean => {
    const beforeSize = decisions.size
    return add(tileKeyValue, toFill) && decisions.size > beforeSize
  }

  return {
    add,
    addNew,
    hasChanges: () => decisions.size > 0,
    diffs: () =>
      [...decisions.entries()].map(([tileKeyValue, toFill]) => ({
        kind: 'tile' as const,
        tileKey: tileKeyValue,
        fromFill: (puzzle.tiles[tileKeyValue]?.fill ?? null) as string | null,
        toFill,
      })),
    affectedTiles: () => [...decisions.keys()],
    firstTile: () => first,
    decisions,
  }
}
