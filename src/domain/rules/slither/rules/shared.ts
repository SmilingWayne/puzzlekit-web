import { cellKey, parseCellKey, parseEdgeKey, parseSectorKey } from '../../../ir/keys'
import {
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  type PuzzleIR,
  type SectorCorner,
  type SectorConstraintMask,
} from '../../../ir/types'

export type SlitherCellColor = 'green' | 'yellow'

const adjacentCellsByEdgeCache = new Map<string, string[]>()

export const formatCellLabel = (row: number, col: number): string => `(R${row + 1}, C${col + 1})`

export const formatCellKeyLabel = (key: string): string => {
  const [row, col] = parseCellKey(key)
  return formatCellLabel(row, col)
}

export const formatCellRunLabel = (
  orientation: 'row' | 'col',
  fixedIndex: number,
  startIndex: number,
  endIndex: number,
): string => {
  if (orientation === 'row') {
    return `R${fixedIndex + 1} C${startIndex + 1}-C${endIndex + 1}`
  }
  return `C${fixedIndex + 1} R${startIndex + 1}-R${endIndex + 1}`
}

export const formatVertexLabel = (row: number, col: number): string => `V(${row}, ${col})`

export const formatEdgeLabel = (edgeKeyValue: string): string => {
  const [left, right] = parseEdgeKey(edgeKeyValue)
  return `edge ${formatVertexLabel(left[0], left[1])}-${formatVertexLabel(right[0], right[1])}`
}

export const formatCornerLabel = (corner: SectorCorner): string => corner.toUpperCase()

export const formatSectorLabel = (row: number, col: number, corner: SectorCorner): string =>
  `(R${row + 1}, C${col + 1}, ${formatCornerLabel(corner)})`

export const formatSectorKeyLabel = (key: string): string => {
  const [row, col, corner] = parseSectorKey(key)
  return formatSectorLabel(row, col, corner)
}

export const isSlitherCellColor = (fill: string | undefined): fill is SlitherCellColor =>
  fill === 'green' || fill === 'yellow'

export const oppositeSlitherCellColor = (fill: SlitherCellColor): SlitherCellColor =>
  fill === 'green' ? 'yellow' : 'green'

export const isClueThree = (puzzle: PuzzleIR, row: number, col: number): boolean => {
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  return clue?.kind === 'number' && clue.value === 3
}

export const getEdgeAdjacentCellKeys = (puzzle: PuzzleIR, edgeKeyValue: string): string[] => {
  const cacheKey = `${puzzle.rows}x${puzzle.cols}:${edgeKeyValue}`
  const cached = adjacentCellsByEdgeCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const [v1, v2] = parseEdgeKey(edgeKeyValue)
  if (v1[0] === v2[0]) {
    const row = v1[0]
    const col = Math.min(v1[1], v2[1])
    const result: string[] = []
    if (row - 1 >= 0) {
      result.push(cellKey(row - 1, col))
    }
    if (row < puzzle.rows) {
      result.push(cellKey(row, col))
    }
    adjacentCellsByEdgeCache.set(cacheKey, result)
    return result
  }
  const row = Math.min(v1[0], v2[0])
  const col = v1[1]
  const result: string[] = []
  if (col - 1 >= 0) {
    result.push(cellKey(row, col - 1))
  }
  if (col < puzzle.cols) {
    result.push(cellKey(row, col))
  }
  adjacentCellsByEdgeCache.set(cacheKey, result)
  return result
}

export const getCellNeighborKeys = (puzzle: PuzzleIR, key: string): string[] => {
  const [row, col] = parseCellKey(key)
  const neighbors: string[] = []
  if (row - 1 >= 0) neighbors.push(cellKey(row - 1, col))
  if (row + 1 < puzzle.rows) neighbors.push(cellKey(row + 1, col))
  if (col - 1 >= 0) neighbors.push(cellKey(row, col - 1))
  if (col + 1 < puzzle.cols) neighbors.push(cellKey(row, col + 1))
  return neighbors
}

export const maskForExactLineCount = (lineCount: number): SectorConstraintMask => {
  if (lineCount === 0) return SECTOR_MASK_ONLY_0
  if (lineCount === 1) return SECTOR_MASK_ONLY_1
  return SECTOR_MASK_ONLY_2
}
