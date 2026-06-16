import { cellKey, edgeKey } from '../../../ir/keys'
import type { EdgeMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { formatCellRunLabel, isClueThree } from './shared'

export const createContiguousThreeRunBoundariesRule = (): Rule => ({
  id: 'contiguous-three-run-boundaries',
  name: 'Adjacent 3s',
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
        for (
          let boundaryCol = cStart;
          boundaryCol <= cEnd + 1;
          boundaryCol += 1
        ) {
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
          for (let col = cStart; col <= cEnd; col += 1)
            allAffectedCells.add(cellKey(r, col))
          if (firstExample === null)
            firstExample = formatCellRunLabel('row', r, cStart, cEnd)
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
        for (
          let boundaryRow = rStart;
          boundaryRow <= rEnd + 1;
          boundaryRow += 1
        ) {
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
          for (let row = rStart; row <= rEnd; row += 1)
            allAffectedCells.add(cellKey(row, c))
          if (firstExample === null)
            firstExample = formatCellRunLabel('col', c, rStart, rEnd)
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Adjacent 3s at ${firstExample}: every edge perpendicular to the run is a line, and each shared edge cannot continue straight beyond the run.`
          : 'Adjacent 3s: every edge perpendicular to the run is a line, and each shared edge cannot continue straight beyond the run.',
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
  name: 'Diagonal 3s',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const allAffectedCells = new Set<string>()

    for (let r = 0; r < puzzle.rows - 1; r += 1) {
      for (let c = 0; c < puzzle.cols - 1; c += 1) {
        const mainDiagonal =
          isClueThree(puzzle, r, c) && isClueThree(puzzle, r + 1, c + 1)
        const antiDiagonal =
          isClueThree(puzzle, r, c + 1) && isClueThree(puzzle, r + 1, c)
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
          if (
            (puzzle.edges[key]?.mark ?? 'unknown') === 'unknown' &&
            !decidedEdges.has(key)
          ) {
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
      message:
        'Diagonal 3s force the two outer-corner edges of each clue to be lines; otherwise one of the clues cannot reach three lines.',
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

const getNumberClueValue = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
): number | null => {
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  return clue?.kind === 'number' && clue.value !== '?'
    ? Number(clue.value)
    : null
}

export const createAdjacentTwoThreeOppositeCrossRule = (): Rule => ({
  id: 'adjacent-two-three-opposite-cross',
  name: 'Adjacent 2-3 Opposite Cross',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
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

    const verticalEdge = (row: number, col: number): string =>
      edgeKey([row, col], [row + 1, col])
    const horizontalEdge = (row: number, col: number): string =>
      edgeKey([row, col], [row, col + 1])

    const applyPair = (
      twoRow: number,
      twoCol: number,
      threeRow: number,
      threeCol: number,
      rowDelta: number,
      colDelta: number,
    ): void => {
      let twoOpposite: string
      let threeOpposite: string
      const extensionEdges: string[] = []

      if (rowDelta === 0) {
        const sharedCol = colDelta === 1 ? twoCol + 1 : twoCol
        twoOpposite = verticalEdge(twoRow, colDelta === 1 ? twoCol : twoCol + 1)
        threeOpposite = verticalEdge(
          threeRow,
          colDelta === 1 ? threeCol + 1 : threeCol,
        )
        if (twoRow > 0) {
          extensionEdges.push(verticalEdge(twoRow - 1, sharedCol))
        }
        if (twoRow + 2 <= puzzle.rows) {
          extensionEdges.push(verticalEdge(twoRow + 1, sharedCol))
        }
      } else {
        const sharedRow = rowDelta === 1 ? twoRow + 1 : twoRow
        twoOpposite = horizontalEdge(
          rowDelta === 1 ? twoRow : twoRow + 1,
          twoCol,
        )
        threeOpposite = horizontalEdge(
          rowDelta === 1 ? threeRow + 1 : threeRow,
          threeCol,
        )
        if (twoCol > 0) {
          extensionEdges.push(horizontalEdge(sharedRow, twoCol - 1))
        }
        if (twoCol + 2 <= puzzle.cols) {
          extensionEdges.push(horizontalEdge(sharedRow, twoCol + 1))
        }
      }

      if ((puzzle.edges[twoOpposite]?.mark ?? 'unknown') !== 'blank') {
        return
      }

      let addedAny = false
      addedAny = decideUnknownEdge(threeOpposite, 'line') || addedAny
      for (const extensionEdge of extensionEdges) {
        addedAny = decideUnknownEdge(extensionEdge, 'blank') || addedAny
      }

      if (addedAny) {
        affectedCells.add(cellKey(twoRow, twoCol))
        affectedCells.add(cellKey(threeRow, threeCol))
        if (firstExample === null) {
          firstExample = `${cellKey(twoRow, twoCol)} and ${cellKey(threeRow, threeCol)}`
        }
      }
    }

    const inspectAdjacentCells = (
      row: number,
      col: number,
      neighborRow: number,
      neighborCol: number,
      rowDelta: number,
      colDelta: number,
    ): void => {
      const currentClue = getNumberClueValue(puzzle, row, col)
      const neighborClue = getNumberClueValue(puzzle, neighborRow, neighborCol)
      if (currentClue === 2 && neighborClue === 3) {
        applyPair(row, col, neighborRow, neighborCol, rowDelta, colDelta)
      }
      if (currentClue === 3 && neighborClue === 2) {
        applyPair(neighborRow, neighborCol, row, col, -rowDelta, -colDelta)
      }
    }

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        if (col + 1 < puzzle.cols) {
          inspectAdjacentCells(row, col, row, col + 1, 0, 1)
        }
        if (row + 1 < puzzle.rows) {
          inspectAdjacentCells(row, col, row + 1, col, 1, 0)
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Adjacent 2-3 at ${firstExample}: the crossed edge opposite the shared side of the 2 forces the 3's opposite edge to be a line and the shared-side extensions to be blank.`
          : "Adjacent 2-3: a crossed opposite edge on the 2 forces the 3's opposite edge and shared-side extensions.",
      diffs: [...decidedEdges.entries()].map(([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
    }
  },
})
