import { cellKey, edgeKey, sectorKey } from '../../../ir/keys'
import {
  SECTOR_MASK_ONLY_1,
  type EdgeMark,
  type PuzzleIR,
  type SectorCorner,
  sectorMaskAllows,
} from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  getCellNeighborKeys,
  getEdgeAdjacentCellKeys,
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
    const adjacentCellsByEdge = new Map<string, [string, string]>()
    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
        continue
      }
      adjacentCellsByEdge.set(edgeKeyValue, [adjacentCells[0], adjacentCells[1]])
    }

    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = adjacentCellsByEdge.get(edgeKeyValue)
      if (!adjacentCells) {
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
      }
    }

    for (const edgeKeyValue of edgeKeys) {
      const adjacentCells = adjacentCellsByEdge.get(edgeKeyValue)
      if (!adjacentCells) {
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
      message: `Color-edge propagation applied (${edgeCount} edge update(s), ${colorCount} color update(s)).`,
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
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Color outside seeding applied (${decidedCellFills.size} color update(s)).`,
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
      const outercnt = neighbors.filter((k) => getEffectiveCellColor(k) === 'yellow').length

      if (clue < innercnt || 4 - clue < outercnt) {
        rememberCellFill(cellKeyValue, 'green')
      }
      if (clue < outercnt || 4 - clue < innercnt) {
        rememberCellFill(cellKeyValue, 'yellow')
      }

      const currentColor = getEffectiveCellColor(cellKeyValue)
      if (currentColor === 'green' && clue === outercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'green'))
      }
      if (currentColor === 'yellow' && clue === innercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'yellow'))
      }
      if (currentColor === 'yellow' && clue === 4 - outercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'green'))
      }
      if (currentColor === 'green' && clue === 4 - innercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'yellow'))
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Color clue propagation applied (${decidedCellFills.size} color update(s)).`,
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
      message: `Color orthogonal consensus propagation applied (${decidedCellFills.size} color update(s)).`,
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
      message: `Inside reachability coloring applied (${decidedCellFills.size} color update(s)).`,
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
    const affectedCells = new Set<string>()

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
        const sourceCellKey = cellKey(row, col)
        for (const corner of corners) {
          const mask = puzzle.sectors[sectorKey(row, col, corner)]?.constraintsMask
          const isOnlyOne = mask === SECTOR_MASK_ONLY_1
          const isNotOne = mask !== undefined && !sectorMaskAllows(mask, 1)
          if (!isOnlyOne && !isNotOne) {
            continue
          }

          const relation = isOnlyOne ? 'different' : 'same'
          const [firstNeighbor, secondNeighbor] = getCornerOutsideNeighbors(row, col, corner)
          const firstInBounds = inBounds(firstNeighbor.row, firstNeighbor.col)
          const secondInBounds = inBounds(secondNeighbor.row, secondNeighbor.col)
          const firstKey = firstInBounds ? cellKey(firstNeighbor.row, firstNeighbor.col) : null
          const secondKey = secondInBounds ? cellKey(secondNeighbor.row, secondNeighbor.col) : null

          const firstColor: SlitherCellColor | null = firstKey !== null ? getEffectiveCellColor(firstKey) : 'yellow'
          const secondColor: SlitherCellColor | null =
            secondKey !== null ? getEffectiveCellColor(secondKey) : 'yellow'

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
          }
        }
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Color sector-mask propagation applied (${decidedCellFills.size} color update(s)).`,
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
