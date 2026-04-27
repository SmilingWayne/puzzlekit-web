import type { CellCoord, SectorCorner, Vertex } from './types'

export const cellKey = (row: number, col: number): string => `${row},${col}`

export const parseCellKey = (key: string): CellCoord => {
  const [r, c] = key.split(',').map(Number)
  return [r, c]
}

export const sectorKey = (row: number, col: number, corner: SectorCorner): string =>
  `${row},${col}:${corner}`

export const parseSectorKey = (key: string): [row: number, col: number, corner: SectorCorner] => {
  const [coord, corner] = key.split(':')
  const [r, c] = coord.split(',').map(Number)
  return [r, c, corner as SectorCorner]
}

const sortVertices = (a: Vertex, b: Vertex): [Vertex, Vertex] => {
  if (a[0] < b[0]) {
    return [a, b]
  }
  if (a[0] > b[0]) {
    return [b, a]
  }
  return a[1] <= b[1] ? [a, b] : [b, a]
}

export const edgeKey = (a: Vertex, b: Vertex): string => {
  const [p1, p2] = sortVertices(a, b)
  return `${p1[0]},${p1[1]}-${p2[0]},${p2[1]}`
}

export const parseEdgeKey = (key: string): [Vertex, Vertex] => {
  const [left, right] = key.split('-')
  const p1 = left.split(',').map(Number) as Vertex
  const p2 = right.split(',').map(Number) as Vertex
  return sortVertices(p1, p2)
}

export const getCellEdgeKeys = (row: number, col: number): string[] => [
  edgeKey([row, col], [row, col + 1]),
  edgeKey([row + 1, col], [row + 1, col + 1]),
  edgeKey([row, col], [row + 1, col]),
  edgeKey([row, col + 1], [row + 1, col + 1]),
]

export const getCornerVertex = (row: number, col: number, corner: SectorCorner): Vertex => {
  if (corner === 'nw') return [row, col] 
  if (corner === "ne") return [row, col + 1]
  if (corner === "sw") return [row + 1, col]
  return [row + 1, col + 1]
}

export const getCornerEdgeKeys = (row: number, col: number, corner: SectorCorner): [string, string] => {
  if (corner === 'nw') return [edgeKey([row, col], [row, col + 1]), edgeKey([row, col], [row + 1, col])]
  if (corner === 'ne') return [edgeKey([row, col], [row, col + 1]), edgeKey([row, col + 1], [row + 1, col + 1])]
  if (corner === 'sw') return [edgeKey([row + 1, col], [row + 1, col + 1]), edgeKey([row, col], [row + 1, col])]
  return [edgeKey([row + 1, col], [row + 1, col + 1]), edgeKey([row, col + 1], [row + 1, col + 1]),]
}

export const getVertexIncidentEdges = (
  row: number,
  col: number,
  rows: number,
  cols: number,
): string[] => {
  const edges: string[] = []
  if (row > 0) {
    edges.push(edgeKey([row - 1, col], [row, col]))
  }
  if (row < rows) {
    edges.push(edgeKey([row, col], [row + 1, col]))
  }
  if (col > 0) {
    edges.push(edgeKey([row, col - 1], [row, col]))
  }
  if (col < cols) {
    edges.push(edgeKey([row, col], [row, col + 1]))
  }
  return edges
}
