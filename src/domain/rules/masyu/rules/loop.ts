import { cellKey, parseLineKey } from '../../../ir/keys'
import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import {
  findMasyuPrematureLoopClosingLines,
  hasMasyuPrematureLoop,
  type MasyuLineOverlay,
} from './lineGraph'
import {
  formatMasyuCellKeyLabel,
  getMasyuIncidentDirectionalLines,
  MASYU_DIRECTIONS,
  type MasyuDirectionalLine,
} from './shared'

export type { MasyuLineOverlay }

export { findMasyuPrematureLoopClosingLines, hasMasyuPrematureLoop }

export type MasyuEmptyCellPrematureLoopCandidate = {
  cellKey: string
  exits: [MasyuDirectionalLine, MasyuDirectionalLine]
}

type MasyuEmptyCellLoopSnapshot = {
  wouldCreatePrematureLoopWithLines: (lineKeys: [string, string]) => boolean
}

type ComponentStats = {
  edgeCount: number
  vertexCount: number
}

const createMasyuEmptyCellLoopSnapshot = (
  puzzle: PuzzleIR,
): MasyuEmptyCellLoopSnapshot => {
  const cellCount = puzzle.rows * puzzle.cols
  const parent = Array.from({ length: cellCount }, (_, idx) => idx)
  const rank = new Array<number>(cellCount).fill(0)
  const lineEndpoints = new Map<string, [left: number, right: number]>()

  const toCellIndex = (row: number, col: number): number =>
    row * puzzle.cols + col

  const getLineEndpoints = (
    lineKeyValue: string,
  ): [left: number, right: number] => {
    const cached = lineEndpoints.get(lineKeyValue)
    if (cached) {
      return cached
    }
    const [left, right] = parseLineKey(lineKeyValue)
    const endpoints: [number, number] = [
      toCellIndex(left[0], left[1]),
      toCellIndex(right[0], right[1]),
    ]
    lineEndpoints.set(lineKeyValue, endpoints)
    return endpoints
  }

  const find = (idx: number): number => {
    if (parent[idx] !== idx) {
      parent[idx] = find(parent[idx])
    }
    return parent[idx]
  }

  const union = (left: number, right: number): void => {
    const rootA = find(left)
    const rootB = find(right)
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

  const lineKeys = Object.keys(puzzle.lines)
  const knownLineKeys = lineKeys.filter(
    (lineKeyValue) => (puzzle.lines[lineKeyValue]?.mark ?? 'unknown') === 'line',
  )

  for (const lineKeyValue of knownLineKeys) {
    const [left, right] = getLineEndpoints(lineKeyValue)
    union(left, right)
  }

  const baseStats = new Map<number, ComponentStats>()
  const baseVertices = new Map<number, Set<number>>()
  for (const lineKeyValue of knownLineKeys) {
    const [left, right] = getLineEndpoints(lineKeyValue)
    const root = find(left)
    const vertices = baseVertices.get(root) ?? new Set<number>()
    vertices.add(left)
    vertices.add(right)
    baseVertices.set(root, vertices)
    const stats = baseStats.get(root) ?? { edgeCount: 0, vertexCount: 0 }
    stats.edgeCount += 1
    baseStats.set(root, stats)
  }
  for (const [root, vertices] of baseVertices) {
    const stats = baseStats.get(root)
    if (stats) {
      stats.vertexCount = vertices.size
    }
  }

  const totalBaseLineCount = knownLineKeys.length

  const wouldCreatePrematureLoopWithLines = (
    assumedLineKeys: [string, string],
  ): boolean => {
    const localParent = new Map<number, number>()
    const localStats = new Map<number, ComponentStats>()
    const countedIsolatedRoots = new Set<number>()

    const ensureRoot = (root: number): void => {
      if (!localParent.has(root)) {
        localParent.set(root, root)
        const stats = baseStats.get(root)
        localStats.set(root, {
          edgeCount: stats?.edgeCount ?? 0,
          vertexCount: stats?.vertexCount ?? 0,
        })
      }
    }

    const findLocal = (root: number): number => {
      ensureRoot(root)
      const current = localParent.get(root)
      if (current === undefined || current === root) {
        return root
      }
      const next = findLocal(current)
      localParent.set(root, next)
      return next
    }

    const countTouchedEndpoint = (root: number): void => {
      ensureRoot(root)
      if (baseStats.has(root) || countedIsolatedRoots.has(root)) {
        return
      }
      countedIsolatedRoots.add(root)
      const localRoot = findLocal(root)
      const stats = localStats.get(localRoot)
      if (stats) {
        stats.vertexCount += 1
      }
    }

    const addAssumedLine = (lineKeyValue: string): void => {
      const [left, right] = getLineEndpoints(lineKeyValue)
      const leftRoot = find(left)
      const rightRoot = find(right)
      countTouchedEndpoint(leftRoot)
      countTouchedEndpoint(rightRoot)

      const localLeft = findLocal(leftRoot)
      const localRight = findLocal(rightRoot)
      if (localLeft === localRight) {
        const stats = localStats.get(localLeft)
        if (stats) {
          stats.edgeCount += 1
        }
        return
      }

      const leftStats = localStats.get(localLeft) ?? {
        edgeCount: 0,
        vertexCount: 0,
      }
      const rightStats = localStats.get(localRight) ?? {
        edgeCount: 0,
        vertexCount: 0,
      }
      localParent.set(localRight, localLeft)
      localStats.set(localLeft, {
        edgeCount: leftStats.edgeCount + rightStats.edgeCount + 1,
        vertexCount: leftStats.vertexCount + rightStats.vertexCount,
      })
      localStats.delete(localRight)
    }

    for (const lineKeyValue of assumedLineKeys) {
      addAssumedLine(lineKeyValue)
    }

    const totalLineCount = totalBaseLineCount + assumedLineKeys.length
    return [...localParent.keys()].some((root) => {
      if (findLocal(root) !== root) {
        return false
      }
      const stats = localStats.get(root)
      return (
        stats !== undefined &&
        stats.edgeCount >= stats.vertexCount &&
        totalLineCount > stats.edgeCount
      )
    })
  }

  return { wouldCreatePrematureLoopWithLines }
}

export const findMasyuEmptyCellPrematureLoopCandidates = (
  puzzle: PuzzleIR,
): MasyuEmptyCellPrematureLoopCandidate[] => {
  const candidates: MasyuEmptyCellPrematureLoopCandidate[] = []
  const snapshot = createMasyuEmptyCellLoopSnapshot(puzzle)

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      if (puzzle.cells[key]?.clue?.kind === 'pearl') {
        continue
      }

      const incidentByDirection = getMasyuIncidentDirectionalLines(puzzle, key)
      const incident = MASYU_DIRECTIONS.flatMap((direction) => {
        const item = incidentByDirection[direction]
        return item ? [item] : []
      })
      const lineCount = incident.filter((item) => item.mark === 'line').length
      const available = incident.filter((item) => item.mark !== 'blank')
      const unknowns = available.filter((item) => item.mark === 'unknown')
      if (
        lineCount !== 0 ||
        available.length !== 2 ||
        unknowns.length !== 2
      ) {
        continue
      }

      if (
        snapshot.wouldCreatePrematureLoopWithLines([
          unknowns[0].lineKey,
          unknowns[1].lineKey,
        ])
      ) {
        candidates.push({
          cellKey: key,
          exits: [unknowns[0], unknowns[1]],
        })
      }
    }
  }

  return candidates
}

export const createPreventPrematureLoopRule = (): Rule => ({
  id: 'masyu-prevent-premature-loop',
  name: 'Prevent Premature Loop',
  apply: (puzzle): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)

    for (const lineKeyValue of findMasyuPrematureLoopClosingLines(puzzle)) {
      decisions.add(lineKeyValue, 'blank')
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    const firstExample = decisions.firstLineLabel()
    return {
      message:
        firstExample !== null
          ? `${firstExample} would close a smaller loop while other lines remain outside it, so it must be blank.`
          : 'Lines that would close a smaller loop while other lines remain outside it are blank.',
      diffs,
      affectedCells: [],
      affectedLines: decisions.affectedLines(),
    }
  },
})

export const createMasyuEmptyCellPrematureLoopRule = (): Rule => ({
  id: 'masyu-empty-cell-premature-loop',
  name: 'Masyu Empty Cell Premature Loop',
  apply: (puzzle): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells: string[] = []

    for (const candidate of findMasyuEmptyCellPrematureLoopCandidates(puzzle)) {
      const beforeSize = decisions.decisions.size
      for (const exit of candidate.exits) {
        decisions.add(exit.lineKey, 'blank')
      }
      if (decisions.decisions.size > beforeSize) {
        affectedCells.push(candidate.cellKey)
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    const firstCell = affectedCells[0]
    return {
      message: firstCell
        ? `Empty cell ${formatMasyuCellKeyLabel(firstCell)} cannot use both remaining exits because that would close a smaller loop, so both exits are blank.`
        : 'Empty cells that would close a smaller loop by using both remaining exits have those exits crossed out.',
      diffs,
      affectedCells,
      affectedLines: decisions.affectedLines(),
    }
  },
})
