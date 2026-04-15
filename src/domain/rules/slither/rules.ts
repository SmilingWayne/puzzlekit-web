import { cellKey, edgeKey, getCellEdgeKeys, getVertexIncidentEdges, parseCellKey } from '../../ir/keys'
import type { PuzzleIR } from '../../ir/types'
import type { Rule, RuleApplication } from '../types'

const isClueThree = (puzzle: PuzzleIR, row: number, col: number): boolean => {
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  return clue?.kind === 'number' && clue.value === 3
}

const createContiguousThreeRunBoundariesRule = (): Rule => ({
  id: 'contiguous-three-run-boundaries',
  name: 'Contiguous 3-Run Boundaries',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    for (let r = 0; r < puzzle.rows; r += 1) {
      let c = 0
      while (c < puzzle.cols) {
        if (!isClueThree(puzzle, r, c)) {
          c += 1
          continue
        }
        const cStart = c
        while (c < puzzle.cols && isClueThree(puzzle, r, c)) {
          c += 1
        }
        const cEnd = c - 1
        if (cEnd - cStart + 1 < 2) {
          continue
        }

        const affectedCells: string[] = []
        const diffs: RuleApplication['diffs'] = []
        for (let col = cStart; col <= cEnd; col += 1) {
          affectedCells.push(cellKey(r, col))
        }
        for (let boundaryCol = cStart; boundaryCol <= cEnd + 1; boundaryCol += 1) {
          const key = edgeKey([r, boundaryCol], [r + 1, boundaryCol])
          const mark = puzzle.edges[key]?.mark ?? 'unknown'
          if (mark === 'unknown') {
            diffs.push({ edgeKey: key, from: 'unknown', to: 'line' })
          }
        }

        if (diffs.length > 0) {
          return {
            message: `Contiguous 3-run in row ${r} forces all vertical run boundaries to be lines.`,
            diffs,
            affectedCells,
          }
        }
      }
    }

    for (let c = 0; c < puzzle.cols; c += 1) {
      let r = 0
      while (r < puzzle.rows) {
        if (!isClueThree(puzzle, r, c)) {
          r += 1
          continue
        }
        const rStart = r
        while (r < puzzle.rows && isClueThree(puzzle, r, c)) {
          r += 1
        }
        const rEnd = r - 1
        if (rEnd - rStart + 1 < 2) {
          continue
        }

        const affectedCells: string[] = []
        const diffs: RuleApplication['diffs'] = []
        for (let row = rStart; row <= rEnd; row += 1) {
          affectedCells.push(cellKey(row, c))
        }
        for (let boundaryRow = rStart; boundaryRow <= rEnd + 1; boundaryRow += 1) {
          const key = edgeKey([boundaryRow, c], [boundaryRow, c + 1])
          const mark = puzzle.edges[key]?.mark ?? 'unknown'
          if (mark === 'unknown') {
            diffs.push({ edgeKey: key, from: 'unknown', to: 'line' })
          }
        }

        if (diffs.length > 0) {
          return {
            message: `Contiguous 3-run in column ${c} forces all horizontal run boundaries to be lines.`,
            diffs,
            affectedCells,
          }
        }
      }
    }

    return null
  },
})

const createDiagonalAdjacentThreeOuterCornersRule = (): Rule => ({
  id: 'diagonal-adjacent-three-outer-corners',
  name: 'Diagonal Adjacent 3 Outer Corners',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    for (let r = 0; r < puzzle.rows - 1; r += 1) {
      for (let c = 0; c < puzzle.cols - 1; c += 1) {
        const mainDiagonal = isClueThree(puzzle, r, c) && isClueThree(puzzle, r + 1, c + 1)
        const antiDiagonal = isClueThree(puzzle, r, c + 1) && isClueThree(puzzle, r + 1, c)
        if (!mainDiagonal && !antiDiagonal) {
          continue
        }

        const affectedCellKeys = new Set<string>()
        const candidateEdgeKeys = new Set<string>()

        if (mainDiagonal) {
          affectedCellKeys.add(cellKey(r, c))
          affectedCellKeys.add(cellKey(r + 1, c + 1))
          candidateEdgeKeys.add(edgeKey([r, c], [r + 1, c]))
          candidateEdgeKeys.add(edgeKey([r, c], [r, c + 1]))
          candidateEdgeKeys.add(edgeKey([r + 1, c + 2], [r + 2, c + 2]))
          candidateEdgeKeys.add(edgeKey([r + 2, c + 1], [r + 2, c + 2]))
        }

        if (antiDiagonal) {
          affectedCellKeys.add(cellKey(r, c + 1))
          affectedCellKeys.add(cellKey(r + 1, c))
          candidateEdgeKeys.add(edgeKey([r, c + 1], [r, c + 2]))
          candidateEdgeKeys.add(edgeKey([r, c + 2], [r + 1, c + 2]))
          candidateEdgeKeys.add(edgeKey([r + 1, c], [r + 2, c]))
          candidateEdgeKeys.add(edgeKey([r + 2, c], [r + 2, c + 1]))
        }

        const diffs = [...candidateEdgeKeys].flatMap((key) =>
          (puzzle.edges[key]?.mark ?? 'unknown') === 'unknown'
            ? [{ edgeKey: key, from: 'unknown' as const, to: 'line' as const }]
            : [],
        )
        if (diffs.length === 0) {
          continue
        }

        return {
          message: 'Diagonal adjacent 3s force outer-corner boundary edges to be lines.',
          diffs,
          affectedCells: [...affectedCellKeys],
        }
      }
    }
    return null
  },
})

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

export const slitherRules: Rule[] = [
  createContiguousThreeRunBoundariesRule(),
  createDiagonalAdjacentThreeOuterCornersRule(),
  createCellCountRule(),
  createVertexDegreeRule(),
]
