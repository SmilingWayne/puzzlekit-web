import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { RuleRuntimeContext } from '../../types'
import {
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  type MasyuDirection,
  type MasyuDirectionalLine,
} from './shared'
import type { MasyuLineOverlay } from './lineGraph'
import { createMasyuLookaheadGeometry } from './lookaheadGeometry'
import {
  addMasyuOverlayDecision,
  BLACK_CANDIDATE_EXIT_PAIRS,
  buildMasyuBlackPearlCandidate,
  buildMasyuWhitePearlCandidate,
  masyuPearlCandidateToOverlay,
  mergeMasyuLineOverlay,
  WHITE_CANDIDATE_AXES,
  type BlackPearlCandidate,
  type WhitePearlCandidate,
} from './pearlCandidates'

export type MasyuLookaheadContext = {
  getBlackPearlKeys: () => string[]
  getWhitePearlKeys: () => string[]
  getIncidentEntries: (
    overlay: MasyuLineOverlay,
    key: string,
  ) => MasyuDirectionalLine[]
  isOverlayLocallyFeasible: (
    centerKeys: Iterable<string>,
    overlay: MasyuLineOverlay,
  ) => boolean
  getFeasibleBlackPearlCandidates: (pearlKey: string) => BlackPearlCandidate[]
  getFeasibleWhitePearlCandidates: (pearlKey: string) => WhitePearlCandidate[]
}

const MASYU_LOOKAHEAD_CONTEXT_CACHE_KEY = 'masyu.lookaheadContext'

export const createMasyuLookaheadContext = (
  puzzle: PuzzleIR,
): MasyuLookaheadContext => {
  const geometry = createMasyuLookaheadGeometry(puzzle)

  const isOverlayConsistentWithPuzzle = (
    overlay: MasyuLineOverlay,
  ): boolean => {
    for (const [lineKeyValue, mark] of overlay.entries()) {
      const current = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
      if (current !== 'unknown' && current !== mark) {
        return false
      }
    }
    return true
  }

  const isCellDegreeValid = (overlay: MasyuLineOverlay, key: string): boolean =>
    geometry
      .getIncidentEntries(overlay, key)
      .filter((item) => item.mark === 'line').length <= 2

  const canOverlayLineStillBecomeLine = (
    overlay: MasyuLineOverlay,
    lineKeyValue: string,
  ): boolean => {
    const mark = geometry.getLineMark(overlay, lineKeyValue)
    if (mark === 'blank') {
      return false
    }
    if (mark === 'line') {
      return true
    }
    const [left, right] = geometry.lineCells(lineKeyValue)
    return [left, right].every(
      (key) =>
        geometry
          .getIncidentEntries(overlay, key)
          .filter((item) => item.mark === 'line').length < 2,
    )
  }

  const isEmptyCellDegreeStillPossible = (
    overlay: MasyuLineOverlay,
    key: string,
  ): boolean => {
    if (geometry.pearlColors.has(key)) {
      return true
    }
    const incident = geometry.getIncidentEntries(overlay, key)
    const lineEntries = incident.filter((item) => item.mark === 'line')
    if (lineEntries.length > 2) {
      return false
    }
    if (lineEntries.length !== 1) {
      return true
    }
    return incident.some(
      (item) =>
        item.mark === 'unknown' &&
        canOverlayLineStillBecomeLine(overlay, item.lineKey),
    )
  }

  const isCellLocallyFeasible = (
    overlay: MasyuLineOverlay,
    key: string,
  ): boolean =>
    isCellDegreeValid(overlay, key) && isEmptyCellDegreeStillPossible(overlay, key)

  const canApplyLocalDecisions = (
    overlay: MasyuLineOverlay,
    decisions: MasyuLineOverlay,
  ): boolean => {
    const merged = mergeMasyuLineOverlay(overlay, decisions)
    if (!merged || !isOverlayConsistentWithPuzzle(merged)) {
      return false
    }
    for (const key of geometry.getTouchedCells(decisions.keys())) {
      if (
        !isCellLocallyFeasible(merged, key) ||
        !isPearlShapeStillPossible(merged, key, {
          checkWhiteAdjacentTurn: false,
        })
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
    return geometry
      .getTurnCandidates(first.neighborKey, direction)
      .some((line) => {
        if (geometry.getLineMark(overlay, line.lineKey) === 'blank') {
          return false
        }
        const turnOverlay = new Map<string, LineMark>()
        if (!addMasyuOverlayDecision(turnOverlay, line.lineKey, 'line')) {
          return false
        }
        if (
          second &&
          !addMasyuOverlayDecision(turnOverlay, second.lineKey, 'blank')
        ) {
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
    const lineEntries = geometry
      .getIncidentEntries(overlay, key)
      .filter((item) => item.mark === 'line')
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
        return (
          extension !== null &&
          geometry.getLineMark(overlay, extension.lineKey) !== 'blank'
        )
      })
    }
    if (!areMasyuDirectionsOpposite(left.direction, right.direction)) {
      return false
    }
    if (options.checkWhiteAdjacentTurn === false) {
      return true
    }
    return [left.direction, right.direction].some((direction) =>
      canWhiteSideTurn(overlay, key, direction),
    )
  }

  const hasAnyBlackPearlCandidate = (
    overlay: MasyuLineOverlay,
    key: string,
  ): boolean =>
    BLACK_CANDIDATE_EXIT_PAIRS.some((exits) => {
      const candidate = buildMasyuBlackPearlCandidate(
        exits,
        (direction) => geometry.getTwoStep(key, direction),
        () => geometry.getIncident(key),
      )
      const candidateOverlay = candidate
        ? masyuPearlCandidateToOverlay(candidate)
        : null
      return (
        candidateOverlay !== null &&
        canApplyLocalDecisions(overlay, candidateOverlay)
      )
    })

  const hasAnyWhitePearlCandidate = (
    overlay: MasyuLineOverlay,
    key: string,
  ): boolean =>
    WHITE_CANDIDATE_AXES.some((axis) => {
      const candidate = buildMasyuWhitePearlCandidate(
        axis,
        () => geometry.getIncident(key),
        (direction, axisOverlay) =>
          canWhiteSideTurn(axisOverlay, key, direction),
      )
      const axisOverlay = candidate
        ? masyuPearlCandidateToOverlay(candidate)
        : null
      const merged = axisOverlay
        ? mergeMasyuLineOverlay(overlay, axisOverlay)
        : null
      return (
        axisOverlay !== null &&
        merged !== null &&
        canApplyLocalDecisions(overlay, axisOverlay) &&
        candidate !== null &&
        candidate.turnableSides.size > 0 &&
        axis.some((direction) => canWhiteSideTurn(merged, key, direction))
      )
    })

  const areAffectedPearlsStillPossible = (
    overlay: MasyuLineOverlay,
    centerKeys: Iterable<string>,
  ): boolean => {
    const affected = geometry.getAffectedPearls(overlay)
    for (const centerKey of centerKeys) {
      affected.add(centerKey)
    }
    for (const key of affected) {
      const color = geometry.pearlColors.get(key)
      if (!color) {
        continue
      }
      const possible =
        color === 'black'
          ? hasAnyBlackPearlCandidate(overlay, key)
          : hasAnyWhitePearlCandidate(overlay, key)
      if (!possible) {
        return false
      }
    }
    return true
  }

  const wouldCreatePrematureLoop = (
    assumedLineEndpoints: Iterable<[left: number, right: number]>,
  ): boolean => {
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
      lineCounts.set(
        left,
        (lineCounts.get(left) ?? 0) + (lineCounts.get(right) ?? 0),
      )
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

  const hasPrematureLoopFromCandidate = (
    candidate: BlackPearlCandidate,
  ): boolean => {
    const assumedLineEndpoints: Array<[left: number, right: number]> = []
    for (const lineKeyValue of candidate.lines) {
      if ((puzzle.lines[lineKeyValue]?.mark ?? 'unknown') === 'line') {
        continue
      }
      assumedLineEndpoints.push(geometry.lineEndpoints(lineKeyValue))
    }
    return (
      assumedLineEndpoints.length > 0 &&
      wouldCreatePrematureLoop(assumedLineEndpoints)
    )
  }

  const hasPrematureLoopFromOverlay = (overlay: MasyuLineOverlay): boolean => {
    const assumedLineEndpoints: Array<[left: number, right: number]> = []
    for (const [lineKeyValue, mark] of overlay.entries()) {
      if (mark !== 'line') {
        continue
      }
      if ((puzzle.lines[lineKeyValue]?.mark ?? 'unknown') === 'line') {
        continue
      }
      assumedLineEndpoints.push(geometry.lineEndpoints(lineKeyValue))
    }
    return (
      assumedLineEndpoints.length > 0 &&
      wouldCreatePrematureLoop(assumedLineEndpoints)
    )
  }

  const isOverlayLocallyFeasible = (
    centerKeys: Iterable<string>,
    overlay: MasyuLineOverlay,
  ): boolean => {
    if (!isOverlayConsistentWithPuzzle(overlay)) {
      return false
    }
    for (const key of geometry.getTouchedCells(overlay.keys())) {
      if (
        !isCellLocallyFeasible(overlay, key) ||
        !isPearlShapeStillPossible(overlay, key)
      ) {
        return false
      }
    }
    if (hasPrematureLoopFromOverlay(overlay)) {
      return false
    }
    return areAffectedPearlsStillPossible(overlay, centerKeys)
  }

  const isBlackPearlCandidateFeasible = (
    pearlKey: string,
    candidate: BlackPearlCandidate,
  ): boolean => {
    const overlay = masyuPearlCandidateToOverlay(candidate)
    if (!overlay || !isOverlayConsistentWithPuzzle(overlay)) {
      return false
    }
    for (const key of geometry.getTouchedCells([
      ...candidate.lines,
      ...candidate.blanks,
    ])) {
      if (
        !isCellLocallyFeasible(overlay, key) ||
        !isPearlShapeStillPossible(overlay, key)
      ) {
        return false
      }
    }
    if (hasPrematureLoopFromCandidate(candidate)) {
      return false
    }
    return areAffectedPearlsStillPossible(overlay, [pearlKey])
  }

  const getFeasibleBlackPearlCandidates = (
    pearlKey: string,
  ): BlackPearlCandidate[] => {
    const incidentLines = geometry
      .getIncidentEntries(new Map(), pearlKey)
      .filter((item) => item.mark === 'line')
    if (incidentLines.length >= 2) {
      return []
    }
    return BLACK_CANDIDATE_EXIT_PAIRS.flatMap((exits) => {
      const candidate = buildMasyuBlackPearlCandidate(
        exits,
        (direction) => geometry.getTwoStep(pearlKey, direction),
        () => geometry.getIncident(pearlKey),
      )
      return candidate && isBlackPearlCandidateFeasible(pearlKey, candidate)
        ? [candidate]
        : []
    })
  }

  const isWhitePearlCandidateFeasible = (
    pearlKey: string,
    candidate: WhitePearlCandidate,
  ): boolean => {
    const overlay = masyuPearlCandidateToOverlay(candidate)
    if (!overlay || !isOverlayConsistentWithPuzzle(overlay)) {
      return false
    }
    if (
      !canApplyLocalDecisions(new Map(), overlay) ||
      candidate.turnableSides.size === 0
    ) {
      return false
    }
    return areAffectedPearlsStillPossible(overlay, [pearlKey])
  }

  const getFeasibleWhitePearlCandidates = (
    pearlKey: string,
  ): WhitePearlCandidate[] => {
    const incidentLines = geometry
      .getIncidentEntries(new Map(), pearlKey)
      .filter((item) => item.mark === 'line')
    if (incidentLines.length >= 2) {
      return []
    }
    return WHITE_CANDIDATE_AXES.flatMap((axis) => {
      const candidate = buildMasyuWhitePearlCandidate(
        axis,
        () => geometry.getIncident(pearlKey),
        (direction, axisOverlay) =>
          canWhiteSideTurn(axisOverlay, pearlKey, direction),
      )
      return candidate && isWhitePearlCandidateFeasible(pearlKey, candidate)
        ? [candidate]
        : []
    })
  }

  return {
    getBlackPearlKeys: () => geometry.blackPearlKeys,
    getWhitePearlKeys: () => geometry.whitePearlKeys,
    getIncidentEntries: geometry.getIncidentEntries,
    isOverlayLocallyFeasible,
    getFeasibleBlackPearlCandidates,
    getFeasibleWhitePearlCandidates,
  }
}

export const getMasyuLookaheadContext = (
  puzzle: PuzzleIR,
  runtimeContext?: RuleRuntimeContext,
): MasyuLookaheadContext => {
  if (!runtimeContext) {
    return createMasyuLookaheadContext(puzzle)
  }
  const cached = runtimeContext.cache.get(MASYU_LOOKAHEAD_CONTEXT_CACHE_KEY)
  if (cached) {
    return cached as MasyuLookaheadContext
  }
  const context = createMasyuLookaheadContext(puzzle)
  runtimeContext.cache.set(MASYU_LOOKAHEAD_CONTEXT_CACHE_KEY, context)
  return context
}
