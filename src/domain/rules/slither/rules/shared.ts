import { cellKey, parseCellKey, parseEdgeKey } from '../../../ir/keys'
import {
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  type PuzzleIR,
  type SectorConstraintMask,
} from '../../../ir/types'

export type SlitherCellColor = 'green' | 'yellow'

const adjacentCellsByEdgeCache = new Map<string, string[]>()

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
