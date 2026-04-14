import { getCellEdgeKeys, getVertexIncidentEdges, parseCellKey } from '../../ir/keys'
import type { PuzzleIR } from '../../ir/types'
import type { Rule, RuleApplication } from '../types'

const createCellCountRule = (): Rule => ({
  id: 'cell-count-completion',
  name: 'Cell Clue Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'number' || cell.clue.value === '?') {
        continue
      }
      const clue = Number(cell.clue.value)
      const [row, col] = parseCellKey(key)
      const edgeKeys = getCellEdgeKeys(row, col)
      const edges = edgeKeys.map((edge) => [edge, puzzle.edges[edge]?.mark ?? 'unknown'] as const)
      const lines = edges.filter(([, mark]) => mark === 'line')
      const unknown = edges.filter(([, mark]) => mark === 'unknown')
      if (unknown.length === 0) {
        continue
      }

      if (lines.length === clue) {
        return {
          message: `Cell (${row}, ${col}) already has ${clue} lines, remaining edges are blank.`,
          diffs: unknown.map(([edge]) => ({
            edgeKey: edge,
            from: 'unknown',
            to: 'blank',
          })),
          affectedCells: [key],
        }
      }
      if (lines.length + unknown.length === clue) {
        return {
          message: `Cell (${row}, ${col}) needs all remaining edges to reach clue ${clue}.`,
          diffs: unknown.map(([edge]) => ({
            edgeKey: edge,
            from: 'unknown',
            to: 'line',
          })),
          affectedCells: [key],
        }
      }
    }
    return null
  },
})

const createVertexDegreeRule = (): Rule => ({
  id: 'vertex-degree',
  name: 'Vertex Degree Rule',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    for (let r = 0; r <= puzzle.rows; r += 1) {
      for (let c = 0; c <= puzzle.cols; c += 1) {
        const incident = getVertexIncidentEdges(r, c, puzzle.rows, puzzle.cols)
        if (incident.length === 0) {
          continue
        }
        const marks = incident.map((edge) => [edge, puzzle.edges[edge]?.mark ?? 'unknown'] as const)
        const lineCount = marks.filter(([, mark]) => mark === 'line').length
        const unknown = marks.filter(([, mark]) => mark === 'unknown')
        if (unknown.length === 0) {
          continue
        }

        if (lineCount === 2) {
          return {
            message: `Vertex (${r}, ${c}) already has 2 lines, remaining incident edges are blank.`,
            diffs: unknown.map(([edge]) => ({
              edgeKey: edge,
              from: 'unknown',
              to: 'blank',
            })),
            affectedCells: [],
          }
        }
        if (lineCount === 1 && unknown.length === 1) {
          return {
            message: `Vertex (${r}, ${c}) must continue the loop with the last undecided edge.`,
            diffs: [
              {
                edgeKey: unknown[0][0],
                from: 'unknown',
                to: 'line',
              },
            ],
            affectedCells: [],
          }
        }
      }
    }
    return null
  },
})

export const slitherRules: Rule[] = [createCellCountRule(), createVertexDegreeRule()]
