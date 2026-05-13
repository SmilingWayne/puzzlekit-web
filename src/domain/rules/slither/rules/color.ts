import { cellKey, edgeKey, sectorKey } from '../../../ir/keys'
import {
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_ONLY_1,
  type EdgeMark,
  type PuzzleIR,
  type SectorConstraintMask,
  type SectorCorner,
  sectorMaskAllows,
  sectorMaskIntersect,
} from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  getCellNeighborKeys,
  getEdgeAdjacentCellKeys,
  formatCellKeyLabel,
  formatEdgeLabel,
  formatSectorLabel,
  isSlitherCellColor,
  oppositeSlitherCellColor,
  type SlitherCellColor,
} from './shared'

export const createColorEdgePropagationRule = (): Rule => ({
  id: 'color-edge-propagation',
  name: 'Color-Edge Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    let firstReason: string | null = null

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberEdge = (key: string, to: EdgeMark): boolean => {
      const alreadyDecided = decidedEdges.get(key)
      if (alreadyDecided) {
        return alreadyDecided === to
      }
      const current = puzzle.edges[key]?.mark ?? 'unknown'
      if (current !== 'unknown') {
        return current === to
      }
      decidedEdges.set(key, to)
      return true
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      return true
    }

    const edgeKeys = Object.keys(puzzle.edges)
    const adjacentCellsByEdge = new Map<string, [string] | [string, string]>()
    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 1 && adjacentCells.length !== 2) {
        continue
      }
      adjacentCellsByEdge.set(
        edgeKeyValue,
        adjacentCells.length === 1 ? [adjacentCells[0]] : [adjacentCells[0], adjacentCells[1]],
      )
    }

    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = adjacentCellsByEdge.get(edgeKeyValue)
      if (!adjacentCells) {
        continue
      }
      if (adjacentCells.length === 1) {
        const [cell] = adjacentCells
        const color = getEffectiveCellColor(cell)
        if (color === null) {
          continue
        }
        const toMark: EdgeMark = color === 'green' ? 'line' : 'blank'
        if (!rememberEdge(edgeKeyValue, toMark)) {
          continue
        }
        if (decidedEdges.get(edgeKeyValue) === toMark) {
          affectedCells.add(cell)
          if (firstReason === null) {
            firstReason =
              toMark === 'line'
                ? `${formatCellKeyLabel(cell)} is inside, so boundary ${formatEdgeLabel(edgeKeyValue)} must be a line`
                : `${formatCellKeyLabel(cell)} is outside, so boundary ${formatEdgeLabel(edgeKeyValue)} must be blank`
          }
        }
        continue
      }
      const [cellA, cellB] = adjacentCells
      const colorA = getEffectiveCellColor(cellA)
      const colorB = getEffectiveCellColor(cellB)
      if (colorA === null || colorB === null) {
        continue
      }
      const toMark: EdgeMark = colorA === colorB ? 'blank' : 'line'
      if (!rememberEdge(edgeKeyValue, toMark)) {
        continue
      }
      if (decidedEdges.get(edgeKeyValue) === toMark) {
        affectedCells.add(cellA)
        affectedCells.add(cellB)
        if (firstReason === null) {
          firstReason =
            toMark === 'line'
              ? `${formatCellKeyLabel(cellA)} and ${formatCellKeyLabel(cellB)} have different colors, so their shared edge is a line`
              : `${formatCellKeyLabel(cellA)} and ${formatCellKeyLabel(cellB)} have the same color, so their shared edge is blank`
        }
      }
    }

    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = adjacentCellsByEdge.get(edgeKeyValue)
      if (!adjacentCells) {
        continue
      }
      if (adjacentCells.length !== 2) {
        continue
      }
      const [cellA, cellB] = adjacentCells
      const effectiveMark = decidedEdges.get(edgeKeyValue) ?? (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown')
      if (effectiveMark !== 'line' && effectiveMark !== 'blank') {
        continue
      }
      const colorA = getEffectiveCellColor(cellA)
      const colorB = getEffectiveCellColor(cellB)
      if ((colorA === null) === (colorB === null)) {
        continue
      }
      const knownColor = colorA ?? colorB
      if (knownColor === null) {
        continue
      }
      const targetCell = colorA === null ? cellA : cellB
      const inferredColor = effectiveMark === 'line' ? oppositeSlitherCellColor(knownColor) : knownColor
      if (!rememberCellFill(targetCell, inferredColor)) {
        continue
      }
      affectedCells.add(cellA)
      affectedCells.add(cellB)
      if (firstReason === null) {
        firstReason =
          effectiveMark === 'line'
            ? `${formatEdgeLabel(edgeKeyValue)} is a line, so adjacent cells must have opposite colors`
            : `${formatEdgeLabel(edgeKeyValue)} is blank, so adjacent cells must have the same color`
      }
    }

    if (decidedEdges.size === 0 && decidedCellFills.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = [
      ...Array.from(decidedEdges.entries(), ([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      ...Array.from(decidedCellFills.entries(), ([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
    ]

    const edgeCount = decidedEdges.size
    const colorCount = decidedCellFills.size
    return {
      message: `${firstReason ?? 'Known color-edge relations propagate across the grid'} (${edgeCount} edge update(s), ${colorCount} color update(s)).`,
      diffs,
      affectedCells: [...affectedCells],
    }
  },
})

export const createColorOutsideSeedingRule = (): Rule => ({
  id: 'color-outside-seeding',
  name: 'Color Outside Seeding',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    type Parity = 0 | 1

    const parent = new Map<string, string>()
    const rank = new Map<string, number>()
    const parityToParent = new Map<string, Parity>()
    const inconsistentRoots = new Set<string>()

    const ensureCell = (key: string): void => {
      if (parent.has(key)) {
        return
      }
      parent.set(key, key)
      rank.set(key, 0)
      parityToParent.set(key, 0)
    }

    const find = (key: string): { root: string; parity: Parity } => {
      ensureCell(key)
      const currentParent = parent.get(key)
      if (currentParent === undefined || currentParent === key) {
        return { root: key, parity: 0 }
      }

      const parentResult = find(currentParent)
      const currentParity = parityToParent.get(key) ?? 0
      const compressedParity = (currentParity ^ parentResult.parity) as Parity
      parent.set(key, parentResult.root)
      parityToParent.set(key, compressedParity)
      return { root: parentResult.root, parity: compressedParity }
    }

    const markInconsistent = (root: string): void => {
      inconsistentRoots.add(find(root).root)
    }

    const union = (cellA: string, cellB: string, relation: Parity): void => {
      const rootA = find(cellA)
      const rootB = find(cellB)
      if (rootA.root === rootB.root) {
        if ((rootA.parity ^ rootB.parity) !== relation) {
          markInconsistent(rootA.root)
        }
        return
      }

      const mergedParity = (rootA.parity ^ rootB.parity ^ relation) as Parity
      const rankA = rank.get(rootA.root) ?? 0
      const rankB = rank.get(rootB.root) ?? 0
      const rootAWasInconsistent = inconsistentRoots.delete(rootA.root)
      const rootBWasInconsistent = inconsistentRoots.delete(rootB.root)

      if (rankA < rankB) {
        parent.set(rootA.root, rootB.root)
        parityToParent.set(rootA.root, mergedParity)
        if (rootAWasInconsistent || rootBWasInconsistent) {
          inconsistentRoots.add(rootB.root)
        }
        return
      }

      parent.set(rootB.root, rootA.root)
      parityToParent.set(rootB.root, mergedParity)
      if (rankA === rankB) {
        rank.set(rootA.root, rankA + 1)
      }
      if (rootAWasInconsistent || rootBWasInconsistent) {
        inconsistentRoots.add(rootA.root)
      }
    }

    const applyParity = (color: SlitherCellColor, parity: Parity): SlitherCellColor =>
      parity === 0 ? color : oppositeSlitherCellColor(color)

    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    const anchoredRootColors = new Map<string, SlitherCellColor>()
    let firstInferredCell: string | null = null

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        ensureCell(cellKey(row, col))
      }
    }

    for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
      const mark = edgeState?.mark ?? 'unknown'
      if (mark !== 'line' && mark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
        continue
      }
      union(adjacentCells[0], adjacentCells[1], mark === 'line' ? 1 : 0)
    }

    const rememberAnchor = (key: string, color: SlitherCellColor): void => {
      const { root, parity } = find(key)
      const rootColor = applyParity(color, parity)
      const current = anchoredRootColors.get(root)
      if (current !== undefined && current !== rootColor) {
        markInconsistent(root)
        return
      }
      anchoredRootColors.set(root, rootColor)
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const current = puzzle.cells[key]?.fill
        if (isSlitherCellColor(current)) {
          rememberAnchor(key, current)
        }
      }
    }

    for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
      const mark = edgeState?.mark ?? 'unknown'
      if (mark !== 'line' && mark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 1) {
        continue
      }
      rememberAnchor(adjacentCells[0], mark === 'line' ? 'green' : 'yellow')
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const current = puzzle.cells[key]?.fill
        if (isSlitherCellColor(current)) {
          continue
        }
        const { root, parity } = find(key)
        if (inconsistentRoots.has(root)) {
          continue
        }
        const rootColor = anchoredRootColors.get(root)
        if (rootColor === undefined) {
          continue
        }
        const inferredColor = applyParity(rootColor, parity)
        decidedCellFills.set(key, inferredColor)
        affectedCells.add(key)
        if (firstInferredCell === null) {
          firstInferredCell = formatCellKeyLabel(key)
        }
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Known colors and boundary edges anchor a parity component, so ${firstInferredCell ?? 'matching cells'} inherit inside/outside color (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

export const createColorCluePropagationRule = (): Rule => ({
  id: 'color-clue-propagation',
  name: 'Color Clue Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    let firstReason: string | null = null

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      affectedCells.add(key)
      return true
    }

    for (const [cellKeyValue, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'number' || cell.clue.value === '?') {
        continue
      }
      const clue = Number(cell.clue.value)
      const neighbors = getCellNeighborKeys(puzzle, cellKeyValue)
      const innercnt = neighbors.filter((k) => getEffectiveCellColor(k) === 'green').length
      const boundaryOutercnt = 4 - neighbors.length
      const outercnt =
        neighbors.filter((k) => getEffectiveCellColor(k) === 'yellow').length + boundaryOutercnt

      if (clue < innercnt || 4 - clue < outercnt) {
        if (rememberCellFill(cellKeyValue, 'green') && firstReason === null) {
          firstReason = `${formatCellKeyLabel(cellKeyValue)} must be inside; the neighboring outside/inside counts would otherwise exceed clue ${clue}`
        }
      }
      if (clue < outercnt || 4 - clue < innercnt) {
        if (rememberCellFill(cellKeyValue, 'yellow') && firstReason === null) {
          firstReason = `${formatCellKeyLabel(cellKeyValue)} must be outside; the neighboring inside/outside counts would otherwise exceed clue ${clue}`
        }
      }

      if (clue === 2 && outercnt === 2) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'green') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} has two outside neighbors for clue 2, so remaining neighbors are inside`
          }
        })
      }
      if (clue === 2 && innercnt === 2) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'yellow') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} has two inside neighbors for clue 2, so remaining neighbors are outside`
          }
        })
      }

      const currentColor = getEffectiveCellColor(cellKeyValue)
      if (currentColor === 'green' && clue === outercnt) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'green') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} is inside and already has enough outside neighbors for clue ${clue}, so remaining neighbors are inside`
          }
        })
      }
      if (currentColor === 'yellow' && clue === innercnt) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'yellow') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} is outside and already has enough inside neighbors for clue ${clue}, so remaining neighbors are outside`
          }
        })
      }
      if (currentColor === 'yellow' && clue === 4 - outercnt) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'green') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} is outside and all remaining neighbors must be inside to satisfy clue ${clue}`
          }
        })
      }
      if (currentColor === 'green' && clue === 4 - innercnt) {
        neighbors.forEach((neighbor) => {
          if (rememberCellFill(neighbor, 'yellow') && firstReason === null) {
            firstReason = `${formatCellKeyLabel(cellKeyValue)} is inside and all remaining neighbors must be outside to satisfy clue ${clue}`
          }
        })
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `${firstReason ?? 'A clue tightens neighboring inside/outside colors'} (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

export const createColorOrthogonalConsensusPropagationRule = (): Rule => ({
  id: 'color-orthogonal-consensus-propagation',
  name: 'Color Orthogonal Consensus Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    let firstInferredCell: string | null = null

    const inBounds = (row: number, col: number): boolean =>
      row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      affectedCells.add(key)
      return true
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const currentKey = cellKey(row, col)
        if (getEffectiveCellColor(currentKey) !== null) {
          continue
        }

        const orthogonals: Array<[number, number]> = [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ]

        const neighborColors: SlitherCellColor[] = []
        let hasUnknownNeighbor = false
        for (const [neighborRow, neighborCol] of orthogonals) {
          if (!inBounds(neighborRow, neighborCol)) {
            neighborColors.push('yellow')
            continue
          }
          const neighborColor = getEffectiveCellColor(cellKey(neighborRow, neighborCol))
          if (neighborColor === null) {
            hasUnknownNeighbor = true
            break
          }
          neighborColors.push(neighborColor)
        }

        if (hasUnknownNeighbor || neighborColors.length !== 4) {
          continue
        }

        const [firstColor, ...rest] = neighborColors
        if (!rest.every((color) => color === firstColor)) {
          continue
        }

        if (rememberCellFill(currentKey, firstColor)) {
          if (firstInferredCell === null) {
            firstInferredCell = formatCellKeyLabel(currentKey)
          }
          for (const [neighborRow, neighborCol] of orthogonals) {
            if (inBounds(neighborRow, neighborCol)) {
              affectedCells.add(cellKey(neighborRow, neighborCol))
            }
          }
        }
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `All orthogonal neighbors around ${firstInferredCell ?? 'a cell'} have the same color, so the center cell must match them (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

const isNumberClueThree = (puzzle: PuzzleIR, key: string): boolean => {
  const clue = puzzle.cells[key]?.clue
  return clue?.kind === 'number' && clue.value === 3
}

export const createInsideReachabilityColoringRule = (): Rule => ({
  id: 'inside-reachability-coloring',
  name: 'Inside Reachability Coloring',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const reachable = new Set<string>()
    const queue: string[] = []

    const inBounds = (row: number, col: number): boolean =>
      row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols

    const enqueue = (key: string): void => {
      if (reachable.has(key)) {
        return
      }
      reachable.add(key)
      queue.push(key)
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        if (puzzle.cells[key]?.fill === 'green') {
          enqueue(key)
        }
      }
    }

    if (queue.length === 0) {
      return null
    }

    const neighborSpecs: Array<{ dr: number; dc: number; edge: (row: number, col: number) => string }> = [
      { dr: -1, dc: 0, edge: (row, col) => edgeKey([row, col], [row, col + 1]) },
      { dr: 1, dc: 0, edge: (row, col) => edgeKey([row + 1, col], [row + 1, col + 1]) },
      { dr: 0, dc: -1, edge: (row, col) => edgeKey([row, col], [row + 1, col]) },
      { dr: 0, dc: 1, edge: (row, col) => edgeKey([row, col + 1], [row + 1, col + 1]) },
    ]

    for (let idx = 0; idx < queue.length; idx += 1) {
      const [row, col] = queue[idx].split(',').map(Number)
      for (const spec of neighborSpecs) {
        const neighborRow = row + spec.dr
        const neighborCol = col + spec.dc
        if (!inBounds(neighborRow, neighborCol)) {
          continue
        }
        const sharedEdge = spec.edge(row, col)
        if ((puzzle.edges[sharedEdge]?.mark ?? 'unknown') === 'line') {
          continue
        }

        const neighborKey = cellKey(neighborRow, neighborCol)
        const neighborFill = puzzle.cells[neighborKey]?.fill
        if (neighborFill === 'yellow' || isNumberClueThree(puzzle, neighborKey)) {
          continue
        }
        enqueue(neighborKey)
      }
    }

    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        if (reachable.has(key) || isNumberClueThree(puzzle, key)) {
          continue
        }
        const currentFill = puzzle.cells[key]?.fill
        if (isSlitherCellColor(currentFill)) {
          continue
        }
        decidedCellFills.set(key, 'yellow')
        affectedCells.add(key)
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Cells unreachable from known inside cells through non-line passages must be outside (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

export const createOutsideReachabilityColoringRule = (): Rule => ({
  id: 'outside-reachability-coloring',
  name: 'Outside Reachability Coloring',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const reachable = new Set<string>()
    const queue: string[] = []

    const inBounds = (row: number, col: number): boolean =>
      row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols

    const enqueue = (key: string): void => {
      if (reachable.has(key)) {
        return
      }
      reachable.add(key)
      queue.push(key)
    }

    const canReachOutsideFromBoundary = (row: number, col: number): boolean => {
      const boundaryEdges: string[] = []
      if (row === 0) {
        boundaryEdges.push(edgeKey([0, col], [0, col + 1]))
      }
      if (row === puzzle.rows - 1) {
        boundaryEdges.push(edgeKey([puzzle.rows, col], [puzzle.rows, col + 1]))
      }
      if (col === 0) {
        boundaryEdges.push(edgeKey([row, 0], [row + 1, 0]))
      }
      if (col === puzzle.cols - 1) {
        boundaryEdges.push(edgeKey([row, puzzle.cols], [row + 1, puzzle.cols]))
      }
      return boundaryEdges.some((key) => (puzzle.edges[key]?.mark ?? 'unknown') !== 'line')
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const currentFill = puzzle.cells[key]?.fill
        if (currentFill === 'green' || isNumberClueThree(puzzle, key)) {
          continue
        }
        if (currentFill === 'yellow' || canReachOutsideFromBoundary(row, col)) {
          enqueue(key)
        }
      }
    }

    const neighborSpecs: Array<{ dr: number; dc: number; edge: (row: number, col: number) => string }> = [
      { dr: -1, dc: 0, edge: (row, col) => edgeKey([row, col], [row, col + 1]) },
      { dr: 1, dc: 0, edge: (row, col) => edgeKey([row + 1, col], [row + 1, col + 1]) },
      { dr: 0, dc: -1, edge: (row, col) => edgeKey([row, col], [row + 1, col]) },
      { dr: 0, dc: 1, edge: (row, col) => edgeKey([row, col + 1], [row + 1, col + 1]) },
    ]

    for (let idx = 0; idx < queue.length; idx += 1) {
      const [row, col] = queue[idx].split(',').map(Number)
      for (const spec of neighborSpecs) {
        const neighborRow = row + spec.dr
        const neighborCol = col + spec.dc
        if (!inBounds(neighborRow, neighborCol)) {
          continue
        }
        const sharedEdge = spec.edge(row, col)
        if ((puzzle.edges[sharedEdge]?.mark ?? 'unknown') === 'line') {
          continue
        }

        const neighborKey = cellKey(neighborRow, neighborCol)
        const neighborFill = puzzle.cells[neighborKey]?.fill
        if (neighborFill === 'green' || isNumberClueThree(puzzle, neighborKey)) {
          continue
        }
        enqueue(neighborKey)
      }
    }

    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        if (reachable.has(key) || isNumberClueThree(puzzle, key)) {
          continue
        }
        const currentFill = puzzle.cells[key]?.fill
        if (isSlitherCellColor(currentFill)) {
          continue
        }
        decidedCellFills.set(key, 'green')
        affectedCells.add(key)
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Cells unreachable from the exterior through non-line passages must be inside (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

const OUTSIDE_COMPONENT = '__outside__'

type ConnectivityCutPassOptions = {
  target: SlitherCellColor
  includeOutsideSource: boolean
  getEffectiveCellColor: (key: string) => SlitherCellColor | null
}

type ConnectivityColorReason = 'cut' | 'unreachable'

type ConnectivityColorUpdate = {
  cellKey: string
  toFill: SlitherCellColor
  reason: ConnectivityColorReason
}

const findConnectivityColorUpdates = (
  puzzle: PuzzleIR,
  { target, includeOutsideSource, getEffectiveCellColor }: ConnectivityCutPassOptions,
): ConnectivityColorUpdate[] => {
  const blocked = oppositeSlitherCellColor(target)
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()

  const inBoundsCellKeys: string[] = []
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      inBoundsCellKeys.push(cellKey(row, col))
    }
  }

  const isCandidateCell = (key: string): boolean => getEffectiveCellColor(key) !== blocked

  const ensureNode = (key: string): void => {
    if (parent.has(key)) {
      return
    }
    parent.set(key, key)
    rank.set(key, 0)
  }

  const find = (key: string): string => {
    ensureNode(key)
    const currentParent = parent.get(key)
    if (currentParent === undefined || currentParent === key) {
      return key
    }
    const root = find(currentParent)
    parent.set(key, root)
    return root
  }

  const union = (a: string, b: string): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    const rankA = rank.get(rootA) ?? 0
    const rankB = rank.get(rootB) ?? 0
    if (rankA < rankB) {
      parent.set(rootA, rootB)
      return
    }
    parent.set(rootB, rootA)
    if (rankA === rankB) {
      rank.set(rootA, rankA + 1)
    }
  }

  for (const key of inBoundsCellKeys) {
    if (isCandidateCell(key)) {
      ensureNode(key)
    }
  }
  if (includeOutsideSource) {
    ensureNode(OUTSIDE_COMPONENT)
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') !== 'blank') {
      continue
    }
    const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
    if (adjacentCells.length !== 2 || !adjacentCells.every(isCandidateCell)) {
      continue
    }
    union(adjacentCells[0], adjacentCells[1])
  }

  const componentCells = new Map<string, string[]>()
  const sourceComponents = new Set<string>()
  for (const key of inBoundsCellKeys) {
    if (!isCandidateCell(key)) {
      continue
    }
    const root = find(key)
    const cells = componentCells.get(root) ?? []
    cells.push(key)
    componentCells.set(root, cells)
    if (getEffectiveCellColor(key) === target) {
      sourceComponents.add(root)
    }
  }
  if (includeOutsideSource) {
    sourceComponents.add(find(OUTSIDE_COMPONENT))
  }
  if (sourceComponents.size === 0) {
    return []
  }

  const graph = new Map<string, Set<string>>()
  const addGraphNode = (node: string): void => {
    if (!graph.has(node)) {
      graph.set(node, new Set())
    }
  }
  const addGraphEdge = (a: string, b: string): void => {
    if (a === b) {
      addGraphNode(a)
      return
    }
    addGraphNode(a)
    addGraphNode(b)
    graph.get(a)?.add(b)
    graph.get(b)?.add(a)
  }

  for (const root of componentCells.keys()) {
    addGraphNode(root)
  }
  if (includeOutsideSource) {
    addGraphNode(find(OUTSIDE_COMPONENT))
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') === 'line') {
      continue
    }
    const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
    if (adjacentCells.length === 2) {
      if (!adjacentCells.every(isCandidateCell)) {
        continue
      }
      addGraphEdge(find(adjacentCells[0]), find(adjacentCells[1]))
      continue
    }
    if (includeOutsideSource && adjacentCells.length === 1 && isCandidateCell(adjacentCells[0])) {
      addGraphEdge(find(OUTSIDE_COMPONENT), find(adjacentCells[0]))
    }
  }

  const discovery = new Map<string, number>()
  const low = new Map<string, number>()
  const subtreeSources = new Map<string, number>()
  const treeChildren = new Map<string, string[]>()
  const cutComponents = new Set<string>()
  const reachableComponents = new Set<string>()
  let timestamp = 0

  const dfs = (node: string, parentNode: string | null, connectedNodes: string[]): void => {
    discovery.set(node, timestamp)
    low.set(node, timestamp)
    timestamp += 1
    subtreeSources.set(node, sourceComponents.has(node) ? 1 : 0)
    connectedNodes.push(node)
    reachableComponents.add(node)

    for (const neighbor of graph.get(node) ?? []) {
      if (neighbor === parentNode) {
        continue
      }
      if (!discovery.has(neighbor)) {
        const children = treeChildren.get(node) ?? []
        children.push(neighbor)
        treeChildren.set(node, children)
        dfs(neighbor, node, connectedNodes)
        low.set(node, Math.min(low.get(node) ?? 0, low.get(neighbor) ?? 0))
        subtreeSources.set(node, (subtreeSources.get(node) ?? 0) + (subtreeSources.get(neighbor) ?? 0))
        continue
      }
      low.set(node, Math.min(low.get(node) ?? 0, discovery.get(neighbor) ?? 0))
    }
  }

  const evaluateCuts = (node: string, totalSources: number): void => {
    for (const neighbor of treeChildren.get(node) ?? []) {
      if ((low.get(neighbor) ?? 0) >= (discovery.get(node) ?? 0)) {
        const childSources = subtreeSources.get(neighbor) ?? 0
        if (childSources > 0 && totalSources - childSources > 0) {
          cutComponents.add(node)
        }
      }
      evaluateCuts(neighbor, totalSources)
    }
  }

  for (const node of sourceComponents) {
    if (discovery.has(node)) {
      continue
    }
    const connectedNodes: string[] = []
    dfs(node, null, connectedNodes)
    const totalSources = connectedNodes.filter((component) => sourceComponents.has(component)).length
    if (totalSources < 2) {
      continue
    }
    evaluateCuts(node, totalSources)
  }

  const updates = new Map<string, ConnectivityColorUpdate>()
  for (const component of cutComponents) {
    for (const key of componentCells.get(component) ?? []) {
      if (getEffectiveCellColor(key) === null) {
        updates.set(key, { cellKey: key, toFill: target, reason: 'cut' })
      }
    }
  }

  const unreachableFill = oppositeSlitherCellColor(target)
  for (const [component, cells] of componentCells) {
    if (reachableComponents.has(component)) {
      continue
    }
    for (const key of cells) {
      if (getEffectiveCellColor(key) === null) {
        updates.set(key, { cellKey: key, toFill: unreachableFill, reason: 'unreachable' })
      }
    }
  }

  return inBoundsCellKeys.flatMap((key) => updates.get(key) ?? [])
}

export const createColorConnectivityCutColoringRule = (): Rule => ({
  id: 'color-connectivity-cut-coloring',
  name: 'Color Connectivity Cut Coloring',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()
    const stats = {
      greenCuts: 0,
      yellowCuts: 0,
      greenUnreachable: 0,
      yellowUnreachable: 0,
    }

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (update: ConnectivityColorUpdate): void => {
      const { cellKey: key, toFill, reason } = update
      if (getEffectiveCellColor(key) !== null) {
        return
      }
      decidedCellFills.set(key, toFill)
      affectedCells.add(key)
      if (reason === 'cut' && toFill === 'green') {
        stats.greenCuts += 1
      } else if (reason === 'cut' && toFill === 'yellow') {
        stats.yellowCuts += 1
      } else if (reason === 'unreachable' && toFill === 'yellow') {
        stats.greenUnreachable += 1
      } else if (reason === 'unreachable' && toFill === 'green') {
        stats.yellowUnreachable += 1
      }
    }

    for (const update of findConnectivityColorUpdates(puzzle, {
      target: 'green',
      includeOutsideSource: false,
      getEffectiveCellColor,
    })) {
      rememberCellFill(update)
    }

    for (const update of findConnectivityColorUpdates(puzzle, {
      target: 'yellow',
      includeOutsideSource: true,
      getEffectiveCellColor,
    })) {
      rememberCellFill(update)
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = []
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const key = cellKey(row, col)
        const toFill = decidedCellFills.get(key)
        if (!toFill) {
          continue
        }
        diffs.push({
          kind: 'cell',
          cellKey: key,
          fromFill: (puzzle.cells[key]?.fill ?? null) as string | null,
          toFill,
        })
      }
    }

    return {
      message: `Cell connectivity forces color updates: inside cuts ${stats.greenCuts}, outside cuts ${stats.yellowCuts}, unreachable-from-inside ${stats.greenUnreachable}, unreachable-from-outside ${stats.yellowUnreachable}.`,
      diffs,
      affectedCells: [...affectedCells],
    }
  },
})

type CornerNeighbor = { row: number; col: number }

const getCornerOutsideNeighbors = (row: number, col: number, corner: SectorCorner): [CornerNeighbor, CornerNeighbor] => {
  if (corner === 'nw') {
    return [
      { row: row - 1, col },
      { row, col: col - 1 },
    ]
  }
  if (corner === 'ne') {
    return [
      { row: row - 1, col },
      { row, col: col + 1 },
    ]
  }
  if (corner === 'sw') {
    return [
      { row: row + 1, col },
      { row, col: col - 1 },
    ]
  }
  return [
    { row: row + 1, col },
    { row, col: col + 1 },
  ]
}

export const createColorSectorMaskPropagationRule = (): Rule => ({
  id: 'color-sector-mask-propagation',
  name: 'Color Sector-Mask Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const decidedSectorMasks = new Map<string, SectorConstraintMask>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstReason: string | null = null

    const inBounds = (row: number, col: number): boolean =>
      row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols

    const getEffectiveSectorMask = (key: string): SectorConstraintMask | undefined =>
      decidedSectorMasks.get(key) ?? puzzle.sectors[key]?.constraintsMask

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      affectedCells.add(key)
      return true
    }

    const rememberSectorMask = (key: string, targetMask: SectorConstraintMask): boolean => {
      const current = getEffectiveSectorMask(key)
      if (current === undefined) {
        return false
      }
      const next = sectorMaskIntersect(current, targetMask)
      if (next === 0 || next === current) {
        return false
      }
      decidedSectorMasks.set(key, next)
      affectedSectors.add(key)
      return true
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const sourceCellKey = cellKey(row, col)
        for (const corner of corners) {
          const currentSectorKey = sectorKey(row, col, corner)
          const mask = getEffectiveSectorMask(currentSectorKey)
          const isOnlyOne = mask === SECTOR_MASK_ONLY_1
          const isNotOne = mask !== undefined && !sectorMaskAllows(mask, 1)
          const [firstNeighbor, secondNeighbor] = getCornerOutsideNeighbors(row, col, corner)
          const firstInBounds = inBounds(firstNeighbor.row, firstNeighbor.col)
          const secondInBounds = inBounds(secondNeighbor.row, secondNeighbor.col)
          const firstKey = firstInBounds ? cellKey(firstNeighbor.row, firstNeighbor.col) : null
          const secondKey = secondInBounds ? cellKey(secondNeighbor.row, secondNeighbor.col) : null

          const firstColor: SlitherCellColor | null = firstKey !== null ? getEffectiveCellColor(firstKey) : 'yellow'
          const secondColor: SlitherCellColor | null =
            secondKey !== null ? getEffectiveCellColor(secondKey) : 'yellow'

          if (firstColor !== null && secondColor !== null && (firstInBounds || secondInBounds)) {
            const targetMask = firstColor === secondColor ? SECTOR_MASK_NOT_1 : SECTOR_MASK_ONLY_1
            if (rememberSectorMask(currentSectorKey, targetMask) && firstReason === null) {
              const relation = firstColor === secondColor ? 'same' : 'different'
              firstReason = `${formatSectorLabel(row, col, corner)} sees ${relation} outside-neighbor colors, so its sector count is narrowed`
            }
          }

          if (!isOnlyOne && !isNotOne) {
            continue
          }

          const relation = isOnlyOne ? 'different' : 'same'

          if (firstColor === null && secondColor === null) {
            continue
          }

          if (firstColor !== null && secondColor !== null) {
            continue
          }

          if (firstColor === null && firstKey && secondColor !== null) {
            const inferred = relation === 'same' ? secondColor : oppositeSlitherCellColor(secondColor)
            if (!rememberCellFill(firstKey, inferred)) {
              continue
            }
            affectedCells.add(sourceCellKey)
            if (secondKey) {
              affectedCells.add(secondKey)
            }
            if (firstReason === null) {
              firstReason = `${formatSectorLabel(row, col, corner)} says the two outside-neighbor cells are ${relation}, so ${formatCellKeyLabel(firstKey)} is ${inferred}`
            }
            continue
          }

          if (secondColor === null && secondKey && firstColor !== null) {
            const inferred = relation === 'same' ? firstColor : oppositeSlitherCellColor(firstColor)
            if (!rememberCellFill(secondKey, inferred)) {
              continue
            }
            affectedCells.add(sourceCellKey)
            if (firstKey) {
              affectedCells.add(firstKey)
            }
            if (firstReason === null) {
              firstReason = `${formatSectorLabel(row, col, corner)} says the two outside-neighbor cells are ${relation}, so ${formatCellKeyLabel(secondKey)} is ${inferred}`
            }
          }
        }
      }
    }

    if (decidedCellFills.size === 0 && decidedSectorMasks.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = [
      ...[...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      ...[...decidedSectorMasks.entries()].map(([k, toMask]) => ({
        kind: 'sector' as const,
        sectorKey: k,
        fromMask: puzzle.sectors[k]?.constraintsMask ?? 0,
        toMask,
      })),
    ]

    return {
      message: `${firstReason ?? 'Sector color relation propagated'} (${decidedCellFills.size} color update(s), ${decidedSectorMasks.size} sector update(s)).`,
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})
