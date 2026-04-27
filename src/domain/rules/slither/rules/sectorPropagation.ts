import { cellKey, getCellEdgeKeys, getCornerEdgeKeys, getVertexIncidentEdges, sectorKey } from '../../../ir/keys'
import {
  SECTOR_ALLOW_0,
  SECTOR_ALLOW_1,
  SECTOR_ALLOW_2,
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_NOT_2,
  SECTOR_MASK_ONLY_0,
  SECTOR_MASK_ONLY_1,
  SECTOR_MASK_ONLY_2,
  sectorMaskAllows,
  sectorMaskIntersect,
  sectorMaskSingleValue,
  type EdgeMark,
  type PuzzleIR,
  type SectorLineCount,
  type SectorConstraintMask,
  type SectorCorner,
} from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'

type ClueTwoCombo = {
  id: 'ns' | 'we' | 'nw' | 'ne' | 'sw' | 'se'
  marks: [EdgeMark, EdgeMark, EdgeMark, EdgeMark]
}

const CLUE_TWO_COMBINATIONS: ClueTwoCombo[] = [
  { id: 'ns', marks: ['line', 'line', 'blank', 'blank'] },
  { id: 'we', marks: ['blank', 'blank', 'line', 'line'] },
  { id: 'nw', marks: ['line', 'blank', 'line', 'blank'] },
  { id: 'ne', marks: ['line', 'blank', 'blank', 'line'] },
  { id: 'sw', marks: ['blank', 'line', 'line', 'blank'] },
  { id: 'se', marks: ['blank', 'line', 'blank', 'line'] },
]

const cornerVertices = (row: number, col: number): Array<{ corner: SectorCorner; vr: number; vc: number }> => [
  { corner: 'nw', vr: row, vc: col },
  { corner: 'ne', vr: row, vc: col + 1 },
  { corner: 'sw', vr: row + 1, vc: col },
  { corner: 'se', vr: row + 1, vc: col + 1 },
]

const isComboConsistentWithKnownEdges = (
  puzzle: PuzzleIR,
  cellEdges: [string, string, string, string],
  combo: ClueTwoCombo,
): boolean => {
  for (let i = 0; i < cellEdges.length; i += 1) {
    const current = puzzle.edges[cellEdges[i]]?.mark ?? 'unknown'
    if (current === 'unknown') continue
    if (current !== combo.marks[i]) return false
  }
  return true
}

const isComboVertexFeasible = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  cellEdges: [string, string, string, string],
  combo: ClueTwoCombo,
): boolean => {
  const overrides = new Map<string, EdgeMark>()
  for (let i = 0; i < cellEdges.length; i += 1) {
    overrides.set(cellEdges[i], combo.marks[i])
  }

  const getEffectiveMark = (edgeKeyValue: string): EdgeMark =>
    overrides.get(edgeKeyValue) ?? (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown')

  for (const vertex of cornerVertices(row, col)) {
    const incident = getVertexIncidentEdges(vertex.vr, vertex.vc, puzzle.rows, puzzle.cols)
    const marks = incident.map(getEffectiveMark)
    const lineCount = marks.filter((mark) => mark === 'line').length
    const unknownCount = marks.filter((mark) => mark === 'unknown').length

    if (lineCount > 2) {
      return false
    }

    // A vertex already activated with one line must still have an available continuation.
    if (lineCount === 1 && unknownCount === 0) {
      return false
    }
  }

  return true
}

const comboCornerLineCount = (
  cellEdges: [string, string, string, string],
  combo: ClueTwoCombo,
  cornerEdges: [string, string],
): SectorLineCount => {
  const edgeToMark = new Map<string, EdgeMark>()
  for (let i = 0; i < cellEdges.length; i += 1) {
    edgeToMark.set(cellEdges[i], combo.marks[i])
  }
  return cornerEdges.filter((edgeKeyValue) => edgeToMark.get(edgeKeyValue) === 'line').length as SectorLineCount
}

const isComboConsistentWithSectorMasks = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  cellEdges: [string, string, string, string],
  combo: ClueTwoCombo,
): boolean => {
  const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']
  for (const corner of corners) {
    const cornerEdges = getCornerEdgeKeys(row, col, corner)
    const lineCount = comboCornerLineCount(cellEdges, combo, cornerEdges)
    const currentMask = puzzle.sectors[sectorKey(row, col, corner)]?.constraintsMask ?? SECTOR_MASK_ALL
    if (!sectorMaskAllows(currentMask, lineCount)) {
      return false
    }
  }
  return true
}

const maskForAllowedCounts = (counts: Set<number>): SectorConstraintMask => {
  let mask: SectorConstraintMask = 0
  if (counts.has(0)) mask |= SECTOR_ALLOW_0
  if (counts.has(1)) mask |= SECTOR_ALLOW_1
  if (counts.has(2)) mask |= SECTOR_ALLOW_2
  return mask
}

export const createSectorDiagonalSharedVertexPropagationRule = (): Rule => ({
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

export const createSectorClueTwoCombinationFeasibilityRule = (): Rule => ({
  id: 'sector-clue-two-combination-feasibility',
  name: 'Sector Clue-2 Combination Feasibility',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const nextMasks = new Map<string, SectorConstraintMask>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    const corners: SectorCorner[] = ['nw', 'ne', 'sw', 'se']

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const clue = puzzle.cells[cellKey(r, c)]?.clue
        if (clue?.kind !== 'number' || clue.value !== 2) {
          continue
        }

        const [topEdge, bottomEdge, leftEdge, rightEdge] = getCellEdgeKeys(r, c)
        const cellEdges: [string, string, string, string] = [topEdge, bottomEdge, leftEdge, rightEdge]

        const feasibleCombos = CLUE_TWO_COMBINATIONS.filter((combo) => {
          if (!isComboConsistentWithKnownEdges(puzzle, cellEdges, combo)) {
            return false
          }
          if (!isComboVertexFeasible(puzzle, r, c, cellEdges, combo)) {
            return false
          }
          return isComboConsistentWithSectorMasks(puzzle, r, c, cellEdges, combo)
        })

        if (feasibleCombos.length === 0) {
          continue
        }

        for (const corner of corners) {
          const cornerEdges = getCornerEdgeKeys(r, c, corner)
          const allowedCounts = new Set<number>()

          for (const combo of feasibleCombos) {
            const lineCount = comboCornerLineCount(cellEdges, combo, cornerEdges)
            allowedCounts.add(lineCount)
          }

          const impliedMask = maskForAllowedCounts(allowedCounts)
          const key = sectorKey(r, c, corner)
          const currentMask = nextMasks.get(key) ?? (puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL)
          const narrowedMask = sectorMaskIntersect(currentMask, impliedMask)
          if (narrowedMask === 0 || narrowedMask === currentMask) {
            continue
          }

          nextMasks.set(key, narrowedMask)
          affectedCells.add(cellKey(r, c))
          affectedSectors.add(key)
        }
      }
    }

    const diffs: RuleApplication['diffs'] = []
    for (const [key, toMask] of nextMasks.entries()) {
      const fromMask = puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL
      if (fromMask === toMask) {
        continue
      }
      diffs.push({
        kind: 'sector',
        sectorKey: key,
        fromMask,
        toMask,
      })
    }

    if (diffs.length === 0) {
      return null
    }

    return {
      message: 'Clue-2 combination feasibility pruned invalid edge patterns and tightened sector masks.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

export const createSectorClueOneThreeIntraCellPropagationRule = (): Rule => ({
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

export const createVertexOnlyOneNonSectorBalanceRule = (): Rule => ({
  id: 'vertex-onlyone-non-sector-balance',
  name: 'Vertex onlyOne Non-Sector Balance',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedEdges = new Map<string, EdgeMark>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()
    let firstExample: string | null = null

    const { rows, cols } = puzzle

    for (let vr = 0; vr <= rows; vr += 1) {
      for (let vc = 0; vc <= cols; vc += 1) {
        const incident = getVertexIncidentEdges(vr, vc, rows, cols)
        if (incident.length === 0) {
          continue
        }

        const sectorACases: Array<{ row: number; col: number; corner: SectorCorner }> = [
          { row: vr - 1, col: vc - 1, corner: 'se' },
          { row: vr - 1, col: vc, corner: 'sw' },
          { row: vr, col: vc - 1, corner: 'ne' },
          { row: vr, col: vc, corner: 'nw' },
        ]

        for (const { row, col, corner } of sectorACases) {
          if (row < 0 || row >= rows || col < 0 || col >= cols) {
            continue
          }
          const sk = sectorKey(row, col, corner)
          const mask = puzzle.sectors[sk]?.constraintsMask ?? SECTOR_MASK_ALL
          if (sectorMaskSingleValue(mask) !== 1) {
            continue
          }

          const sectorEdges = getCornerEdgeKeys(row, col, corner)
          const nonSectorEdges = incident.filter((e) => !sectorEdges.includes(e))
          if (nonSectorEdges.length === 1) {
            const forcedEdge = nonSectorEdges[0]
            if ((puzzle.edges[forcedEdge]?.mark ?? 'unknown') !== 'unknown') {
              continue
            }
            if (!decidedEdges.has(forcedEdge)) {
              decidedEdges.set(forcedEdge, 'line')
              affectedCells.add(cellKey(row, col))
              affectedSectors.add(sk)
              if (firstExample === null) firstExample = `(${vr}, ${vc})`
            }
            continue
          }

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

export const createSectorConstraintEdgePropagationRule = (): Rule => ({
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

export const createSectorNotOneClueTwoPropagationRule = (): Rule => ({
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
