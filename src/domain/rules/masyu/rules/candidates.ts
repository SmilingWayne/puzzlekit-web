import { cellKey, parseCellKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication, RuleRuntimeContext } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import type { MasyuLineOverlay } from './lineGraph'
import { addMasyuOverlayDecision } from './pearlCandidates'
import {
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionalLine,
  oppositeMasyuDirection,
  MASYU_DIRECTIONS,
  type MasyuDirection,
  type MasyuDirectionalLine,
} from './shared'
import { getMasyuLookaheadContext } from './lookahead'

type EmptyCellCandidate = {
  overlay: MasyuLineOverlay
}

type PearlCandidateWithExits = {
  lines: ReadonlySet<string>
  exitLines: ReadonlySet<string>
}

const getCommonLineDecisions = (
  overlays: MasyuLineOverlay[],
): Array<[string, LineMark]> => {
  const [first] = overlays
  if (!first) {
    return []
  }
  return [...first.entries()].filter(([lineKeyValue, mark]) =>
    overlays.every((overlay) => overlay.get(lineKeyValue) === mark),
  )
}

const getCommonPearlCandidateDecisions = (
  candidates: PearlCandidateWithExits[],
  exitLineKeys: string[],
): Array<[string, LineMark]> => {
  const [first] = candidates
  if (!first) {
    return []
  }
  const commonLines = [...first.lines]
    .filter((lineKeyValue) =>
      candidates.every((candidate) => candidate.lines.has(lineKeyValue)),
    )
    .map((lineKeyValue): [string, LineMark] => [lineKeyValue, 'line'])
  const excludedExits = exitLineKeys
    .filter((lineKeyValue) =>
      candidates.every((candidate) => !candidate.exitLines.has(lineKeyValue)),
    )
    .map((lineKeyValue): [string, LineMark] => [lineKeyValue, 'blank'])
  return [...commonLines, ...excludedExits]
}

export const createBlackPearlCandidatePruningRule = (): Rule => ({
  id: 'masyu-black-pearl-candidate-pruning',
  name: 'Black Pearl Candidate Pruning',
  apply: (
    puzzle: PuzzleIR,
    runtimeContext?: RuleRuntimeContext,
  ): RuleApplication | null => {
    const context = getMasyuLookaheadContext(puzzle, runtimeContext)

    for (const pearlKey of context.getBlackPearlKeys()) {
      const decisions = createMasyuLineDecisionCollector(puzzle)
      const incident = context.getIncidentEntries(new Map(), pearlKey)
      const exitLineKeys = incident.map((item) => item.lineKey)
      const candidates = context.getFeasibleBlackPearlCandidates(pearlKey)
      if (candidates.length === 0) {
        continue
      }

      for (const [lineKeyValue, mark] of getCommonPearlCandidateDecisions(
        candidates,
        exitLineKeys,
      )) {
        decisions.add(lineKeyValue, mark)
      }

      if (!decisions.hasChanges()) {
        continue
      }

      const diffs = decisions.diffs()
      const firstLine = diffs[0]?.lineKey
      return {
        message: firstLine
          ? `Black pearl ${formatMasyuCellKeyLabel(pearlKey)} has only compatible candidate turns left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Black pearl candidate pruning applied.',
        diffs,
        affectedCells: [pearlKey],
        affectedLines: diffs.map((diff) => diff.lineKey),
      }
    }

    return null
  },
})

export const createWhitePearlCandidatePruningRule = (): Rule => ({
  id: 'masyu-white-pearl-candidate-pruning',
  name: 'White Pearl Candidate Pruning',
  apply: (
    puzzle: PuzzleIR,
    runtimeContext?: RuleRuntimeContext,
  ): RuleApplication | null => {
    const context = getMasyuLookaheadContext(puzzle, runtimeContext)

    for (const pearlKey of context.getWhitePearlKeys()) {
      const decisions = createMasyuLineDecisionCollector(puzzle, {
        guardLineDegree: true,
      })
      const incident = context.getIncidentEntries(new Map(), pearlKey)
      const exitLineKeys = incident.map((item) => item.lineKey)
      const candidates = context.getFeasibleWhitePearlCandidates(pearlKey)
      if (candidates.length === 0) {
        continue
      }

      for (const [lineKeyValue, mark] of getCommonPearlCandidateDecisions(
        candidates,
        exitLineKeys,
      )) {
        decisions.add(lineKeyValue, mark)
      }

      if (!decisions.hasChanges()) {
        continue
      }

      const diffs = decisions.diffs()
      const firstLine = diffs[0]?.lineKey
      return {
        message: firstLine
          ? `White pearl ${formatMasyuCellKeyLabel(pearlKey)} has only compatible straight-axis candidates left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'White pearl candidate pruning applied.',
        diffs,
        affectedCells: [pearlKey],
        affectedLines: diffs.map((diff) => diff.lineKey),
      }
    }

    return null
  },
})

type AdjacentWhitePearlPatternKind = 'parallel' | 'through'

type AdjacentWhitePearlPattern = {
  kind: AdjacentWhitePearlPatternKind
  overlay: Map<string, 'line' | 'blank'>
}

type AdjacentWhitePearlPatternResult = {
  kind: AdjacentWhitePearlPatternKind
  overlay: MasyuLineOverlay | null
}

type AdjacentWhitePearlPair = {
  first: string
  second: string
  direction: MasyuDirection
}

const perpendicularDirections = (
  direction: MasyuDirection,
): [MasyuDirection, MasyuDirection] =>
  direction === 'N' || direction === 'S' ? ['E', 'W'] : ['N', 'S']

const addRequiredLine = (
  puzzle: PuzzleIR,
  overlay: Map<string, 'line' | 'blank'>,
  pearlKey: string,
  direction: MasyuDirection,
): boolean => {
  const line = getMasyuDirectionalLine(puzzle, pearlKey, direction)
  return line !== null && addMasyuOverlayDecision(overlay, line.lineKey, 'line')
}

const addOptionalBlank = (
  puzzle: PuzzleIR,
  overlay: Map<string, 'line' | 'blank'>,
  pearlKey: string,
  direction: MasyuDirection,
): boolean => {
  const line = getMasyuDirectionalLine(puzzle, pearlKey, direction)
  return (
    line === null || addMasyuOverlayDecision(overlay, line.lineKey, 'blank')
  )
}

const buildAdjacentWhitePearlPattern = (
  puzzle: PuzzleIR,
  pair: AdjacentWhitePearlPair,
  kind: AdjacentWhitePearlPatternKind,
): AdjacentWhitePearlPattern | null => {
  const overlay = new Map<string, 'line' | 'blank'>()
  const throughDirections: [MasyuDirection, MasyuDirection] = [
    pair.direction,
    oppositeMasyuDirection(pair.direction),
  ]
  const parallelDirections = perpendicularDirections(pair.direction)

  const lineDirections =
    kind === 'through' ? throughDirections : parallelDirections
  const blankDirections =
    kind === 'through' ? parallelDirections : throughDirections

  for (const pearlKey of [pair.first, pair.second]) {
    for (const direction of lineDirections) {
      if (!addRequiredLine(puzzle, overlay, pearlKey, direction)) {
        return null
      }
    }
    for (const direction of blankDirections) {
      if (!addOptionalBlank(puzzle, overlay, pearlKey, direction)) {
        return null
      }
    }
  }

  return { kind, overlay }
}

const getAdjacentWhitePearlPairs = (
  puzzle: PuzzleIR,
): AdjacentWhitePearlPair[] => {
  const pairs: AdjacentWhitePearlPair[] = []
  const whitePearls = new Set(
    Object.entries(puzzle.cells).flatMap(([key, cell]) =>
      cell.clue?.kind === 'pearl' && cell.clue.color === 'white' ? [key] : [],
    ),
  )

  for (const first of whitePearls) {
    const [row, col] = parseCellKey(first)
    const candidates: Array<[MasyuDirection, string]> = [
      ['E', cellKey(row, col + 1)],
      ['S', cellKey(row + 1, col)],
    ]
    for (const [direction, second] of candidates) {
      if (whitePearls.has(second)) {
        pairs.push({ first, second, direction })
      }
    }
  }

  return pairs
}

export const createAdjacentWhitePearlsLookaheadRule = (): Rule => ({
  id: 'masyu-adjacent-white-pearls-lookahead',
  name: 'Adjacent White Pearls LookAhead',
  apply: (
    puzzle: PuzzleIR,
    runtimeContext?: RuleRuntimeContext,
  ): RuleApplication | null => {
    const context = getMasyuLookaheadContext(puzzle, runtimeContext)

    for (const pair of getAdjacentWhitePearlPairs(puzzle)) {
      const patterns: AdjacentWhitePearlPatternResult[] = (
        ['parallel', 'through'] as const
      ).map((kind) => {
        const pattern = buildAdjacentWhitePearlPattern(puzzle, pair, kind)
        return pattern ?? { kind, overlay: null }
      })
      const feasiblePatterns = patterns.filter(
        (
          pattern,
        ): pattern is {
          kind: AdjacentWhitePearlPatternKind
          overlay: MasyuLineOverlay
        } =>
          pattern.overlay !== null &&
          context.isOverlayLocallyFeasible(
            [pair.first, pair.second],
            pattern.overlay,
          ),
      )

      if (feasiblePatterns.length !== 1) {
        continue
      }

      const selected = feasiblePatterns[0]
      const decisions = createMasyuLineDecisionCollector(puzzle, {
        guardLineDegree: true,
      })
      for (const [lineKeyValue, mark] of selected.overlay.entries()) {
        decisions.add(lineKeyValue, mark)
      }

      if (!decisions.hasChanges()) {
        continue
      }

      const diffs = decisions.diffs()
      const firstLine = diffs[0]?.lineKey
      const pairLabel = `${formatMasyuCellKeyLabel(pair.first)} and ${formatMasyuCellKeyLabel(pair.second)}`
      const patternLabel =
        selected.kind === 'parallel'
          ? 'parallel straight-through paths'
          : 'one straight line through both pearls'
      return {
        message: firstLine
          ? `Adjacent white pearls ${pairLabel} have only ${patternLabel} left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Adjacent white pearls lookahead applied.',
        diffs,
        affectedCells: [pair.first, pair.second],
        affectedLines: diffs.map((diff) => diff.lineKey),
      }
    }

    return null
  },
})

const isEmptyCellCandidateActive = (
  puzzle: PuzzleIR,
  key: string,
  incident: MasyuDirectionalLine[],
): boolean => {
  if (puzzle.cells[key]?.clue?.kind === 'pearl') {
    return false
  }
  const unknownCount = incident.filter((item) => item.mark === 'unknown').length
  if (unknownCount === 0) {
    return false
  }
  const lineCount = incident.filter((item) => item.mark === 'line').length
  if (lineCount === 1 || unknownCount <= 3) {
    return true
  }
  return incident.some(
    (item) => getMasyuIncidentLineCount(puzzle, item.neighborKey) > 0,
  )
}

const getMasyuIncidentLineCount = (puzzle: PuzzleIR, key: string): number =>
  MASYU_DIRECTIONS.flatMap((direction) => {
    const item = getMasyuDirectionalLine(puzzle, key, direction)
    return item ? [item] : []
  }).filter((item) => item.mark === 'line').length

const buildEmptyCellCandidateOverlay = (
  incident: MasyuDirectionalLine[],
  selectedLineKeys: ReadonlySet<string>,
): MasyuLineOverlay | null => {
  const overlay = new Map<string, LineMark>()
  for (const item of incident) {
    if (
      !addMasyuOverlayDecision(
        overlay,
        item.lineKey,
        selectedLineKeys.has(item.lineKey) ? 'line' : 'blank',
      )
    ) {
      return null
    }
  }
  return overlay
}

const buildEmptyCellCandidates = (
  incident: MasyuDirectionalLine[],
): EmptyCellCandidate[] => {
  const candidates: EmptyCellCandidate[] = []
  const degreeZero = buildEmptyCellCandidateOverlay(incident, new Set())
  if (degreeZero) {
    candidates.push({ overlay: degreeZero })
  }

  for (let leftIndex = 0; leftIndex < incident.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < incident.length;
      rightIndex += 1
    ) {
      const overlay = buildEmptyCellCandidateOverlay(
        incident,
        new Set([incident[leftIndex].lineKey, incident[rightIndex].lineKey]),
      )
      if (overlay) {
        candidates.push({ overlay })
      }
    }
  }

  return candidates
}

const getOverlayCellDegree = (
  incident: MasyuDirectionalLine[],
  overlay: MasyuLineOverlay,
): number =>
  incident.filter((item) => overlay.get(item.lineKey) === 'line').length

export const createEmptyCellCandidatePruningRule = (): Rule => ({
  id: 'masyu-empty-cell-candidate-pruning',
  name: 'Empty Cell Candidate Pruning',
  apply: (
    puzzle: PuzzleIR,
    runtimeContext?: RuleRuntimeContext,
  ): RuleApplication | null => {
    const context = getMasyuLookaheadContext(puzzle, runtimeContext)

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const incident = context.getIncidentEntries(new Map(), key)
        if (!isEmptyCellCandidateActive(puzzle, key, incident)) {
          continue
        }

        const feasibleCandidates = buildEmptyCellCandidates(incident).filter(
          (candidate) => {
            const degree = getOverlayCellDegree(incident, candidate.overlay)
            return (
              (degree === 0 || degree === 2) &&
              context.isOverlayLocallyFeasible([key], candidate.overlay)
            )
          },
        )
        if (feasibleCandidates.length === 0) {
          continue
        }

        const decisions = createMasyuLineDecisionCollector(puzzle, {
          guardLineDegree: true,
        })
        for (const [lineKeyValue, mark] of getCommonLineDecisions(
          feasibleCandidates.map((candidate) => candidate.overlay),
        )) {
          decisions.add(lineKeyValue, mark)
        }

        if (!decisions.hasChanges()) {
          continue
        }

        const diffs = decisions.diffs()
        const firstLine = diffs[0]?.lineKey
        return {
          message: firstLine
            ? `Empty cell ${formatMasyuCellKeyLabel(key)} has only compatible degree-0/degree-2 candidates left, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
            : 'Empty cell candidate pruning applied.',
          diffs,
          affectedCells: [key],
          affectedLines: diffs.map((diff) => diff.lineKey),
        }
      }
    }

    return null
  },
})
