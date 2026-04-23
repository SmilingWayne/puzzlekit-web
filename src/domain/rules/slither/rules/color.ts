import { cellKey, sectorKey } from '../../../ir/keys'
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

    for (const [edgeKeyValue] of Object.entries(puzzle.edges)) {
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
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

    const allEdges = Object.keys(puzzle.edges)
    for (const edgeKeyValue of allEdges) {
      const effectiveMark = decidedEdges.get(edgeKeyValue) ?? (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown')
      if (effectiveMark !== 'line' && effectiveMark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
        continue
      }
      const [cellA, cellB] = adjacentCells
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
      ...[...decidedEdges.entries()].map(([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      ...[...decidedCellFills.entries()].map(([k, toFill]) => ({
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

    for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
      const mark = edgeState?.mark ?? 'unknown'
      if (mark !== 'line' && mark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 1) {
        continue
      }
      const inferredColor: SlitherCellColor = mark === 'line' ? 'green' : 'yellow'
      rememberCellFill(adjacentCells[0], inferredColor)
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

          const firstColor: SlitherCellColor | null = firstInBounds ? getEffectiveCellColor(firstKey) : 'yellow'
          const secondColor: SlitherCellColor | null = secondInBounds ? getEffectiveCellColor(secondKey) : 'yellow'

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
