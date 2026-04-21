import {
  cellKey,
  edgeKey,
  getCellEdgeKeys,
  getVertexIncidentEdges,
  getCornerEdgeKeys,
  getCornerVertex,
  parseCellKey,
  parseEdgeKey,
  parseSectorKey,
  sectorKey,
} from '../../ir/keys'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_NOT_2,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  sectorMaskAllows,
  sectorMaskIntersect,
  sectorMaskIsValid,
  sectorMaskSingleValue,
  type EdgeMark,
  type PuzzleIR,
  type SectorConstraintMask,
  type SectorCorner,
} from '../../ir/types'
import { clonePuzzle } from '../../ir/normalize'
import { runNextRule } from '../engine'
import type { Rule, RuleApplication } from '../types'

const isClueThree = (puzzle: PuzzleIR, row: number, col: number): boolean => {
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  return clue?.kind === 'number' && clue.value === 3
}

type SlitherCellColor = 'green' | 'yellow'

const isSlitherCellColor = (fill: string | undefined): fill is SlitherCellColor =>
  fill === 'green' || fill === 'yellow'

const oppositeSlitherCellColor = (fill: SlitherCellColor): SlitherCellColor =>
  fill === 'green' ? 'yellow' : 'green'

const getEdgeAdjacentCellKeys = (puzzle: PuzzleIR, edgeKeyValue: string): string[] => {
  const [v1, v2] = parseEdgeKey(edgeKeyValue)
  if (v1[0] === v2[0]) {
    const row = v1[0]
    const col = Math.min(v1[1], v2[1])
    const result: string[] = []
    if (row - 1 >= 0) {
      result.push(cellKey(row - 1, col))
    }
    if (row < puzzle.rows) {
      result.push(cellKey(row, col))
    }
    return result
  }
  const row = Math.min(v1[0], v2[0])
  const col = v1[1]
  const result: string[] = []
  if (col - 1 >= 0) {
    result.push(cellKey(row, col - 1))
  }
  if (col < puzzle.cols) {
    result.push(cellKey(row, col))
  }
  return result
}

const getCellNeighborKeys = (puzzle: PuzzleIR, key: string): string[] => {
  const [row, col] = parseCellKey(key)
  const neighbors: string[] = []
  if (row - 1 >= 0) neighbors.push(cellKey(row - 1, col))
  if (row + 1 < puzzle.rows) neighbors.push(cellKey(row + 1, col))
  if (col - 1 >= 0) neighbors.push(cellKey(row, col - 1))
  if (col + 1 < puzzle.cols) neighbors.push(cellKey(row, col + 1))
  return neighbors
}


const maskForExactLineCount = (lineCount: number): SectorConstraintMask => {
  if (lineCount === 0) return SECTOR_MASK_ONLY_0
  if (lineCount === 1) return SECTOR_MASK_ONLY_1
  return SECTOR_MASK_ONLY_2
}

const inferSectorMaskByVertex = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  corner: SectorCorner
): SectorConstraintMask => {
  // step1: primal infer independent of cell number
  const vertex = getCornerVertex(row, col, corner)
  const incidentEdges = getVertexIncidentEdges(vertex[0], vertex[1], puzzle.rows, puzzle.cols)
  const cellEdges = getCellEdgeKeys(row, col)
  const sectorEdges = getCornerEdgeKeys(row, col, corner)
  let mask = SECTOR_MASK_ALL
  const tighten = (constraint: SectorConstraintMask): void => {
    mask = sectorMaskIntersect(mask, constraint)
  }
  
  // step 1.1 : no need to infer because fixed
  const secLineNum = sectorEdges.filter(e => puzzle.edges[e]?.mark === 'line').length 
  const secCrossNum = sectorEdges.filter(e => puzzle.edges[e]?.mark === 'blank').length 
  
  if (secLineNum + secCrossNum === 2) {
    tighten(maskForExactLineCount(secLineNum))
  }

  const nonSectorEdges = incidentEdges.filter(e => !sectorEdges.includes(e))
  const diagSectorEdges = cellEdges.filter(e => !sectorEdges.includes(e))
  
  const nonSecLineNum = nonSectorEdges.filter(e => puzzle.edges[e]?.mark === 'line').length 
  const nonSecCrossNum = nonSectorEdges.filter(e => puzzle.edges[e]?.mark === 'blank').length

  const diagSecLineNum = diagSectorEdges.filter(e => puzzle.edges[e]?.mark === 'line').length 
  const diagSecCrossNum = diagSectorEdges.filter(e => puzzle.edges[e]?.mark === 'blank').length 
  
  // step 1.2 basic infer
  // Generalized logic: check if all remaining unknown edges at the vertex belong to this sector
  const nonSecKnownNum = nonSecLineNum + nonSecCrossNum
  const vertexDegree = incidentEdges.length
  const sectorKnownNum = secLineNum + secCrossNum
  const remainingUnknowns = vertexDegree - nonSecKnownNum - sectorKnownNum
  const sectorUnknownNum = 2 - sectorKnownNum

  // If vertex has 1 line already and all remaining unknowns are in this sector,
  // then sector must contribute exactly 1 line to make vertex degree = 2
  if (nonSecLineNum === 1 && remainingUnknowns === sectorUnknownNum && sectorUnknownNum > 0) {
    tighten(SECTOR_MASK_ONLY_1)
  }
  // If all non-sector edges are lines (2 lines), vertex degree is already 2
  if (nonSecLineNum === 2 ) {
    tighten(SECTOR_MASK_ONLY_0)
  }
  // If all non-sector edges are blanks (2 blanks), sector cannot be 1
  // (vertex would have degree 1 if sector contributes 1, or degree 0/2 if sector contributes 0/2)
  if (nonSecCrossNum === 2) {
    tighten(SECTOR_MASK_NOT_1)
  }
  // step2: infer based on cell number
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  const clueValue = ((clue?.kind === 'number') && (clue.value !== '?')) ? Number(clue.value) : null
  if ( clueValue !== null ) {
    const edgeKeys = getCellEdgeKeys(row, col)
    const stats = edgeKeys.reduce(
      (acc, key) => {
        const mark = puzzle.edges[key]?.mark ?? 'unknown'
        if (mark === 'line') acc.lineNum++
        else if (mark === 'blank') acc.crossNum++
        else acc.unknownNum++
        return acc
      }, { lineNum: 0, crossNum: 0, unknownNum: 0 }
    )
    if (stats.lineNum === clueValue) {
      tighten(maskForExactLineCount(secLineNum))
    }
    if (clueValue === 3 && diagSecLineNum === 2) {
      tighten(SECTOR_MASK_ONLY_1)
    }
    if (clueValue === 2 && diagSecLineNum === 1 && diagSecCrossNum === 1) {
      tighten(SECTOR_MASK_ONLY_1)
    }
    if (clueValue === 1 && diagSecCrossNum === 2) {
      tighten(SECTOR_MASK_ONLY_1)
    }
    if (clueValue === 3 || secLineNum === 1) {
      tighten(SECTOR_MASK_NOT_0)
    }
    if (clueValue === 1) {
      tighten(SECTOR_MASK_NOT_2)
    }
  }

  // step3. infer via cells. Basics.
  if (secCrossNum === 1) {
    tighten(SECTOR_MASK_NOT_2)
  }
  return mask
}

const createContiguousThreeRunBoundariesRule = (): Rule => ({
  id: 'contiguous-three-run-boundaries',
  name: 'Contiguous 3-Run Boundaries',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const allAffectedCells = new Set<string>()
    let firstExample: string | null = null

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

        const runEdges: string[] = []
        for (let boundaryCol = cStart; boundaryCol <= cEnd + 1; boundaryCol += 1) {
          const key = edgeKey([r, boundaryCol], [r + 1, boundaryCol])
          if ((puzzle.edges[key]?.mark ?? 'unknown') === 'unknown' && !decidedEdges.has(key)) {
            runEdges.push(key)
          }
        }

        if (runEdges.length > 0) {
          for (const key of runEdges) decidedEdges.set(key, 'line')
          for (let col = cStart; col <= cEnd; col += 1) allAffectedCells.add(cellKey(r, col))
          if (firstExample === null) firstExample = `row ${r} cols ${cStart}\u2013${cEnd}`
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

        const runEdges: string[] = []
        for (let boundaryRow = rStart; boundaryRow <= rEnd + 1; boundaryRow += 1) {
          const key = edgeKey([boundaryRow, c], [boundaryRow, c + 1])
          if ((puzzle.edges[key]?.mark ?? 'unknown') === 'unknown' && !decidedEdges.has(key)) {
            runEdges.push(key)
          }
        }

        if (runEdges.length > 0) {
          for (const key of runEdges) decidedEdges.set(key, 'line')
          for (let row = rStart; row <= rEnd; row += 1) allAffectedCells.add(cellKey(row, c))
          if (firstExample === null) firstExample = `col ${c} rows ${rStart}\u2013${rEnd}`
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Contiguous 3-run boundaries forced (e.g., ${firstExample}).`
          : 'Contiguous 3-run boundaries forced.',
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

const createDiagonalAdjacentThreeOuterCornersRule = (): Rule => ({
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

const createCellCountRule = (): Rule => ({
  id: 'cell-count-completion',
  name: 'Cell Clue Completion',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    let firstExample: string | null = null

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

      let toMark: EdgeMark | null = null
      if (lines.length === clue) {
        toMark = 'blank'
      } else if (lines.length + unknown.length === clue) {
        toMark = 'line'
      }
      if (toMark === null) continue

      let addedAny = false
      for (const [edge] of unknown) {
        if (!decidedEdges.has(edge)) {
          decidedEdges.set(edge, toMark)
          addedAny = true
        }
      }

      if (addedAny) {
        affectedCells.add(key)
        if (firstExample === null) firstExample = `(${row}, ${col})`
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedCells.size - 1
    return {
      message:
        firstExample !== null
          ? `Cell ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: clue completion applied.`
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

const createVertexDegreeRule = (): Rule => ({
  id: 'vertex-degree',
  name: 'Vertex Degree Rule',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    let firstVertex: string | null = null

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

        let toMark: EdgeMark | null = null
        let edgesToDecide: string[] = []

        if (lineCount === 2) {
          toMark = 'blank'
          edgesToDecide = unknown.map(([e]) => e)
        } else if (lineCount === 1 && unknown.length === 1) {
          toMark = 'line'
          edgesToDecide = [unknown[0][0]]
        } else if (lineCount === 0 && unknown.length === 1) {
          toMark = 'blank'
          edgesToDecide = [unknown[0][0]]
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
          firstVertex = `(${r}, ${c})`
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstVertex !== null
          ? `Vertex ${firstVertex}: degree rule applied.`
          : 'Vertex degree rule applied.',
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

const createColorEdgePropagationRule = (): Rule => ({
  id: 'color-edge-propagation',
  name: 'Color-Edge Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberEdge = (key: string, to: EdgeMark): boolean => {
      const alreadyDecided = decidedEdges.get(key)
      if (alreadyDecided) {
        return alreadyDecided === to
      }
      const current = puzzle.edges[key]?.mark ?? 'unknown'
      if (current !== 'unknown') {
        return current === to
      }
      decidedEdges.set(key, to)
      return true
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      return true
    }

    for (const [edgeKeyValue] of Object.entries(puzzle.edges)) {
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
        continue
      }
      const [cellA, cellB] = adjacentCells
      const colorA = getEffectiveCellColor(cellA)
      const colorB = getEffectiveCellColor(cellB)
      if (colorA === null || colorB === null) {
        continue
      }
      const toMark: EdgeMark = colorA === colorB ? 'blank' : 'line'
      if (!rememberEdge(edgeKeyValue, toMark)) {
        continue
      }
      if (decidedEdges.get(edgeKeyValue) === toMark) {
        affectedCells.add(cellA)
        affectedCells.add(cellB)
      }
    }

    const allEdges = Object.keys(puzzle.edges)
    for (const edgeKeyValue of allEdges) {
      const effectiveMark = decidedEdges.get(edgeKeyValue) ?? (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown')
      if (effectiveMark !== 'line' && effectiveMark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 2) {
        continue
      }
      const [cellA, cellB] = adjacentCells
      const colorA = getEffectiveCellColor(cellA)
      const colorB = getEffectiveCellColor(cellB)
      if ((colorA === null) === (colorB === null)) {
        continue
      }
      const knownColor = colorA ?? colorB
      if (knownColor === null) {
        continue
      }
      const targetCell = colorA === null ? cellA : cellB
      const inferredColor =
        effectiveMark === 'line' ? oppositeSlitherCellColor(knownColor) : knownColor
      if (!rememberCellFill(targetCell, inferredColor)) {
        continue
      }
      affectedCells.add(cellA)
      affectedCells.add(cellB)
    }

    if (decidedEdges.size === 0 && decidedCellFills.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = [
      ...[...decidedEdges.entries()].map(([k, to]) => ({
        kind: 'edge' as const,
        edgeKey: k,
        from: 'unknown' as const,
        to,
      })),
      ...[...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
    ]

    const edgeCount = decidedEdges.size
    const colorCount = decidedCellFills.size
    return {
      message: `Color-edge propagation applied (${edgeCount} edge update(s), ${colorCount} color update(s)).`,
      diffs,
      affectedCells: [...affectedCells],
    }
  },
})

const createColorOutsideSeedingRule = (): Rule => ({
  id: 'color-outside-seeding',
  name: 'Color Outside Seeding',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      affectedCells.add(key)
      return true
    }

    for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
      const mark = edgeState?.mark ?? 'unknown'
      if (mark !== 'line' && mark !== 'blank') {
        continue
      }
      const adjacentCells = getEdgeAdjacentCellKeys(puzzle, edgeKeyValue)
      if (adjacentCells.length !== 1) {
        continue
      }
      const inferredColor: SlitherCellColor = mark === 'line' ? 'green' : 'yellow'
      rememberCellFill(adjacentCells[0], inferredColor)
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Color outside seeding applied (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

const createColorCluePropagationRule = (): Rule => ({
  id: 'color-clue-propagation',
  name: 'Color Clue Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedCellFills = new Map<string, SlitherCellColor>()
    const affectedCells = new Set<string>()

    const getEffectiveCellColor = (key: string): SlitherCellColor | null => {
      const decided = decidedCellFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.cells[key]?.fill
      return isSlitherCellColor(current) ? current : null
    }

    const rememberCellFill = (key: string, to: SlitherCellColor): boolean => {
      const current = getEffectiveCellColor(key)
      if (current === to) {
        return true
      }
      if (current !== null) {
        return false
      }
      decidedCellFills.set(key, to)
      affectedCells.add(key)
      return true
    }

    for (const [cellKeyValue, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'number' || cell.clue.value === '?') {
        continue
      }
      const clue = Number(cell.clue.value)
      const neighbors = getCellNeighborKeys(puzzle, cellKeyValue)
      const innercnt = neighbors.filter((k) => getEffectiveCellColor(k) === 'green').length
      const outercnt = neighbors.filter((k) => getEffectiveCellColor(k) === 'yellow').length

      if (clue < innercnt || 4 - clue < outercnt) {
        rememberCellFill(cellKeyValue, 'green')
      }
      if (clue < outercnt || 4 - clue < innercnt) {
        rememberCellFill(cellKeyValue, 'yellow')
      }

      const currentColor = getEffectiveCellColor(cellKeyValue)
      if (currentColor === 'green' && clue === outercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'green'))
      }
      if (currentColor === 'yellow' && clue === innercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'yellow'))
      }
      if (currentColor === 'yellow' && clue === 4 - outercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'green'))
      }
      if (currentColor === 'green' && clue === 4 - innercnt) {
        neighbors.forEach((neighbor) => rememberCellFill(neighbor, 'yellow'))
      }
    }

    if (decidedCellFills.size === 0) {
      return null
    }

    return {
      message: `Color clue propagation applied (${decidedCellFills.size} color update(s)).`,
      diffs: [...decidedCellFills.entries()].map(([k, toFill]) => ({
        kind: 'cell' as const,
        cellKey: k,
        fromFill: (puzzle.cells[k]?.fill ?? null) as string | null,
        toFill,
      })),
      affectedCells: [...affectedCells],
    }
  },
})

const createPreventPrematureLoopRule = (): Rule => ({
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
        firstExample = edgeKeyValue
      }
    }

    if (decidedEdges.size === 0) {
      return null
    }

    return {
      message:
        firstExample !== null
          ? `Edge ${firstExample} would close a premature loop, so matching edges are blanked.`
          : 'Edges that would close a premature loop are blanked.',
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

const createApplySectorsInference = (): Rule => ({
  id: "sector-inference",
  name: "Apply Vertex Flow Sector Inference",
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
    const diffs: RuleApplication['diffs'] = []
    const affectedCells = new Set<string>()
    const affectedSectors: string[] = []
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        for (const corner of corners) {
          const key = sectorKey(r, c, corner)
          const currentMask = puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL
          const inferredMask = inferSectorMaskByVertex(puzzle, r, c, corner)
          const nextMask = sectorMaskIntersect(currentMask, inferredMask)
          if (nextMask === 0 || nextMask === currentMask) {
            continue
          }
          diffs.push({
            kind: 'sector',
            sectorKey: key,
            fromMask: currentMask,
            toMask: nextMask,
          })
          affectedCells.add(cellKey(r, c))
          affectedSectors.push(key)
        }
      }
    }
    if (diffs.length === 0) {
      return null
    }
    return {
      message: 'Apply Sectors from Vertex: inferred corner sector constraints from current edges.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors,
    }
  }
})

const createSectorDiagonalSharedVertexPropagationRule = (): Rule => ({
  id: 'sector-diagonal-shared-vertex-propagation',
  name: 'Sector Diagonal Shared Vertex Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const diagonalCases: Array<{
      sourceCorner: SectorCorner
      targetCorner: SectorCorner
      rowOffset: number
      colOffset: number
    }> = [
      { sourceCorner: 'nw', targetCorner: 'se', rowOffset: -1, colOffset: -1 },
      { sourceCorner: 'ne', targetCorner: 'sw', rowOffset: -1, colOffset: 1 },
      { sourceCorner: 'sw', targetCorner: 'ne', rowOffset: 1, colOffset: -1 },
      { sourceCorner: 'se', targetCorner: 'nw', rowOffset: 1, colOffset: 1 },
    ]

    const diffs: RuleApplication['diffs'] = []
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        for (const diagonalCase of diagonalCases) {
          const sourceSectorKey = sectorKey(r, c, diagonalCase.sourceCorner)
          const sourceMask = puzzle.sectors[sourceSectorKey]?.constraintsMask ?? SECTOR_MASK_ALL

          let impliedMask: SectorConstraintMask | null = null
          if (sourceMask === SECTOR_MASK_ONLY_1) {
            impliedMask = SECTOR_MASK_ONLY_1
          } else if (sourceMask === SECTOR_MASK_NOT_1) {
            impliedMask = SECTOR_MASK_NOT_1
          } else if (sourceMask === SECTOR_MASK_NOT_0) {
            impliedMask = SECTOR_MASK_NOT_2
          }

          if (impliedMask === null) {
            continue
          }

          const targetRow = r + diagonalCase.rowOffset
          const targetCol = c + diagonalCase.colOffset
          if (targetRow < 0 || targetRow >= puzzle.rows || targetCol < 0 || targetCol >= puzzle.cols) {
            continue
          }

          const targetSectorKey = sectorKey(targetRow, targetCol, diagonalCase.targetCorner)
          const targetMask = puzzle.sectors[targetSectorKey]?.constraintsMask ?? SECTOR_MASK_ALL
          const nextMask = sectorMaskIntersect(targetMask, impliedMask)
          if (nextMask === 0 || nextMask === targetMask) {
            continue
          }

          diffs.push({
            kind: 'sector',
            sectorKey: targetSectorKey,
            fromMask: targetMask,
            toMask: nextMask,
          })
          affectedCells.add(cellKey(r, c))
          affectedCells.add(cellKey(targetRow, targetCol))
          affectedSectors.add(sourceSectorKey)
          affectedSectors.add(targetSectorKey)
        }
      }
    }

    if (diffs.length === 0) {
      return null
    }

    return {
      message: 'Diagonal shared-vertex sectors propagate corner constraints to opposite diagonal sectors.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createSectorClueTwoIntraCellPropagationRule = (): Rule => ({
  id: 'sector-clue-two-intra-cell-propagation',
  name: 'Sector Clue-2 In-Cell Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const oppositeCorner: Record<SectorCorner, SectorCorner> = {
      nw: 'se',
      ne: 'sw',
      sw: 'ne',
      se: 'nw',
    }
    const adjacentCorners: Record<SectorCorner, [SectorCorner, SectorCorner]> = {
      nw: ['ne', 'sw'],
      ne: ['nw', 'se'],
      sw: ['nw', 'se'],
      se: ['ne', 'sw'],
    }

    const nextMasks = new Map<string, SectorConstraintMask>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const clue = puzzle.cells[cellKey(r, c)]?.clue
        if (clue?.kind !== 'number' || clue.value !== 2) {
          continue
        }

        const rememberSectorMask = (
          sourceSectorKey: string | null,
          targetSectorKey: string,
          impliedMask: SectorConstraintMask,
        ): void => {
          const currentTargetMask =
            nextMasks.get(targetSectorKey) ?? (puzzle.sectors[targetSectorKey]?.constraintsMask ?? SECTOR_MASK_ALL)
          const nextTargetMask = sectorMaskIntersect(currentTargetMask, impliedMask)
          if (nextTargetMask === 0 || nextTargetMask === currentTargetMask) {
            return
          }
          nextMasks.set(targetSectorKey, nextTargetMask)
          affectedCells.add(cellKey(r, c))
          if (sourceSectorKey !== null) {
            affectedSectors.add(sourceSectorKey)
          }
          affectedSectors.add(targetSectorKey)
        }

        const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
        for (const sourceCorner of corners) {
          const sourceSectorKey = sectorKey(r, c, sourceCorner)
          const sourceMask = puzzle.sectors[sourceSectorKey]?.constraintsMask ?? SECTOR_MASK_ALL

          if (sourceMask === SECTOR_MASK_NOT_1) {
            const opposite = oppositeCorner[sourceCorner]
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, opposite), SECTOR_MASK_NOT_1)
            const [adjA, adjB] = adjacentCorners[sourceCorner]
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, adjA), SECTOR_MASK_ONLY_1)
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, adjB), SECTOR_MASK_ONLY_1)
            continue
          }

          if (sourceMask === SECTOR_MASK_NOT_2) {
            const opposite = oppositeCorner[sourceCorner]
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, opposite), SECTOR_MASK_NOT_0)
            continue
          }

          if (sourceMask === SECTOR_MASK_NOT_0) {
            const opposite = oppositeCorner[sourceCorner]
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, opposite), SECTOR_MASK_NOT_2)
          }

          // Clue 2: opposite corners partition the four cell edges (nw/se and ne/sw). Each pair's
          // line-count sums to 2 total, so if one corner is exactly 1 line, the opposite corner is too.
          if (sourceMask === SECTOR_MASK_ONLY_1) {
            const opposite = oppositeCorner[sourceCorner]
            rememberSectorMask(sourceSectorKey, sectorKey(r, c, opposite), SECTOR_MASK_ONLY_1)
            continue
          }
        }

        const [topEdge, bottomEdge, leftEdge, rightEdge] = getCellEdgeKeys(r, c)
        const cellEdges = [topEdge, bottomEdge, leftEdge, rightEdge]
        const lineEdges = cellEdges.filter((edge) => (puzzle.edges[edge]?.mark ?? 'unknown') === 'line')
        const blankEdges = cellEdges.filter((edge) => (puzzle.edges[edge]?.mark ?? 'unknown') === 'blank')

        const nonOverlappingCornersByEdge: Record<string, [SectorCorner, SectorCorner]> = {
          [topEdge]: ['sw', 'se'],
          [bottomEdge]: ['nw', 'ne'],
          [leftEdge]: ['ne', 'se'],
          [rightEdge]: ['nw', 'sw'],
        }

        if (lineEdges.length === 1) {
          const [cornerA, cornerB] = nonOverlappingCornersByEdge[lineEdges[0]]
          rememberSectorMask(null, sectorKey(r, c, cornerA), SECTOR_MASK_NOT_2)
          rememberSectorMask(null, sectorKey(r, c, cornerB), SECTOR_MASK_NOT_2)
        }

        if (blankEdges.length === 1) {
          const [cornerA, cornerB] = nonOverlappingCornersByEdge[blankEdges[0]]
          rememberSectorMask(null, sectorKey(r, c, cornerA), SECTOR_MASK_NOT_0)
          rememberSectorMask(null, sectorKey(r, c, cornerB), SECTOR_MASK_NOT_0)
        }
      }
    }

    const diffs: RuleApplication['diffs'] = []
    for (const [sectorKeyValue, toMask] of nextMasks.entries()) {
      const fromMask = puzzle.sectors[sectorKeyValue]?.constraintsMask ?? SECTOR_MASK_ALL
      if (fromMask === toMask) {
        continue
      }
      diffs.push({
        kind: 'sector',
        sectorKey: sectorKeyValue,
        fromMask,
        toMask,
      })
    }

    if (diffs.length === 0) {
      return null
    }

    return {
      message:
        'Clue-2 in-cell sector propagation tightens opposite corners (including onlyOne pairs) and non-overlapping corner constraints.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createSectorClueOneThreeIntraCellPropagationRule = (): Rule => ({
  id: 'sector-clue-one-three-intra-cell-propagation',
  name: 'Sector Clue-1/3 onlyOne Opposite Edges',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstExample: string | null = null

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const clue = puzzle.cells[cellKey(r, c)]?.clue
        if (clue?.kind !== 'number' || clue.value === '?') {
          continue
        }
        const clueValue = Number(clue.value)
        if (clueValue !== 1 && clueValue !== 3) {
          continue
        }

        const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
        for (const corner of corners) {
          const sk = sectorKey(r, c, corner)
          const mask = puzzle.sectors[sk]?.constraintsMask ?? SECTOR_MASK_ALL
          if (sectorMaskSingleValue(mask) !== 1) {
            continue
          }

          const sectorEdges = getCornerEdgeKeys(r, c, corner)
          const cellEdges = getCellEdgeKeys(r, c)
          const oppositeEdges = cellEdges.filter((e) => !sectorEdges.includes(e))
          const toMark: EdgeMark = clueValue === 1 ? 'blank' : 'line'

          for (const edge of oppositeEdges) {
            if ((puzzle.edges[edge]?.mark ?? 'unknown') === 'unknown' && !decidedEdges.has(edge)) {
              decidedEdges.set(edge, toMark)
              affectedCells.add(cellKey(r, c))
              affectedSectors.add(sk)
              if (firstExample === null) firstExample = `(${r}, ${c}, ${corner})`
            }
          }
        }
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedSectors.size - 1
    return {
      message:
        firstExample !== null
          ? `Cell ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: clue-1/3 onlyOne forces opposite cell edges.`
          : 'Clue-1/3 onlyOne opposite edges applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createVertexOnlyOneNonSectorBalanceRule = (): Rule => ({
  id: 'vertex-onlyone-non-sector-balance',
  name: 'Vertex onlyOne Non-Sector Balance',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstExample: string | null = null

    const { rows, cols } = puzzle

    for (let vr = 1; vr < rows; vr += 1) {
      for (let vc = 1; vc < cols; vc += 1) {
        const incident = getVertexIncidentEdges(vr, vc, rows, cols)
        if (incident.length !== 4) {
          continue
        }

        const sectorACases: Array<{ row: number; col: number; corner: SectorCorner }> = [
          { row: vr - 1, col: vc - 1, corner: 'se' },
          { row: vr - 1, col: vc, corner: 'sw' },
          { row: vr, col: vc - 1, corner: 'ne' },
          { row: vr, col: vc, corner: 'nw' },
        ]

        for (const { row, col, corner } of sectorACases) {
          const sk = sectorKey(row, col, corner)
          const mask = puzzle.sectors[sk]?.constraintsMask ?? SECTOR_MASK_ALL
          if (sectorMaskSingleValue(mask) !== 1) {
            continue
          }

          const sectorEdges = getCornerEdgeKeys(row, col, corner)
          const nonSectorEdges = incident.filter((e) => !sectorEdges.includes(e))
          if (nonSectorEdges.length !== 2) {
            continue
          }

          const marks = nonSectorEdges.map((e) => puzzle.edges[e]?.mark ?? 'unknown')
          const unknownCount = marks.filter((m) => m === 'unknown').length
          if (unknownCount !== 1) {
            continue
          }

          const lineIdx = marks.findIndex((m) => m === 'line')
          const blankIdx = marks.findIndex((m) => m === 'blank')
          const unknownIdx = marks.findIndex((m) => m === 'unknown')

          let toMark: EdgeMark | null = null
          if (blankIdx !== -1 && unknownIdx !== -1) {
            toMark = 'line'
          } else if (lineIdx !== -1 && unknownIdx !== -1) {
            toMark = 'blank'
          }

          if (toMark === null) {
            continue
          }

          const unknownEdge = nonSectorEdges[unknownIdx]
          if (!decidedEdges.has(unknownEdge)) {
            decidedEdges.set(unknownEdge, toMark)
            affectedCells.add(cellKey(row, col))
            affectedSectors.add(sk)
            if (firstExample === null) firstExample = `(${vr}, ${vc})`
          }
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Vertex ${firstExample}: onlyOne non-sector balance applied.`
          : 'Vertex onlyOne non-sector balance applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createSectorConstraintEdgePropagationRule = (): Rule => ({
  id: 'sector-constraint-edge-propagation',
  name: 'Sector Constraint Edge Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstExample: string | null = null

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
        for (const corner of corners) {
          const key = sectorKey(r, c, corner)
          const mask = puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL
          const sectorEdges = getCornerEdgeKeys(r, c, corner)
          const marks = sectorEdges.map((edge) => puzzle.edges[edge]?.mark ?? 'unknown')
          const lineCount = marks.filter((mark) => mark === 'line').length
          const blankCount = marks.filter((mark) => mark === 'blank').length
          const unknownEdges = sectorEdges.filter((edge) => (puzzle.edges[edge]?.mark ?? 'unknown') === 'unknown')

          if (unknownEdges.length === 0) {
            continue
          }

          let toMark: EdgeMark | null = null
          let edgesToDecide: string[] = []

          if (mask === SECTOR_MASK_ONLY_2) {
            toMark = 'line'
            edgesToDecide = unknownEdges
          } else if (mask === SECTOR_MASK_ONLY_0) {
            toMark = 'blank'
            edgesToDecide = unknownEdges
          } else if (mask === SECTOR_MASK_ONLY_1) {
            if (lineCount === 1 && blankCount === 0 && unknownEdges.length === 1) {
              toMark = 'blank'
              edgesToDecide = [unknownEdges[0]]
            } else if (blankCount === 1 && lineCount === 0 && unknownEdges.length === 1) {
              toMark = 'line'
              edgesToDecide = [unknownEdges[0]]
            }
          }

          if (toMark === null || edgesToDecide.length === 0) continue

          let addedAny = false
          for (const edge of edgesToDecide) {
            if (!decidedEdges.has(edge)) {
              decidedEdges.set(edge, toMark)
              addedAny = true
            }
          }

          if (addedAny) {
            affectedCells.add(cellKey(r, c))
            affectedSectors.add(key)
            if (firstExample === null) firstExample = `(${r}, ${c}, ${corner})`
          }
        }
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedSectors.size - 1
    return {
      message:
        firstExample !== null
          ? `Sector ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: constraint propagated to edges.`
          : 'Sector constraint edge propagation applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createSectorNotOneClueTwoPropagationRule = (): Rule => ({
  id: 'sector-not-one-clue-two-propagation',
  name: 'Sector notOne Clue-2 Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const cases: Array<{ target: SectorCorner; opposite: SectorCorner }> = [
      { target: 'nw', opposite: 'se' },
      { target: 'se', opposite: 'nw' },
      { target: 'ne', opposite: 'sw' },
      { target: 'sw', opposite: 'ne' },
    ]

    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstExample: string | null = null

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const clue = puzzle.cells[cellKey(r, c)]?.clue
        if (clue?.kind !== 'number' || clue.value !== 2) {
          continue
        }

        for (const { target, opposite } of cases) {
          const targetSectorKey = sectorKey(r, c, target)
          const targetMask = puzzle.sectors[targetSectorKey]?.constraintsMask ?? SECTOR_MASK_ALL
          if (sectorMaskAllows(targetMask, 1)) {
            continue
          }

          const oppositeEdges = getCornerEdgeKeys(r, c, opposite)
          const oppositeHasLine = oppositeEdges.some((edge) => (puzzle.edges[edge]?.mark ?? 'unknown') === 'line')
          if (!oppositeHasLine) {
            continue
          }

          const targetEdges = getCornerEdgeKeys(r, c, target)
          const hasTargetLine = targetEdges.some((edge) => (puzzle.edges[edge]?.mark ?? 'unknown') === 'line')
          if (hasTargetLine) {
            continue
          }

          const edgesToBlank = targetEdges.filter(
            (edgeKeyValue) =>
              (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown') === 'unknown' && !decidedEdges.has(edgeKeyValue),
          )
          if (edgesToBlank.length === 0) {
            continue
          }

          for (const edgeKeyValue of edgesToBlank) {
            decidedEdges.set(edgeKeyValue, 'blank')
          }
          affectedCells.add(cellKey(r, c))
          affectedSectors.add(targetSectorKey)
          affectedSectors.add(sectorKey(r, c, opposite))
          if (firstExample === null) firstExample = `(${r}, ${c})`
        }
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedCells.size - 1
    return {
      message:
        firstExample !== null
          ? `Cell ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: clue-2 notOne propagation applied.`
          : 'Clue-2 notOne propagation applied.',
      diffs: [...decidedEdges.entries()].map(([edgeKey, to]) => ({
        kind: 'edge' as const,
        edgeKey,
        from: 'unknown' as const,
        to,
      })),
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const STRONG_MAX_CANDIDATES = 200
const STRONG_MAX_TRIAL_STEPS = 120
const STRONG_MAX_MS = 50

type StrongCandidate =
  | {
      kind: 'sector-only-one'
      sectorKey: string
      row: number
      col: number
      edgeA: string
      edgeB: string
    }
  | {
      kind: 'edge'
      edgeKey: string
    }

const collectStrongCandidates = (puzzle: PuzzleIR, maxCandidates: number): StrongCandidate[] => {
  const candidates: StrongCandidate[] = []
  const seenOnlyOneEdges = new Set<string>()

  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (sectorMaskSingleValue(mask) !== 1) {
      continue
    }
    const [row, col, corner] = parseSectorKey(sectorKeyValue)
    const [edgeA, edgeB] = getCornerEdgeKeys(row, col, corner)
    if ((puzzle.edges[edgeA]?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    if ((puzzle.edges[edgeB]?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    candidates.push({
      kind: 'sector-only-one',
      sectorKey: sectorKeyValue,
      row,
      col,
      edgeA,
      edgeB,
    })
    seenOnlyOneEdges.add(edgeA)
    seenOnlyOneEdges.add(edgeB)
    if (candidates.length >= maxCandidates) {
      return candidates
    }
  }

  for (const [edgeKeyValue, edgeState] of Object.entries(puzzle.edges)) {
    if ((edgeState?.mark ?? 'unknown') !== 'unknown') {
      continue
    }
    if (seenOnlyOneEdges.has(edgeKeyValue)) {
      continue
    }
    candidates.push({ kind: 'edge', edgeKey: edgeKeyValue })
    if (candidates.length >= maxCandidates) {
      break
    }
  }

  return candidates
}

const applyEdgeAssumption = (puzzle: PuzzleIR, edgeKeyValue: string, to: EdgeMark): boolean => {
  const current = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown') {
    return current === to
  }
  puzzle.edges[edgeKeyValue].mark = to
  return true
}

const detectHardContradiction = (puzzle: PuzzleIR): boolean => {
  for (let r = 0; r <= puzzle.rows; r += 1) {
    for (let c = 0; c <= puzzle.cols; c += 1) {
      const incident = getVertexIncidentEdges(r, c, puzzle.rows, puzzle.cols)
      if (incident.length === 0) {
        continue
      }
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of incident) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > 2) {
        return true
      }
      if (unknownCount === 0 && lineCount !== 0 && lineCount !== 2) {
        return true
      }
    }
  }

  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const clue = puzzle.cells[cellKey(r, c)]?.clue
      if (clue?.kind !== 'number' || clue.value === '?') {
        continue
      }
      const target = Number(clue.value)
      const cellEdges = getCellEdgeKeys(r, c)
      let lineCount = 0
      let unknownCount = 0
      for (const edgeKeyValue of cellEdges) {
        const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
        if (mark === 'line') lineCount += 1
        else if (mark === 'unknown') unknownCount += 1
      }
      if (lineCount > target || lineCount + unknownCount < target) {
        return true
      }
    }
  }

  for (const [sectorKeyValue, sectorState] of Object.entries(puzzle.sectors)) {
    const mask = sectorState?.constraintsMask ?? SECTOR_MASK_ALL
    if (!sectorMaskIsValid(mask)) {
      return true
    }
    const [row, col, corner] = parseSectorKey(sectorKeyValue)
    const sectorEdges = getCornerEdgeKeys(row, col, corner)
    let lineCount = 0
    let unknownCount = 0
    for (const edgeKeyValue of sectorEdges) {
      const mark = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
      if (mark === 'line') lineCount += 1
      else if (mark === 'unknown') unknownCount += 1
    }
    if (unknownCount === 0 && !sectorMaskAllows(mask, lineCount as 0 | 1 | 2)) {
      return true
    }
    let hasFeasible = false
    for (let value = lineCount; value <= lineCount + unknownCount; value += 1) {
      if (value <= 2 && sectorMaskAllows(mask, value as 0 | 1 | 2)) {
        hasFeasible = true
        break
      }
    }
    if (!hasFeasible) {
      return true
    }
  }

  const lineEdges = Object.entries(puzzle.edges).filter(([, edgeState]) => (edgeState?.mark ?? 'unknown') === 'line')
  if (lineEdges.length === 0) {
    return false
  }
  const vertexCols = puzzle.cols + 1
  const vertexCount = (puzzle.rows + 1) * vertexCols
  const toVertexIndex = (row: number, col: number): number => row * vertexCols + col
  const parent = Array.from({ length: vertexCount }, (_, idx) => idx)
  const rank = new Array<number>(vertexCount).fill(0)
  const degree = new Map<number, number>()
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

  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    union(leftIdx, rightIdx)
    degree.set(leftIdx, (degree.get(leftIdx) ?? 0) + 1)
    degree.set(rightIdx, (degree.get(rightIdx) ?? 0) + 1)
  }

  const componentEdgeCount = new Map<number, number>()
  const componentVertices = new Map<number, Set<number>>()
  for (const [edgeKeyValue] of lineEdges) {
    const [left, right] = parseEdgeKey(edgeKeyValue)
    const leftIdx = toVertexIndex(left[0], left[1])
    const rightIdx = toVertexIndex(right[0], right[1])
    const root = find(leftIdx)
    componentEdgeCount.set(root, (componentEdgeCount.get(root) ?? 0) + 1)
    const vertices = componentVertices.get(root) ?? new Set<number>()
    vertices.add(leftIdx)
    vertices.add(rightIdx)
    componentVertices.set(root, vertices)
  }

  let closedLoopEdges = 0
  let closedLoopComponents = 0
  for (const [root, vertices] of componentVertices.entries()) {
    const edgeCount = componentEdgeCount.get(root) ?? 0
    if (edgeCount !== vertices.size) {
      continue
    }
    let allDegreeTwo = true
    for (const vertexIdx of vertices) {
      if ((degree.get(vertexIdx) ?? 0) !== 2) {
        allDegreeTwo = false
        break
      }
    }
    if (!allDegreeTwo) {
      continue
    }
    closedLoopEdges += edgeCount
    closedLoopComponents += 1
  }
  if (closedLoopComponents > 1) {
    return true
  }
  if (closedLoopComponents === 1 && closedLoopEdges < lineEdges.length) {
    return true
  }

  return false
}

const runTrialUntilFixpoint = (
  puzzle: PuzzleIR,
  deterministicRules: Rule[],
  maxTrialSteps: number,
  deadlineMs: number,
): { contradiction: boolean; timedOut: boolean } => {
  if (detectHardContradiction(puzzle)) {
    return { contradiction: true, timedOut: false }
  }

  let trial = puzzle
  for (let stepNumber = 1; stepNumber <= maxTrialSteps; stepNumber += 1) {
    if (Date.now() > deadlineMs) {
      return { contradiction: false, timedOut: true }
    }
    const { nextPuzzle, step } = runNextRule(trial, deterministicRules, stepNumber)
    if (!step) {
      return { contradiction: detectHardContradiction(trial), timedOut: false }
    }
    trial = nextPuzzle
    if (detectHardContradiction(trial)) {
      return { contradiction: true, timedOut: false }
    }
  }
  return { contradiction: false, timedOut: Date.now() > deadlineMs }
}

const createStrongInferenceRule = (): Rule => ({
  id: 'strong-inference',
  name: 'Strong Inference (Conservative)',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const deterministicRules = slitherRules.filter((rule) => rule.id !== 'strong-inference')
    const candidates = collectStrongCandidates(puzzle, STRONG_MAX_CANDIDATES)
    if (candidates.length === 0) {
      return null
    }

    const deadlineMs = Date.now() + STRONG_MAX_MS
    for (const candidate of candidates) {
      if (Date.now() > deadlineMs) {
        break
      }

      const branchA = clonePuzzle(puzzle)
      const branchB = clonePuzzle(puzzle)
      let branchASetupOk = true
      let branchBSetupOk = true
      const branchADiffs: RuleApplication['diffs'] = []
      const branchBDiffs: RuleApplication['diffs'] = []

      if (candidate.kind === 'sector-only-one') {
        branchASetupOk =
          applyEdgeAssumption(branchA, candidate.edgeA, 'line') &&
          applyEdgeAssumption(branchA, candidate.edgeB, 'blank')
        branchBSetupOk =
          applyEdgeAssumption(branchB, candidate.edgeA, 'blank') &&
          applyEdgeAssumption(branchB, candidate.edgeB, 'line')
        branchADiffs.push(
          { kind: 'edge', edgeKey: candidate.edgeA, from: 'unknown', to: 'line' },
          { kind: 'edge', edgeKey: candidate.edgeB, from: 'unknown', to: 'blank' },
        )
        branchBDiffs.push(
          { kind: 'edge', edgeKey: candidate.edgeA, from: 'unknown', to: 'blank' },
          { kind: 'edge', edgeKey: candidate.edgeB, from: 'unknown', to: 'line' },
        )
      } else {
        branchASetupOk = applyEdgeAssumption(branchA, candidate.edgeKey, 'line')
        branchBSetupOk = applyEdgeAssumption(branchB, candidate.edgeKey, 'blank')
        branchADiffs.push({ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'line' })
        branchBDiffs.push({ kind: 'edge', edgeKey: candidate.edgeKey, from: 'unknown', to: 'blank' })
      }

      const branchAResult = branchASetupOk
        ? runTrialUntilFixpoint(branchA, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false }
      const branchBResult = branchBSetupOk
        ? runTrialUntilFixpoint(branchB, deterministicRules, STRONG_MAX_TRIAL_STEPS, deadlineMs)
        : { contradiction: true, timedOut: false }

      if (branchAResult.timedOut || branchBResult.timedOut) {
        break
      }
      if (branchAResult.contradiction === branchBResult.contradiction) {
        continue
      }

      const forcedDiffs = branchAResult.contradiction ? branchBDiffs : branchADiffs
      const diffs = forcedDiffs.filter((diff) => {
        if (diff.kind !== 'edge') {
          return false
        }
        return (puzzle.edges[diff.edgeKey]?.mark ?? 'unknown') === 'unknown'
      })
      if (diffs.length === 0) {
        continue
      }

      return {
        message:
          candidate.kind === 'sector-only-one'
            ? `Strong inference on sector ${candidate.sectorKey} eliminated one branch and fixed both corner edges.`
            : `Strong inference on edge ${candidate.edgeKey} eliminated one branch and fixed its state.`,
        diffs,
        affectedCells: candidate.kind === 'sector-only-one' ? [cellKey(candidate.row, candidate.col)] : [],
        affectedSectors: candidate.kind === 'sector-only-one' ? [candidate.sectorKey] : [],
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
  createColorOutsideSeedingRule(),
  createColorEdgePropagationRule(),
  createColorCluePropagationRule(),
  createPreventPrematureLoopRule(),
  createApplySectorsInference(),
  createSectorDiagonalSharedVertexPropagationRule(),
  createSectorClueTwoIntraCellPropagationRule(),
  createSectorClueOneThreeIntraCellPropagationRule(),
  createSectorConstraintEdgePropagationRule(),
  createVertexOnlyOneNonSectorBalanceRule(),
  createSectorNotOneClueTwoPropagationRule(),
  createStrongInferenceRule(),
]
