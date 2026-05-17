import type { LineMark, PuzzleIR } from '../../../ir/types'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  MASYU_DIRECTIONS,
  type MasyuDirection,
  type MasyuDirectionalLine,
} from './shared'
import type { MasyuLineOverlay } from './loop'
import { createMasyuLookaheadGeometry } from './lookaheadGeometry'

export type BlackPearlCandidate = {
  exits: [MasyuDirection, MasyuDirection]
  lines: Set<string>
  exitLines: Set<string>
  extensionLines: Set<string>
  blanks: Set<string>
}

export type MasyuLookaheadContext = {
  getBlackPearlKeys: () => string[]
  getIncidentEntries: (overlay: MasyuLineOverlay, key: string) => MasyuDirectionalLine[]
  getFeasibleBlackPearlCandidates: (pearlKey: string) => BlackPearlCandidate[]
}

const BLACK_CANDIDATE_EXIT_PAIRS: [MasyuDirection, MasyuDirection][] = [
  ['N', 'E'],
  ['N', 'W'],
  ['S', 'E'],
  ['S', 'W'],
]

const WHITE_CANDIDATE_AXES: [MasyuDirection, MasyuDirection][] = [
  ['N', 'S'],
  ['E', 'W'],
]

const addOverlayDecision = (overlay: Map<string, LineMark>, lineKey: string, mark: LineMark): boolean => {
  const existing = overlay.get(lineKey)
  if (existing !== undefined) {
    return existing === mark
  }
  overlay.set(lineKey, mark)
  return true
}

const candidateToOverlay = (candidate: BlackPearlCandidate): Map<string, LineMark> | null => {
  const overlay = new Map<string, LineMark>()
  for (const lineKeyValue of candidate.lines) {
    if (!addOverlayDecision(overlay, lineKeyValue, 'line')) {
      return null
    }
  }
  for (const lineKeyValue of candidate.blanks) {
    if (!addOverlayDecision(overlay, lineKeyValue, 'blank')) {
      return null
    }
  }
  return overlay
}

const mergeOverlay = (base: MasyuLineOverlay, next: MasyuLineOverlay): Map<string, LineMark> | null => {
  const merged = new Map<string, LineMark>(base)
  for (const [lineKeyValue, mark] of next.entries()) {
    if (!addOverlayDecision(merged, lineKeyValue, mark)) {
      return null
    }
  }
  return merged
}

export const createMasyuLookaheadContext = (puzzle: PuzzleIR): MasyuLookaheadContext => {
  const geometry = createMasyuLookaheadGeometry(puzzle)

  const isOverlayConsistentWithPuzzle = (overlay: MasyuLineOverlay): boolean => {
    for (const [lineKeyValue, mark] of overlay.entries()) {
      const current = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
      if (current !== 'unknown' && current !== mark) {
        return false
      }
    }
    return true
  }

  const isCellDegreeValid = (overlay: MasyuLineOverlay, key: string): boolean =>
    geometry.getIncidentEntries(overlay, key).filter((item) => item.mark === 'line').length <= 2

  const canApplyLocalDecisions = (overlay: MasyuLineOverlay, decisions: MasyuLineOverlay): boolean => {
    const merged = mergeOverlay(overlay, decisions)
    if (!merged || !isOverlayConsistentWithPuzzle(merged)) {
      return false
    }
    for (const key of geometry.getTouchedCells(decisions.keys())) {
      if (
        !isCellDegreeValid(merged, key) ||
        !isPearlShapeStillPossible(merged, key, { checkWhiteAdjacentTurn: false })
      ) {
        return false
      }
    }
    return true
  }

  const canWhiteSideTurn = (
    overlay: MasyuLineOverlay,
    pearlKey: string,
    direction: MasyuDirection,
  ): boolean => {
    const { first, second } = geometry.getTwoStep(pearlKey, direction)
    if (!first || geometry.getLineMark(overlay, first.lineKey) === 'blank') {
      return false
    }
    if (second && geometry.getLineMark(overlay, second.lineKey) === 'line') {
      return false
    }
    return geometry.getTurnCandidates(first.neighborKey, direction).some((line) => {
      if (geometry.getLineMark(overlay, line.lineKey) === 'blank') {
        return false
      }
      const turnOverlay = new Map<string, LineMark>()
      if (!addOverlayDecision(turnOverlay, line.lineKey, 'line')) {
        return false
      }
      if (second && !addOverlayDecision(turnOverlay, second.lineKey, 'blank')) {
        return false
      }
      return canApplyLocalDecisions(overlay, turnOverlay)
    })
  }

  const isPearlShapeStillPossible = (
    overlay: MasyuLineOverlay,
    key: string,
    options: { checkWhiteAdjacentTurn?: boolean } = {},
  ): boolean => {
    const color = geometry.pearlColors.get(key) ?? null
    if (!color) {
      return true
    }
    const lineEntries = geometry.getIncidentEntries(overlay, key).filter((item) => item.mark === 'line')
    if (lineEntries.length > 2) {
      return false
    }
    if (lineEntries.length !== 2) {
      return true
    }
    const [left, right] = lineEntries
    if (color === 'black') {
      if (!areMasyuDirectionsTurn(left.direction, right.direction)) {
        return false
      }
      return [left.direction, right.direction].every((direction) => {
        const extension = geometry.getTwoStep(key, direction).second
        return extension !== null && geometry.getLineMark(overlay, extension.lineKey) !== 'blank'
      })
    }
    if (!areMasyuDirectionsOpposite(left.direction, right.direction)) {
      return false
    }
    if (options.checkWhiteAdjacentTurn === false) {
      return true
    }
    return [left.direction, right.direction].some((direction) => canWhiteSideTurn(overlay, key, direction))
  }

  const buildBlackPearlCandidate = (
    pearlKey: string,
    exits: [MasyuDirection, MasyuDirection],
  ): BlackPearlCandidate | null => {
    const candidate: BlackPearlCandidate = {
      exits,
      lines: new Set<string>(),
      exitLines: new Set<string>(),
      extensionLines: new Set<string>(),
      blanks: new Set<string>(),
    }

    for (const direction of exits) {
      const { first, second } = geometry.getTwoStep(pearlKey, direction)
      if (!first || !second) {
        return null
      }
      candidate.lines.add(first.lineKey)
      candidate.lines.add(second.lineKey)
      candidate.exitLines.add(first.lineKey)
      candidate.extensionLines.add(second.lineKey)
    }

    const selected = new Set<MasyuDirection>(exits)
    const incident = geometry.getIncident(pearlKey)
    for (const direction of MASYU_DIRECTIONS) {
      if (selected.has(direction)) {
        continue
      }
      const line = incident[direction]
      if (line) {
        candidate.blanks.add(line.lineKey)
      }
    }

    return candidate
  }

  const hasAnyBlackPearlCandidate = (overlay: MasyuLineOverlay, key: string): boolean =>
    BLACK_CANDIDATE_EXIT_PAIRS.some((exits) => {
      const candidate = buildBlackPearlCandidate(key, exits)
      const candidateOverlay = candidate ? candidateToOverlay(candidate) : null
      return candidateOverlay !== null && canApplyLocalDecisions(overlay, candidateOverlay)
    })

  const buildWhiteAxisOverlay = (
    key: string,
    axis: [MasyuDirection, MasyuDirection],
  ): Map<string, LineMark> | null => {
    const overlay = new Map<string, LineMark>()
    const selected = new Set<MasyuDirection>(axis)
    const incident = geometry.getIncident(key)
    for (const direction of axis) {
      const line = incident[direction]
      if (!line || !addOverlayDecision(overlay, line.lineKey, 'line')) {
        return null
      }
    }
    for (const direction of MASYU_DIRECTIONS) {
      if (selected.has(direction)) {
        continue
      }
      const line = incident[direction]
      if (line && !addOverlayDecision(overlay, line.lineKey, 'blank')) {
        return null
      }
    }
    return overlay
  }

  const hasAnyWhitePearlCandidate = (overlay: MasyuLineOverlay, key: string): boolean =>
    WHITE_CANDIDATE_AXES.some((axis) => {
      const axisOverlay = buildWhiteAxisOverlay(key, axis)
      const merged = axisOverlay ? mergeOverlay(overlay, axisOverlay) : null
      return (
        axisOverlay !== null &&
        merged !== null &&
        canApplyLocalDecisions(overlay, axisOverlay) &&
        axis.some((direction) => canWhiteSideTurn(merged, key, direction))
      )
    })

  const areAffectedPearlsStillPossible = (overlay: MasyuLineOverlay, centerKey: string): boolean => {
    const affected = geometry.getAffectedPearls(overlay)
    affected.add(centerKey)
    for (const key of affected) {
      const color = geometry.pearlColors.get(key)
      if (!color) {
        continue
      }
      const possible =
        color === 'black' ? hasAnyBlackPearlCandidate(overlay, key) : hasAnyWhitePearlCandidate(overlay, key)
      if (!possible) {
        return false
      }
    }
    return true
  }

  const wouldCreatePrematureLoop = (assumedLineEndpoints: Iterable<[left: number, right: number]>): boolean => {
    const parent = new Map<number, number>()
    const lineCounts = new Map<number, number>()
    const find = (root: number): number => {
      if (!parent.has(root)) {
        parent.set(root, root)
        lineCounts.set(root, geometry.baseLineCounts.get(root) ?? 0)
        return root
      }
      const nextParent = parent.get(root) ?? root
      if (nextParent === root) {
        return root
      }
      const next = find(nextParent)
      parent.set(root, next)
      return next
    }
    const union = (rootA: number, rootB: number): void => {
      const left = find(rootA)
      const right = find(rootB)
      if (left === right) {
        return
      }
      parent.set(right, left)
      lineCounts.set(left, (lineCounts.get(left) ?? 0) + (lineCounts.get(right) ?? 0))
    }

    for (const [left, right] of assumedLineEndpoints) {
      const leftRoot = find(geometry.findBase(left))
      const rightRoot = find(geometry.findBase(right))
      if (leftRoot === rightRoot) {
        return geometry.totalBaseLineCount > (lineCounts.get(leftRoot) ?? 0)
      }
      union(leftRoot, rightRoot)
    }
    return false
  }

  const hasPrematureLoopFromCandidate = (candidate: BlackPearlCandidate): boolean => {
    const assumedLineEndpoints: Array<[left: number, right: number]> = []
    for (const lineKeyValue of candidate.lines) {
      if ((puzzle.lines[lineKeyValue]?.mark ?? 'unknown') === 'line') {
        continue
      }
      assumedLineEndpoints.push(geometry.lineEndpoints(lineKeyValue))
    }
    return assumedLineEndpoints.length > 0 && wouldCreatePrematureLoop(assumedLineEndpoints)
  }

  const isBlackPearlCandidateFeasible = (pearlKey: string, candidate: BlackPearlCandidate): boolean => {
    const overlay = candidateToOverlay(candidate)
    if (!overlay || !isOverlayConsistentWithPuzzle(overlay)) {
      return false
    }
    for (const key of geometry.getTouchedCells([...candidate.lines, ...candidate.blanks])) {
      if (!isCellDegreeValid(overlay, key) || !isPearlShapeStillPossible(overlay, key)) {
        return false
      }
    }
    if (hasPrematureLoopFromCandidate(candidate)) {
      return false
    }
    return areAffectedPearlsStillPossible(overlay, pearlKey)
  }

  const getFeasibleBlackPearlCandidates = (pearlKey: string): BlackPearlCandidate[] => {
    const incidentLines = geometry.getIncidentEntries(new Map(), pearlKey).filter((item) => item.mark === 'line')
    if (incidentLines.length >= 2) {
      return []
    }
    return BLACK_CANDIDATE_EXIT_PAIRS.flatMap((exits) => {
      const candidate = buildBlackPearlCandidate(pearlKey, exits)
      return candidate && isBlackPearlCandidateFeasible(pearlKey, candidate) ? [candidate] : []
    })
  }

  return {
    getBlackPearlKeys: () => geometry.blackPearlKeys,
    getIncidentEntries: geometry.getIncidentEntries,
    getFeasibleBlackPearlCandidates,
  }
}
