import type { LineMark } from '../../../ir/types'
import type { MasyuLineOverlay } from './lineGraph'
import {
  MASYU_DIRECTIONS,
  type MasyuDirection,
  type MasyuDirectionalLine,
  type MasyuTwoStepLine,
} from './shared'

export type BlackPearlCandidate = {
  color: 'black'
  exits: [MasyuDirection, MasyuDirection]
  lines: Set<string>
  exitLines: Set<string>
  extensionLines: Set<string>
  blanks: Set<string>
}

export type WhitePearlCandidate = {
  color: 'white'
  axis: [MasyuDirection, MasyuDirection]
  lines: Set<string>
  exitLines: Set<string>
  blanks: Set<string>
  turnableSides: Set<MasyuDirection>
}

export type PearlCandidate = BlackPearlCandidate | WhitePearlCandidate

export const BLACK_CANDIDATE_EXIT_PAIRS: [MasyuDirection, MasyuDirection][] = [
  ['N', 'E'],
  ['N', 'W'],
  ['S', 'E'],
  ['S', 'W'],
]

export const WHITE_CANDIDATE_AXES: [MasyuDirection, MasyuDirection][] = [
  ['N', 'S'],
  ['E', 'W'],
]

export const addMasyuOverlayDecision = (
  overlay: Map<string, LineMark>,
  lineKeyValue: string,
  mark: LineMark,
): boolean => {
  const existing = overlay.get(lineKeyValue)
  if (existing !== undefined) {
    return existing === mark
  }
  overlay.set(lineKeyValue, mark)
  return true
}

export const mergeMasyuLineOverlay = (
  base: MasyuLineOverlay,
  next: MasyuLineOverlay,
): Map<string, LineMark> | null => {
  const merged = new Map<string, LineMark>(base)
  for (const [lineKeyValue, mark] of next.entries()) {
    if (!addMasyuOverlayDecision(merged, lineKeyValue, mark)) {
      return null
    }
  }
  return merged
}

export const masyuPearlCandidateToOverlay = (
  candidate: PearlCandidate,
): Map<string, LineMark> | null => {
  const overlay = new Map<string, LineMark>()
  for (const lineKeyValue of candidate.lines) {
    if (!addMasyuOverlayDecision(overlay, lineKeyValue, 'line')) {
      return null
    }
  }
  for (const lineKeyValue of candidate.blanks) {
    if (!addMasyuOverlayDecision(overlay, lineKeyValue, 'blank')) {
      return null
    }
  }
  return overlay
}

export const buildMasyuBlackPearlCandidate = (
  exits: [MasyuDirection, MasyuDirection],
  getTwoStep: (direction: MasyuDirection) => MasyuTwoStepLine,
  getIncident: () => Record<MasyuDirection, MasyuDirectionalLine | null>,
): BlackPearlCandidate | null => {
  const candidate: BlackPearlCandidate = {
    color: 'black',
    exits,
    lines: new Set<string>(),
    exitLines: new Set<string>(),
    extensionLines: new Set<string>(),
    blanks: new Set<string>(),
  }

  for (const direction of exits) {
    const { first, second } = getTwoStep(direction)
    if (!first || !second) {
      return null
    }
    candidate.lines.add(first.lineKey)
    candidate.lines.add(second.lineKey)
    candidate.exitLines.add(first.lineKey)
    candidate.extensionLines.add(second.lineKey)
  }

  const selected = new Set<MasyuDirection>(exits)
  const incident = getIncident()
  for (const direction of MASYU_DIRECTIONS) {
    if (!selected.has(direction) && incident[direction]) {
      candidate.blanks.add(incident[direction].lineKey)
    }
  }

  return candidate
}

export const buildMasyuWhitePearlCandidate = (
  axis: [MasyuDirection, MasyuDirection],
  getIncident: () => Record<MasyuDirection, MasyuDirectionalLine | null>,
  canSideTurn: (
    direction: MasyuDirection,
    axisOverlay: MasyuLineOverlay,
  ) => boolean,
): WhitePearlCandidate | null => {
  const candidate: WhitePearlCandidate = {
    color: 'white',
    axis,
    lines: new Set<string>(),
    exitLines: new Set<string>(),
    blanks: new Set<string>(),
    turnableSides: new Set<MasyuDirection>(),
  }
  const selected = new Set<MasyuDirection>(axis)
  const incident = getIncident()

  for (const direction of axis) {
    const line = incident[direction]
    if (!line) {
      return null
    }
    candidate.lines.add(line.lineKey)
    candidate.exitLines.add(line.lineKey)
  }
  for (const direction of MASYU_DIRECTIONS) {
    if (!selected.has(direction) && incident[direction]) {
      candidate.blanks.add(incident[direction].lineKey)
    }
  }

  const overlay = masyuPearlCandidateToOverlay(candidate)
  if (!overlay) {
    return null
  }
  for (const direction of axis) {
    if (canSideTurn(direction, overlay)) {
      candidate.turnableSides.add(direction)
    }
  }

  return candidate
}
