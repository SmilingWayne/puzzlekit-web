import { lineKey, tileKey } from './keys'
import { defaultPuzzleIR, type PuzzleIR } from './types'

export const createMasyuPuzzle = (rows: number, cols: number): PuzzleIR => {
  const puzzle = defaultPuzzleIR()
  puzzle.puzzleType = 'masyu'
  puzzle.title = 'masyu'
  puzzle.rows = rows
  puzzle.cols = cols
  puzzle.margins = [0, 0, 0, 0]

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      puzzle.lines[lineKey([r, c], [r, c + 1])] = { mark: 'unknown' }
    }
  }
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      puzzle.lines[lineKey([r, c], [r + 1, c])] = { mark: 'unknown' }
    }
  }
  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c <= cols; c += 1) {
      puzzle.tiles[tileKey(r, c)] = {}
    }
  }

  return puzzle
}
