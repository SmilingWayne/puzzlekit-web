import {
  cellKey,
  edgeKey,
  getCellEdgeKeys,
  getVertexIncidentEdges,
  getCornerEdgeKeys,
  getCornerVertex,
  parseCellKey,
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
  sectorMaskIsSingle,
  type PuzzleIR,
  type SectorConstraintMask,
  type SectorCorner,
} from '../../ir/types'
import type { Rule, RuleApplication } from '../types'

const isClueThree = (puzzle: PuzzleIR, row: number, col: number): boolean => {
  const clue = puzzle.cells[cellKey(row, col)]?.clue
  return clue?.kind === 'number' && clue.value === 3
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
  if (nonSecLineNum === 1 && nonSecCrossNum === 1) {
    tighten(SECTOR_MASK_ONLY_1)
  }
  if (nonSecLineNum === 2 ) {
    tighten(SECTOR_MASK_ONLY_0)
  }
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
            diffs.push({ kind: 'edge', edgeKey: key, from: 'unknown', to: 'line' })
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
            diffs.push({ kind: 'edge', edgeKey: key, from: 'unknown', to: 'line' })
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
            ? [{ kind: 'edge' as const, edgeKey: key, from: 'unknown' as const, to: 'line' as const }]
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
            kind: 'edge',
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
            kind: 'edge',
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
              kind: 'edge',
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
                kind: 'edge',
                edgeKey: unknown[0][0],
                from: 'unknown',
                to: 'line',
              },
            ],
            affectedCells: [],
          }
        }
        if (lineCount === 0 && unknown.length === 1) {
          return {
            message: `Vertex (${r}, ${c}) cannot have degree 1, last undecided edge is blank.`,
            diffs: [
              {
                kind: 'edge',
                edgeKey: unknown[0][0],
                from: 'unknown',
                to: 'blank',
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
      message: 'Clue-2 in-cell sector propagation tightens opposite and non-overlapping corner constraints.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

const createSectorConstraintEdgePropagationRule = (): Rule => ({
  id: 'sector-constraint-edge-propagation',
  name: 'Sector Constraint Edge Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
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

          if (mask === SECTOR_MASK_ONLY_2 || mask === SECTOR_MASK_ONLY_0) {
            const toMark = mask === SECTOR_MASK_ONLY_2 ? 'line' : 'blank'
            return {
              message: `Sector (${r}, ${c}, ${corner}) is exact-${toMark === 'line' ? 'two-lines' : 'zero-lines'}, so undecided corner edges are ${toMark}.`,
              diffs: unknownEdges.map((edge) => ({
                kind: 'edge',
                edgeKey: edge,
                from: 'unknown',
                to: toMark,
              })),
              affectedCells: [cellKey(r, c)],
              affectedSectors: [key],
            }
          }

          if (!sectorMaskIsSingle(mask) || mask !== SECTOR_MASK_ONLY_1) {
            continue
          }
          if (lineCount === 1 && blankCount === 0 && unknownEdges.length === 1) {
            return {
              message: `Sector (${r}, ${c}, ${corner}) is exact-one-line; the remaining corner edge is blank.`,
              diffs: [{ kind: 'edge', edgeKey: unknownEdges[0], from: 'unknown', to: 'blank' }],
              affectedCells: [cellKey(r, c)],
              affectedSectors: [key],
            }
          }
          if (blankCount === 1 && lineCount === 0 && unknownEdges.length === 1) {
            return {
              message: `Sector (${r}, ${c}, ${corner}) is exact-one-line; the remaining corner edge is line.`,
              diffs: [{ kind: 'edge', edgeKey: unknownEdges[0], from: 'unknown', to: 'line' }],
              affectedCells: [cellKey(r, c)],
              affectedSectors: [key],
            }
          }
        }
      }
    }

    return null
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

          const diffs = targetEdges.flatMap((edgeKeyValue) =>
            (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown') === 'unknown'
              ? [{ kind: 'edge' as const, edgeKey: edgeKeyValue, from: 'unknown' as const, to: 'blank' as const }]
              : [],
          )
          if (diffs.length === 0) {
            continue
          }

          return {
            message: `Cell (${r}, ${c}) has clue 2; ${target} sector is notOne and opposite ${opposite} already has a line, so ${target} edges are blank.`,
            diffs,
            affectedCells: [cellKey(r, c)],
            affectedSectors: [targetSectorKey, sectorKey(r, c, opposite)],
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
  createApplySectorsInference(),
  createSectorDiagonalSharedVertexPropagationRule(),
  createSectorClueTwoIntraCellPropagationRule(),
  createSectorConstraintEdgePropagationRule(),
  createSectorNotOneClueTwoPropagationRule(),
]
