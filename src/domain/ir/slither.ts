import { edgeKey, sectorKey } from './keys'
import { defaultPuzzleIR, SECTOR_MASK_ALL, type PuzzleIR } from './types'

/** Inclusive bounds for custom grid and puzz.link export validation. */
export const SLITHER_CUSTOM_GRID_MIN = 3
export const SLITHER_CUSTOM_GRID_MAX = 100

export const createSlitherPuzzle = (rows: number, cols: number): PuzzleIR => {
  const puzzle = defaultPuzzleIR()
  puzzle.puzzleType = 'slitherlink'
  puzzle.title = 'slitherlink'
  puzzle.rows = rows
  puzzle.cols = cols
  puzzle.margins = [0, 0, 0, 0]

  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      puzzle.edges[edgeKey([r, c], [r, c + 1])] = { mark: 'unknown' }
    }
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c <= cols; c += 1) {
      puzzle.edges[edgeKey([r, c], [r + 1, c])] = { mark: 'unknown' }
    }
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      puzzle.sectors[sectorKey(r, c, 'nw')] = { constraintsMask: SECTOR_MASK_ALL }
      puzzle.sectors[sectorKey(r, c, 'ne')] = { constraintsMask: SECTOR_MASK_ALL }
      puzzle.sectors[sectorKey(r, c, 'sw')] = { constraintsMask: SECTOR_MASK_ALL }
      puzzle.sectors[sectorKey(r, c, 'se')] = { constraintsMask: SECTOR_MASK_ALL }
    }
  }
  return puzzle
}
