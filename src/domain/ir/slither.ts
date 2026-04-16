import { edgeKey, sectorKey } from './keys'
import { defaultPuzzleIR, type PuzzleIR } from './types'

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
      puzzle.sectors[sectorKey(r, c, 'nw')] = { mark: 'unknown' }
      puzzle.sectors[sectorKey(r, c, 'ne')] = { mark: 'unknown' }
      puzzle.sectors[sectorKey(r, c, 'sw')] = { mark: 'unknown' }
      puzzle.sectors[sectorKey(r, c, 'se')] = { mark: 'unknown' }
    }
  }
  return puzzle
}
