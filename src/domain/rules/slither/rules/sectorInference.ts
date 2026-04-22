import {
  cellKey,
  getCellEdgeKeys,
  getCornerEdgeKeys,
  getCornerVertex,
  getVertexIncidentEdges,
  sectorKey,
} from '../../../ir/keys'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_NOT_0,
  SECTOR_MASK_NOT_1,
  SECTOR_MASK_NOT_2,
  SECTOR_MASK_ONLY_1,
  type PuzzleIR,
  type SectorConstraintMask,
  type SectorCorner,
  sectorMaskIntersect,
} from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { maskForExactLineCount } from './shared'

const inferSectorMaskByVertex = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
  corner: SectorCorner,
): SectorConstraintMask => {
  const vertex = getCornerVertex(row, col, corner)
  const incidentEdges = getVertexIncidentEdges(vertex[0], vertex[1], puzzle.rows, puzzle.cols)
  const cellEdges = getCellEdgeKeys(row, col)
  const sectorEdges = getCornerEdgeKeys(row, col, corner)
  let mask = SECTOR_MASK_ALL
  const tighten = (constraint: SectorConstraintMask): void => {
    mask = sectorMaskIntersect(mask, constraint)
  }

  const secLineNum = sectorEdges.filter((e) => puzzle.edges[e]?.mark === 'line').length
  const secCrossNum = sectorEdges.filter((e) => puzzle.edges[e]?.mark === 'blank').length
  if (secLineNum + secCrossNum === 2) {
    tighten(maskForExactLineCount(secLineNum))
  }

  const nonSectorEdges = incidentEdges.filter((e) => !sectorEdges.includes(e))
  const diagSectorEdges = cellEdges.filter((e) => !sectorEdges.includes(e))

  const nonSecLineNum = nonSectorEdges.filter((e) => puzzle.edges[e]?.mark === 'line').length
  const nonSecCrossNum = nonSectorEdges.filter((e) => puzzle.edges[e]?.mark === 'blank').length
  const diagSecLineNum = diagSectorEdges.filter((e) => puzzle.edges[e]?.mark === 'line').length
  const diagSecCrossNum = diagSectorEdges.filter((e) => puzzle.edges[e]?.mark === 'blank').length

  const nonSecKnownNum = nonSecLineNum + nonSecCrossNum
  const vertexDegree = incidentEdges.length
  const sectorKnownNum = secLineNum + secCrossNum
  const remainingUnknowns = vertexDegree - nonSecKnownNum - sectorKnownNum
  const sectorUnknownNum = 2 - sectorKnownNum

  if (nonSecLineNum === 1 && remainingUnknowns === sectorUnknownNum && sectorUnknownNum > 0) {
    tighten(SECTOR_MASK_ONLY_1)
  }
  if (nonSecLineNum === 2) {
    tighten(maskForExactLineCount(0))
  }
  if (nonSecCrossNum === 2) {
    tighten(SECTOR_MASK_NOT_1)
  }

  const clue = puzzle.cells[cellKey(row, col)]?.clue
  const clueValue = clue?.kind === 'number' && clue.value !== '?' ? Number(clue.value) : null
  if (clueValue !== null) {
    const edgeKeys = getCellEdgeKeys(row, col)
    const stats = edgeKeys.reduce(
      (acc, key) => {
        const mark = puzzle.edges[key]?.mark ?? 'unknown'
        if (mark === 'line') acc.lineNum += 1
        else if (mark === 'blank') acc.crossNum += 1
        else acc.unknownNum += 1
        return acc
      },
      { lineNum: 0, crossNum: 0, unknownNum: 0 },
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

  if (secCrossNum === 1) {
    tighten(SECTOR_MASK_NOT_2)
  }
  return mask
}

export const createApplySectorsInference = (): Rule => ({
  id: 'sector-inference',
  name: 'Apply Vertex Flow Sector Inference',
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
  },
})
