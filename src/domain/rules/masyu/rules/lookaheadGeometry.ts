import { cellKey, parseCellKey, parseLineKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import {
  getMasyuIncidentDirectionalLines,
  getMasyuTurnCandidateLines,
  getMasyuTwoStepLine,
  MASYU_DIRECTIONS,
  type MasyuDirection,
  type MasyuDirectionalLine,
  type MasyuTwoStepLine,
} from './shared'
import type { MasyuLineOverlay } from './loop'

type PearlColor = 'white' | 'black'

export type MasyuLookaheadGeometry = {
  blackPearlKeys: string[]
  pearlColors: Map<string, PearlColor>
  baseLineCounts: Map<number, number>
  totalBaseLineCount: number
  findBase: (idx: number) => number
  lineEndpoints: (lineKeyValue: string) => [left: number, right: number]
  getIncident: (key: string) => Record<MasyuDirection, MasyuDirectionalLine | null>
  getTwoStep: (key: string, direction: MasyuDirection) => MasyuTwoStepLine
  getTurnCandidates: (key: string, throughDirection: MasyuDirection) => MasyuDirectionalLine[]
  getLineMark: (overlay: MasyuLineOverlay, key: string) => LineMark
  getIncidentEntries: (overlay: MasyuLineOverlay, key: string) => MasyuDirectionalLine[]
  getTouchedCells: (lineKeys: Iterable<string>) => Set<string>
  getAffectedPearls: (overlay: MasyuLineOverlay) => Set<string>
}

export const createMasyuLookaheadGeometry = (puzzle: PuzzleIR): MasyuLookaheadGeometry => {
  const blackPearlKeys: string[] = []
  const pearlColors = new Map<string, PearlColor>()
  const incidentCache = new Map<string, Record<MasyuDirection, MasyuDirectionalLine | null>>()
  const twoStepCache = new Map<string, Record<MasyuDirection, MasyuTwoStepLine>>()
  const turnCandidateCache = new Map<string, Record<MasyuDirection, MasyuDirectionalLine[]>>()
  const lineEndpointCache = new Map<string, [left: number, right: number]>()
  const lineCellCache = new Map<string, [left: string, right: string]>()
  const dependencyCellPearls = new Map<string, Set<string>>()
  const dependencyLinePearls = new Map<string, Set<string>>()
  const cellCount = puzzle.rows * puzzle.cols
  const baseParent = Array.from({ length: cellCount }, (_, idx) => idx)
  const baseRank = new Array<number>(cellCount).fill(0)
  const baseLineCounts = new Map<number, number>()
  let totalBaseLineCount = 0

  const toCellIndex = (row: number, col: number): number => row * puzzle.cols + col

  const findBase = (idx: number): number => {
    if (baseParent[idx] !== idx) {
      baseParent[idx] = findBase(baseParent[idx])
    }
    return baseParent[idx]
  }

  const unionBase = (a: number, b: number): void => {
    const rootA = findBase(a)
    const rootB = findBase(b)
    if (rootA === rootB) {
      return
    }
    if (baseRank[rootA] < baseRank[rootB]) {
      baseParent[rootA] = rootB
    } else if (baseRank[rootA] > baseRank[rootB]) {
      baseParent[rootB] = rootA
    } else {
      baseParent[rootB] = rootA
      baseRank[rootA] += 1
    }
  }

  const lineEndpoints = (lineKeyValue: string): [left: number, right: number] => {
    const cached = lineEndpointCache.get(lineKeyValue)
    if (cached) {
      return cached
    }
    const [left, right] = parseLineKey(lineKeyValue)
    const endpoints: [number, number] = [toCellIndex(left[0], left[1]), toCellIndex(right[0], right[1])]
    lineEndpointCache.set(lineKeyValue, endpoints)
    lineCellCache.set(lineKeyValue, [cellKey(left[0], left[1]), cellKey(right[0], right[1])])
    return endpoints
  }

  const lineCells = (lineKeyValue: string): [left: string, right: string] => {
    const cached = lineCellCache.get(lineKeyValue)
    if (cached) {
      return cached
    }
    lineEndpoints(lineKeyValue)
    const cells = lineCellCache.get(lineKeyValue)
    if (!cells) {
      throw new Error(`Missing Masyu line geometry for ${lineKeyValue}`)
    }
    return cells
  }

  const addDependency = (index: Map<string, Set<string>>, key: string, pearlKey: string): void => {
    const set = index.get(key) ?? new Set<string>()
    set.add(pearlKey)
    index.set(key, set)
  }

  const getIncident = (key: string): Record<MasyuDirection, MasyuDirectionalLine | null> => {
    const cached = incidentCache.get(key)
    if (cached) {
      return cached
    }
    const incident = getMasyuIncidentDirectionalLines(puzzle, key)
    incidentCache.set(key, incident)
    return incident
  }

  const getTwoStep = (key: string, direction: MasyuDirection): MasyuTwoStepLine => {
    const cached = twoStepCache.get(key)
    if (cached) {
      return cached[direction]
    }
    const twoStep = {
      N: getMasyuTwoStepLine(puzzle, key, 'N'),
      E: getMasyuTwoStepLine(puzzle, key, 'E'),
      S: getMasyuTwoStepLine(puzzle, key, 'S'),
      W: getMasyuTwoStepLine(puzzle, key, 'W'),
    }
    twoStepCache.set(key, twoStep)
    return twoStep[direction]
  }

  const getTurnCandidates = (key: string, throughDirection: MasyuDirection): MasyuDirectionalLine[] => {
    const cached = turnCandidateCache.get(key)
    if (cached) {
      return cached[throughDirection]
    }
    const turnCandidates = {
      N: getMasyuTurnCandidateLines(puzzle, key, 'N'),
      E: getMasyuTurnCandidateLines(puzzle, key, 'E'),
      S: getMasyuTurnCandidateLines(puzzle, key, 'S'),
      W: getMasyuTurnCandidateLines(puzzle, key, 'W'),
    }
    turnCandidateCache.set(key, turnCandidates)
    return turnCandidates[throughDirection]
  }

  const registerPearlDependencies = (pearlKey: string): void => {
    const addCell = (key: string): void => addDependency(dependencyCellPearls, key, pearlKey)
    const addLine = (key: string): void => addDependency(dependencyLinePearls, key, pearlKey)
    addCell(pearlKey)
    for (const direction of MASYU_DIRECTIONS) {
      const { first, second } = getTwoStep(pearlKey, direction)
      for (const line of [first, second]) {
        if (!line) {
          continue
        }
        addLine(line.lineKey)
        const [left, right] = lineCells(line.lineKey)
        addCell(left)
        addCell(right)
      }
      if (!first) {
        continue
      }
      for (const line of getTurnCandidates(first.neighborKey, direction)) {
        addLine(line.lineKey)
        const [left, right] = lineCells(line.lineKey)
        addCell(left)
        addCell(right)
      }
    }
  }

  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    lineEndpoints(lineKeyValue)
    if ((puzzle.lines[lineKeyValue]?.mark ?? 'unknown') !== 'line') {
      continue
    }
    const [left, right] = lineEndpoints(lineKeyValue)
    unionBase(left, right)
    totalBaseLineCount += 1
  }

  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    if ((puzzle.lines[lineKeyValue]?.mark ?? 'unknown') !== 'line') {
      continue
    }
    const [left] = lineEndpoints(lineKeyValue)
    const root = findBase(left)
    baseLineCounts.set(root, (baseLineCounts.get(root) ?? 0) + 1)
  }

  for (const [key, cell] of Object.entries(puzzle.cells)) {
    const clue = cell.clue
    if (clue?.kind !== 'pearl') {
      continue
    }
    pearlColors.set(key, clue.color)
    if (clue.color === 'black') {
      blackPearlKeys.push(key)
    }
    registerPearlDependencies(key)
  }

  const getLineMark = (overlay: MasyuLineOverlay, key: string): LineMark =>
    overlay.get(key) ?? puzzle.lines[key]?.mark ?? 'unknown'

  const getIncidentEntries = (overlay: MasyuLineOverlay, key: string): MasyuDirectionalLine[] => {
    const incident = getIncident(key)
    return MASYU_DIRECTIONS.flatMap((direction) => {
      const item = incident[direction]
      return item ? [{ ...item, mark: getLineMark(overlay, item.lineKey) }] : []
    })
  }

  const getTouchedCells = (lineKeys: Iterable<string>): Set<string> => {
    const cells = new Set<string>()
    for (const lineKeyValue of lineKeys) {
      const [left, right] = lineCells(lineKeyValue)
      cells.add(left)
      cells.add(right)
    }
    return cells
  }

  const getPearlsAtOrAdjacentToCell = (key: string): Set<string> => {
    const pearls = new Set<string>()
    const [row, col] = parseCellKey(key)
    const cells = [
      [row, col],
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]
    for (const [cellRow, cellCol] of cells) {
      if (cellRow < 0 || cellRow >= puzzle.rows || cellCol < 0 || cellCol >= puzzle.cols) {
        continue
      }
      const pearlKey = cellKey(cellRow, cellCol)
      if (pearlColors.has(pearlKey)) {
        pearls.add(pearlKey)
      }
    }
    return pearls
  }

  const getAffectedPearls = (overlay: MasyuLineOverlay): Set<string> => {
    const affected = new Set<string>()
    const touchedCells = getTouchedCells(overlay.keys())
    for (const key of touchedCells) {
      for (const pearlKey of getPearlsAtOrAdjacentToCell(key)) {
        affected.add(pearlKey)
      }
      for (const pearlKey of dependencyCellPearls.get(key) ?? []) {
        affected.add(pearlKey)
      }
    }
    for (const lineKeyValue of overlay.keys()) {
      for (const pearlKey of dependencyLinePearls.get(lineKeyValue) ?? []) {
        affected.add(pearlKey)
      }
    }
    return affected
  }

  return {
    blackPearlKeys,
    pearlColors,
    baseLineCounts,
    totalBaseLineCount,
    findBase,
    lineEndpoints,
    getIncident,
    getTwoStep,
    getTurnCandidates,
    getLineMark,
    getIncidentEntries,
    getTouchedCells,
    getAffectedPearls,
  }
}
