import { getCellEdgeKeys, getVertexIncidentEdges, parseCellKey, parseEdgeKey } from '../../../ir/keys'
import type { EdgeMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { formatCellLabel, formatEdgeLabel, formatVertexLabel } from './shared'

const numberClueCellKeysCache = new WeakMap<PuzzleIR['cells'], string[]>()

const getNumberClueCellKeys = (puzzle: PuzzleIR): string[] => {
  const cached = numberClueCellKeysCache.get(puzzle.cells)
  if (cached) {
    return cached
  }
  const keys: string[] = []
  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind === 'number' && cell.clue.value !== '?') {
      keys.push(key)
    }
  }
  numberClueCellKeysCache.set(puzzle.cells, keys)
  return keys
}

export const createCellCountRule = (): Rule => ({
  id: 'cell-count-completion',
  name: 'Cell Clue Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    let firstExample: string | null = null
    let firstReason: string | null = null

    for (const key of getNumberClueCellKeys(puzzle)) {
      const cell = puzzle.cells[key]
      if (!cell || cell.clue?.kind !== 'number' || cell.clue.value === '?') {
        continue
      }
      const clue = Number(cell.clue.value)
      const [row, col] = parseCellKey(key)
      const edgeKeys = getCellEdgeKeys(row, col)
      let lineCount = 0
      const unknownEdges: string[] = []
      for (const edge of edgeKeys) {
        const mark = puzzle.edges[edge]?.mark ?? 'unknown'
        if (mark === 'line') {
          lineCount += 1
        } else if (mark === 'unknown') {
          unknownEdges.push(edge)
        }
      }
      if (unknownEdges.length === 0) {
        continue
      }

      let toMark: EdgeMark | null = null
      let reason: string | null = null
      if (lineCount === clue) {
        toMark = 'blank'
        reason = `the clue already has ${clue} line(s), so every remaining unknown edge is blank`
      } else if (lineCount + unknownEdges.length === clue) {
        toMark = 'line'
        reason = `all remaining unknown edge(s) are needed to reach clue ${clue}, so they are lines`
      }
      if (toMark === null) continue

      let addedAny = false
      for (const edge of unknownEdges) {
        if (!decidedEdges.has(edge)) {
          decidedEdges.set(edge, toMark)
          addedAny = true
        }
      }

      if (addedAny) {
        affectedCells.add(key)
        if (firstExample === null) {
          firstExample = formatCellLabel(row, col)
          firstReason = reason
        }
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedCells.size - 1
    return {
      message:
        firstExample !== null
          ? `Cell ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: ${firstReason}.`
          : 'Cell clue completion applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

export const createVertexDegreeRule = (): Rule => ({
  id: 'vertex-degree',
  name: 'Vertex Degree Rule',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    let firstVertex: string | null = null
    let firstReason: string | null = null

    for (let r = 0; r <= puzzle.rows; r += 1) {
      for (let c = 0; c <= puzzle.cols; c += 1) {
        const incident = getVertexIncidentEdges(r, c, puzzle.rows, puzzle.cols)
        if (incident.length === 0) {
          continue
        }
        let lineCount = 0
        const unknownEdges: string[] = []
        for (const edge of incident) {
          const mark = puzzle.edges[edge]?.mark ?? 'unknown'
          if (mark === 'line') {
            lineCount += 1
          } else if (mark === 'unknown') {
            unknownEdges.push(edge)
          }
        }
        if (unknownEdges.length === 0) {
          continue
        }

        let toMark: EdgeMark | null = null
        let edgesToDecide: string[] = []
        let reason: string | null = null

        if (lineCount === 2) {
          toMark = 'blank'
          edgesToDecide = unknownEdges
          reason = 'it already has degree 2, so all other incident edges are blank'
        } else if (lineCount === 1 && unknownEdges.length === 1) {
          toMark = 'line'
          edgesToDecide = [unknownEdges[0]]
          reason = 'one line must continue through the only remaining unknown edge'
        } else if (lineCount === 0 && unknownEdges.length === 1) {
          toMark = 'blank'
          edgesToDecide = [unknownEdges[0]]
          reason = 'using the only remaining unknown edge would leave a dead-end degree 1 vertex'
        }

        if (toMark === null) continue

        let addedAny = false
        for (const edge of edgesToDecide) {
          if (!decidedEdges.has(edge)) {
            decidedEdges.set(edge, toMark)
            addedAny = true
          }
        }

        if (addedAny && firstVertex === null) {
          firstVertex = formatVertexLabel(r, c)
          firstReason = reason
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstVertex !== null ? `Vertex ${firstVertex}: ${firstReason}.` : 'Vertex degree rule applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [],
    }
  },
})

export const createPreventPrematureLoopRule = (): Rule => ({
  id: 'prevent-premature-loop',
  name: 'Prevent Premature Loop',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const vertexCols = puzzle.cols + 1
    const vertexCount = (puzzle.rows + 1) * vertexCols
    const parent = Array.from({ length: vertexCount }, (_, idx) => idx)
    const rank = new Array<number>(vertexCount).fill(0)
    const toVertexIndex = (row: number, col: number): number => row * vertexCols + col
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

    for (const [edgeKeyValue, state] of Object.entries(puzzle.edges)) {
      if ((state?.mark ?? 'unknown') !== 'line') {
        continue
      }
      const [left, right] = parseEdgeKey(edgeKeyValue)
      union(toVertexIndex(left[0], left[1]), toVertexIndex(right[0], right[1]))
    }

    const decidedEdges = new Map<string, EdgeMark>()
    let firstExample: string | null = null

    for (const [edgeKeyValue, state] of Object.entries(puzzle.edges)) {
      if ((state?.mark ?? 'unknown') !== 'unknown') {
        continue
      }
      const [left, right] = parseEdgeKey(edgeKeyValue)
      if (find(toVertexIndex(left[0], left[1])) !== find(toVertexIndex(right[0], right[1]))) {
        continue
      }
      decidedEdges.set(edgeKeyValue, 'blank')
      if (firstExample === null) {
        firstExample = formatEdgeLabel(edgeKeyValue)
      }
    }

    if (decidedEdges.size === 0) {
      return null
    }

    return {
      message:
        firstExample !== null
          ? `${firstExample} would close the current path into a smaller loop, so it must be blank.`
          : 'Edges that would close the current path into a smaller loop are blank.',
      diffs: [...decidedEdges.entries()].map(([edgeKeyValue, to]) => ({
        kind: 'edge' as const,
        edgeKey: edgeKeyValue,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [],
    }
  },
})
