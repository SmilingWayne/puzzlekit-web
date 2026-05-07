import { edgeKey, getVertexIncidentEdges, sectorKey, vertexKey } from './keys'
import { defaultPuzzleIR, SECTOR_MASK_ALL, type PuzzleIR, type VertexCandidate } from './types'

/** Inclusive bounds for custom grid and puzz.link export validation. */
export const SLITHER_CUSTOM_GRID_MIN = 3
export const SLITHER_CUSTOM_GRID_MAX = 100

const createInitialVertexCandidates = (
  row: number,
  col: number,
  rows: number,
  cols: number,
): VertexCandidate[] => {
  const incident = getVertexIncidentEdges(row, col, rows, cols)
  const candidates: VertexCandidate[] = [[]]
  for (let i = 0; i < incident.length; i += 1) {
    for (let j = i + 1; j < incident.length; j += 1) {
      candidates.push([incident[i], incident[j]])
    }
  }
  return candidates
    .map((candidate) => [...candidate].sort())
    .sort((a, b) => a.length - b.length || a.join('|').localeCompare(b.join('|')))
}

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
  for (let r = 0; r <= rows; r += 1) {
    for (let c = 0; c <= cols; c += 1) {
      puzzle.vertices[vertexKey(r, c)] = {
        candidateEdgeSets: createInitialVertexCandidates(r, c, rows, cols),
      }
    }
  }
  return puzzle
}
