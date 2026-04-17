import { cellKey, edgeKey, parseSectorKey } from './keys'
import type { PuzzleIR } from './types'

const compareCoord = (a: string, b: string): number => {
  const [ar, ac] = a.split(',').map(Number)
  const [br, bc] = b.split(',').map(Number)
  return ar === br ? ac - bc : ar - br
}

export const normalizePuzzle = (puzzle: PuzzleIR): Record<string, unknown> => {
  const cells = Object.keys(puzzle.cells)
    .sort(compareCoord)
    .reduce<Record<string, unknown>>((acc, key) => {
      const cell = puzzle.cells[key]
      acc[key] = {
        shaded: Boolean(cell.shaded),
        fill: cell.fill ?? null,
        clue: cell.clue ?? null,
        symbol: cell.symbol ?? null,
      }
      return acc
    }, {})

  const edges = Object.entries(puzzle.edges)
    .map(([key, state]) => {
      const [left, right] = key.split('-')
      const p1 = left.split(',').map(Number) as [number, number]
      const p2 = right.split(',').map(Number) as [number, number]
      return [edgeKey(p1, p2), state] as const
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, unknown>>((acc, [key, state]) => {
      acc[key] = {
        connected: state.connected ?? null,
        edgeType: state.edgeType ?? null,
        mark: state.mark,
        symbol: state.symbol ?? null,
      }
      return acc
    }, {})

  const sectors = Object.entries(puzzle.sectors)
    .sort(([a], [b]) => {
      const [ar, ac, aCorner] = parseSectorKey(a)
      const [br, bc, bCorner] = parseSectorKey(b)
      if (ar !== br) {
        return ar - br
      }
      if (ac !== bc) {
        return ac - bc
      }
      const order: Record<string, number> = { nw: 0, ne: 1, sw: 2, se: 3 }
      return (order[aCorner] ?? 99) - (order[bCorner] ?? 99)
    })
    .reduce<Record<string, unknown>>((acc, [key, state]) => {
      acc[key] = { constraintsMask: state.constraintsMask }
      return acc
    }, {})

  return {
    gridType: puzzle.gridType,
    puzzleType: puzzle.puzzleType,
    rows: puzzle.rows,
    cols: puzzle.cols,
    margins: [...puzzle.margins],
    boxes: [...puzzle.boxes],
    cells,
    edges,
    sectors,
  }
}

export const semanticEquals = (a: PuzzleIR, b: PuzzleIR): boolean =>
  JSON.stringify(normalizePuzzle(a)) === JSON.stringify(normalizePuzzle(b))

export const clonePuzzle = (puzzle: PuzzleIR): PuzzleIR =>
  JSON.parse(JSON.stringify(puzzle)) as PuzzleIR

export const generateCenterlistDiff = (rows: number, cols: number): number[] => {
  const list: number[] = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      list.push(Number(cellKey(r, c).replace(',', '')))
    }
  }
  return list
}
