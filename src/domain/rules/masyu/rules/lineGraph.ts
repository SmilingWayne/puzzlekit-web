import { cellKey, parseLineKey } from '../../../ir/keys'
import type { CellCoord, LineMark, PuzzleIR } from '../../../ir/types'
import { getMasyuPearlKeys } from './pearlSelectors'
import { getMasyuCellLineDegree } from './shared'

export type MasyuLineOverlay = ReadonlyMap<string, LineMark>

export type MasyuCandidateEdge = {
  lineKey: string
  mark: LineMark
  left: string
  right: string
}

export type MasyuCandidateGraph = {
  cellKeys: string[]
  edges: MasyuCandidateEdge[]
  adjacency: Map<string, MasyuCandidateEdge[]>
}

export type MasyuKnownLineComponent = {
  root: number
  edgeCount: number
  vertices: Set<number>
}

export type MasyuOpenLineComponent = MasyuKnownLineComponent & {
  endpointKeys: [string, string]
}

const getOverlayLineMark = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay,
  lineKeyValue: string,
): LineMark =>
  overlay.get(lineKeyValue) ?? puzzle.lines[lineKeyValue]?.mark ?? 'unknown'

export const getMasyuEndpointKey = ([row, col]: CellCoord): string =>
  cellKey(row, col)

export const getMasyuOtherEndpoint = (
  edge: MasyuCandidateEdge,
  node: string,
): string => (edge.left === node ? edge.right : edge.left)

export const getMasyuTouchedCells = (
  lineKeys: Iterable<string>,
): Set<string> => {
  const cells = new Set<string>()
  for (const lineKeyValue of lineKeys) {
    const [left, right] = parseLineKey(lineKeyValue)
    cells.add(getMasyuEndpointKey(left))
    cells.add(getMasyuEndpointKey(right))
  }
  return cells
}

export const hasMasyuLineDegreeOverflow = (
  puzzle: PuzzleIR,
  cellKeyValue: string,
  decisions: ReadonlyMap<string, LineMark> = new Map(),
): boolean => getMasyuCellLineDegree(puzzle, cellKeyValue, decisions) > 2

export const buildMasyuLineUnion = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
) => {
  const cellCount = puzzle.rows * puzzle.cols
  const parent = Array.from({ length: cellCount }, (_, idx) => idx)
  const rank = new Array<number>(cellCount).fill(0)
  const toCellIndex = (row: number, col: number): number =>
    row * puzzle.cols + col
  const find = (idx: number): number => {
    if (parent[idx] !== idx) {
      parent[idx] = find(parent[idx])
    }
    return parent[idx]
  }
  const union = (a: number, b: number): void => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA
    } else {
      parent[rootB] = rootA
      rank[rootA] += 1
    }
  }

  const lineKeys = Object.keys(puzzle.lines).filter(
    (lineKeyValue) =>
      getOverlayLineMark(puzzle, overlay, lineKeyValue) === 'line',
  )
  for (const lineKeyValue of lineKeys) {
    const [left, right] = parseLineKey(lineKeyValue)
    union(toCellIndex(left[0], left[1]), toCellIndex(right[0], right[1]))
  }

  return { find, lineKeys, toCellIndex }
}

export const getMasyuKnownLineComponents = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): MasyuKnownLineComponent[] => {
  const { find, lineKeys, toCellIndex } = buildMasyuLineUnion(puzzle, overlay)
  const components = new Map<number, MasyuKnownLineComponent>()

  for (const lineKeyValue of lineKeys) {
    const [left, right] = parseLineKey(lineKeyValue)
    const leftIndex = toCellIndex(left[0], left[1])
    const rightIndex = toCellIndex(right[0], right[1])
    const root = find(leftIndex)
    const component = components.get(root) ?? {
      root,
      edgeCount: 0,
      vertices: new Set<number>(),
    }
    component.edgeCount += 1
    component.vertices.add(leftIndex)
    component.vertices.add(rightIndex)
    components.set(root, component)
  }

  return [...components.values()]
}

export const getMasyuOpenLineComponents = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): MasyuOpenLineComponent[] => {
  const degree = new Map<number, number>()
  const { toCellIndex } = buildMasyuLineUnion(puzzle, overlay)

  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    if (getOverlayLineMark(puzzle, overlay, lineKeyValue) !== 'line') {
      continue
    }
    const [left, right] = parseLineKey(lineKeyValue)
    const leftIndex = toCellIndex(left[0], left[1])
    const rightIndex = toCellIndex(right[0], right[1])
    degree.set(leftIndex, (degree.get(leftIndex) ?? 0) + 1)
    degree.set(rightIndex, (degree.get(rightIndex) ?? 0) + 1)
  }

  return getMasyuKnownLineComponents(puzzle, overlay).flatMap((component) => {
    if (component.edgeCount !== component.vertices.size - 1) {
      return []
    }
    const endpoints = [...component.vertices].filter(
      (vertex) => degree.get(vertex) === 1,
    )
    if (
      endpoints.length !== 2 ||
      [...component.vertices].some((vertex) => {
        const vertexDegree = degree.get(vertex) ?? 0
        return vertexDegree !== 1 && vertexDegree !== 2
      })
    ) {
      return []
    }
    const endpointKeys = endpoints
      .sort((left, right) => left - right)
      .map((vertex) =>
        cellKey(Math.floor(vertex / puzzle.cols), vertex % puzzle.cols),
      ) as [string, string]
    return [{ ...component, endpointKeys }]
  })
}

export const findMasyuPrematureLoopClosingLines = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): string[] => {
  const { find, lineKeys, toCellIndex } = buildMasyuLineUnion(puzzle, overlay)
  const lineComponentRoots = new Set(
    lineKeys.map((lineKeyValue) => {
      const [left] = parseLineKey(lineKeyValue)
      return find(toCellIndex(left[0], left[1]))
    }),
  )
  const closingLines: string[] = []

  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    if (getOverlayLineMark(puzzle, overlay, lineKeyValue) !== 'unknown') {
      continue
    }
    const [left, right] = parseLineKey(lineKeyValue)
    const leftRoot = find(toCellIndex(left[0], left[1]))
    const rightRoot = find(toCellIndex(right[0], right[1]))
    if (
      leftRoot === rightRoot &&
      [...lineComponentRoots].some((root) => root !== leftRoot)
    ) {
      closingLines.push(lineKeyValue)
    }
  }

  return closingLines
}

export const hasMasyuPrematureLoop = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): boolean => {
  const lineCount = buildMasyuLineUnion(puzzle, overlay).lineKeys.length
  return getMasyuKnownLineComponents(puzzle, overlay).some(
    (component) =>
      component.edgeCount >= component.vertices.size &&
      lineCount > component.edgeCount,
  )
}

export const buildMasyuCandidateGraph = (
  puzzle: PuzzleIR,
): MasyuCandidateGraph => {
  const cellKeys: string[] = []
  const adjacency = new Map<string, MasyuCandidateEdge[]>()

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      cellKeys.push(key)
      adjacency.set(key, [])
    }
  }

  const edges: MasyuCandidateEdge[] = []
  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    const mark = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
    if (mark === 'blank') {
      continue
    }
    const [leftCoord, rightCoord] = parseLineKey(lineKeyValue)
    const edge = {
      lineKey: lineKeyValue,
      mark,
      left: getMasyuEndpointKey(leftCoord),
      right: getMasyuEndpointKey(rightCoord),
    }
    edges.push(edge)
    adjacency.get(edge.left)?.push(edge)
    adjacency.get(edge.right)?.push(edge)
  }

  return { cellKeys, edges, adjacency }
}

export const getMasyuRequiredSources = (
  puzzle: PuzzleIR,
  graph: MasyuCandidateGraph,
): Set<string> => {
  const sources = new Set(getMasyuPearlKeys(puzzle))

  for (const edge of graph.edges) {
    if (edge.mark === 'line') {
      sources.add(edge.left)
      sources.add(edge.right)
    }
  }

  return sources
}

export const getMasyuSourceComponentCount = (
  graph: MasyuCandidateGraph,
  sources: ReadonlySet<string>,
): number => {
  const seen = new Set<string>()
  let sourceComponents = 0

  for (const start of graph.cellKeys) {
    if (seen.has(start)) {
      continue
    }
    const stack = [start]
    seen.add(start)
    let hasSource = false

    while (stack.length > 0) {
      const node = stack.pop()
      if (node === undefined) {
        continue
      }
      hasSource ||= sources.has(node)
      for (const edge of graph.adjacency.get(node) ?? []) {
        const neighbor = getMasyuOtherEndpoint(edge, node)
        if (!seen.has(neighbor)) {
          seen.add(neighbor)
          stack.push(neighbor)
        }
      }
    }

    if (hasSource) {
      sourceComponents += 1
    }
  }

  return sourceComponents
}
