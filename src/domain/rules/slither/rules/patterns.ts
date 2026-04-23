import { cellKey, edgeKey } from '../../../ir/keys'
import type { EdgeMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { isClueThree } from './shared'

export const createContiguousThreeRunBoundariesRule = (): Rule => ({
  id: 'contiguous-three-run-boundaries',
  name: 'Contiguous 3-Run Boundaries',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const allAffectedCells = new Set<string>()
    let firstExample: string | null = null
    const decideUnknownEdge = (key: string, to: EdgeMark): boolean => {
      if (!puzzle.edges[key]) {
        return false
      }
      if ((puzzle.edges[key]?.mark ?? 'unknown') !== 'unknown') {
        return false
      }
      if (decidedEdges.has(key)) {
        return false
      }
      decidedEdges.set(key, to)
      return true
    }

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

        let runAddedAny = false
        for (let boundaryCol = cStart; boundaryCol <= cEnd + 1; boundaryCol += 1) {
          const key = edgeKey([r, boundaryCol], [r + 1, boundaryCol])
          runAddedAny = decideUnknownEdge(key, 'line') || runAddedAny
        }

        for (let innerCol = cStart + 1; innerCol <= cEnd; innerCol += 1) {
          if (r - 1 >= 0) {
            const upKey = edgeKey([r - 1, innerCol], [r, innerCol])
            runAddedAny = decideUnknownEdge(upKey, 'blank') || runAddedAny
          }
          if (r + 2 <= puzzle.rows) {
            const downKey = edgeKey([r + 1, innerCol], [r + 2, innerCol])
            runAddedAny = decideUnknownEdge(downKey, 'blank') || runAddedAny
          }
        }

        if (runAddedAny) {
          for (let col = cStart; col <= cEnd; col += 1) allAffectedCells.add(cellKey(r, col))
          if (firstExample === null) firstExample = `row ${r} cols ${cStart}-${cEnd}`
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

        let runAddedAny = false
        for (let boundaryRow = rStart; boundaryRow <= rEnd + 1; boundaryRow += 1) {
          const key = edgeKey([boundaryRow, c], [boundaryRow, c + 1])
          runAddedAny = decideUnknownEdge(key, 'line') || runAddedAny
        }

        for (let innerRow = rStart + 1; innerRow <= rEnd; innerRow += 1) {
          if (c - 1 >= 0) {
            const leftKey = edgeKey([innerRow, c - 1], [innerRow, c])
            runAddedAny = decideUnknownEdge(leftKey, 'blank') || runAddedAny
          }
          if (c + 2 <= puzzle.cols) {
            const rightKey = edgeKey([innerRow, c + 1], [innerRow, c + 2])
            runAddedAny = decideUnknownEdge(rightKey, 'blank') || runAddedAny
          }
        }

        if (runAddedAny) {
          for (let row = rStart; row <= rEnd; row += 1) allAffectedCells.add(cellKey(row, c))
          if (firstExample === null) firstExample = `col ${c} rows ${rStart}-${rEnd}`
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Contiguous 3-run pattern forced boundary lines and same-direction extension blanks (e.g., ${firstExample}).`
          : 'Contiguous 3-run pattern forced boundary lines and same-direction extension blanks.',
      diffs: [...decidedEdges.entries()].map(([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...allAffectedCells],
    }
  },
})

export const createDiagonalAdjacentThreeOuterCornersRule = (): Rule => ({
  id: 'diagonal-adjacent-three-outer-corners',
  name: 'Diagonal Adjacent 3 Outer Corners',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const allAffectedCells = new Set<string>()

    for (let r = 0; r < puzzle.rows - 1; r += 1) {
      for (let c = 0; c < puzzle.cols - 1; c += 1) {
        const mainDiagonal = isClueThree(puzzle, r, c) && isClueThree(puzzle, r + 1, c + 1)
        const antiDiagonal = isClueThree(puzzle, r, c + 1) && isClueThree(puzzle, r + 1, c)
        if (!mainDiagonal && !antiDiagonal) {
          continue
        }

        const candidateEdgeKeys = new Set<string>()

        if (mainDiagonal) {
          candidateEdgeKeys.add(edgeKey([r, c], [r + 1, c]))
          candidateEdgeKeys.add(edgeKey([r, c], [r, c + 1]))
          candidateEdgeKeys.add(edgeKey([r + 1, c + 2], [r + 2, c + 2]))
          candidateEdgeKeys.add(edgeKey([r + 2, c + 1], [r + 2, c + 2]))
        }

        if (antiDiagonal) {
          candidateEdgeKeys.add(edgeKey([r, c + 1], [r, c + 2]))
          candidateEdgeKeys.add(edgeKey([r, c + 2], [r + 1, c + 2]))
          candidateEdgeKeys.add(edgeKey([r + 1, c], [r + 2, c]))
          candidateEdgeKeys.add(edgeKey([r + 2, c], [r + 2, c + 1]))
        }

        let positionAddedAny = false
        for (const key of candidateEdgeKeys) {
          if ((puzzle.edges[key]?.mark ?? 'unknown') === 'unknown' && !decidedEdges.has(key)) {
            decidedEdges.set(key, 'line')
            positionAddedAny = true
          }
        }

        if (positionAddedAny) {
          if (mainDiagonal) {
            allAffectedCells.add(cellKey(r, c))
            allAffectedCells.add(cellKey(r + 1, c + 1))
          }
          if (antiDiagonal) {
            allAffectedCells.add(cellKey(r, c + 1))
            allAffectedCells.add(cellKey(r + 1, c))
          }
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message: 'Diagonal adjacent 3s force outer-corner boundary edges to be lines.',
      diffs: [...decidedEdges.entries()].map(([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...allAffectedCells],
    }
  },
})
