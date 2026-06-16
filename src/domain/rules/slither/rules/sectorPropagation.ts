import { cellKey, getCellEdgeKeys, getCornerEdgeKeys, getVertexIncidentEdges, sectorKey, vertexKey } from '../../../ir/keys'
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
  type VertexCandidate,
} from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { formatCellLabel, formatSectorLabel, formatVertexLabel } from './shared'

const CORNERS: SectorCorner[] = ['nw', 'ne', 'sw', 'se']

const cornerVertices = (row: number, col: number): Array<{ corner: SectorCorner; vertexKey: string }> => [
  { corner: 'nw', vertexKey: vertexKey(row, col) },
  { corner: 'ne', vertexKey: vertexKey(row, col + 1) },
  { corner: 'sw', vertexKey: vertexKey(row + 1, col) },
  { corner: 'se', vertexKey: vertexKey(row + 1, col + 1) },
]

const maskForAllowedCounts = (counts: Set<number>): SectorConstraintMask => {
  let mask: SectorConstraintMask = 0
  if (counts.has(0)) mask |= SECTOR_ALLOW_0
  if (counts.has(1)) mask |= SECTOR_ALLOW_1
  if (counts.has(2)) mask |= SECTOR_ALLOW_2
  return mask
}

const candidateId = (candidate: VertexCandidate): string => candidate.join('|')

const normalizeCandidate = (candidate: VertexCandidate): VertexCandidate => [...candidate].sort()

const normalizeCandidates = (candidates: VertexCandidate[]): VertexCandidate[] => {
  const unique = new Map<string, VertexCandidate>()
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate)
    unique.set(candidateId(normalized), normalized)
  }
  return [...unique.values()].sort((a, b) => a.length - b.length || candidateId(a).localeCompare(candidateId(b)))
}

const createInitialVertexCandidates = (
  row: number,
  col: number,
  rows: number,
  cols: number,
): VertexCandidate[] => {
  const incident = getVertexIncidentEdges(row, col, rows, cols)
  const candidates: VertexCandidate[] = [[]]
  for (let i = 0; i < incident.length; i += 1) {
    for (let j = i + 1; j < incident.length; j += 1) {
      candidates.push([incident[i], incident[j]])
    }
  }
  return normalizeCandidates(candidates)
}

const getVertexCandidates = (
  puzzle: PuzzleIR,
  key: string,
  row: number,
  col: number,
): VertexCandidate[] => {
  const stored = puzzle.vertices?.[key]?.candidateEdgeSets
  if (stored) {
    return normalizeCandidates(stored)
  }
  return createInitialVertexCandidates(row, col, puzzle.rows, puzzle.cols)
}

const sameCandidates = (a: VertexCandidate[], b: VertexCandidate[]): boolean =>
  JSON.stringify(normalizeCandidates(a)) === JSON.stringify(normalizeCandidates(b))

const candidateContains = (candidate: VertexCandidate, edgeKeyValue: string): boolean =>
  candidate.includes(edgeKeyValue)

const addEdgeDecision = (
  decidedEdges: Map<string, EdgeMark>,
  puzzle: PuzzleIR,
  edgeKeyValue: string,
  toMark: EdgeMark,
): void => {
  const current = puzzle.edges[edgeKeyValue]?.mark ?? 'unknown'
  if (current !== 'unknown' || decidedEdges.has(edgeKeyValue)) {
    return
  }
  decidedEdges.set(edgeKeyValue, toMark)
}

const addVertexDiff = (
  diffs: RuleApplication['diffs'],
  key: string,
  fromCandidates: VertexCandidate[],
  toCandidates: VertexCandidate[],
): void => {
  if (sameCandidates(fromCandidates, toCandidates)) {
    return
  }
  diffs.push({
    kind: 'vertex',
    vertexKey: key,
    fromCandidates: normalizeCandidates(fromCandidates),
    toCandidates: normalizeCandidates(toCandidates),
  })
}

export const createVertexCandidateEdgePruningRule = (): Rule => ({
  id: 'vertex-candidate-edge-pruning',
  name: 'Vertex Candidate Pruning',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const diffs: RuleApplication['diffs'] = []
    const decidedEdges = new Map<string, EdgeMark>()

    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        const key = vertexKey(row, col)
        const incident = getVertexIncidentEdges(row, col, puzzle.rows, puzzle.cols)
        const currentCandidates = getVertexCandidates(puzzle, key, row, col)
        let nextCandidates = currentCandidates.filter((candidate) =>
          candidate.every((edgeKeyValue) => (puzzle.edges[edgeKeyValue]?.mark ?? 'unknown') !== 'blank'),
        )

        for (const edgeKeyValue of incident) {
          if ((puzzle.edges[edgeKeyValue]?.mark ?? 'unknown') === 'line') {
            nextCandidates = nextCandidates.filter((candidate) => candidateContains(candidate, edgeKeyValue))
          }
        }

        addVertexDiff(diffs, key, currentCandidates, nextCandidates)

        if (nextCandidates.length === 0) {
          continue
        }

        for (const edgeKeyValue of incident) {
          if (nextCandidates.every((candidate) => candidateContains(candidate, edgeKeyValue))) {
            addEdgeDecision(decidedEdges, puzzle, edgeKeyValue, 'line')
          }
          if (nextCandidates.every((candidate) => !candidateContains(candidate, edgeKeyValue))) {
            addEdgeDecision(decidedEdges, puzzle, edgeKeyValue, 'blank')
          }
        }
      }
    }

    for (const [edgeKeyValue, to] of decidedEdges.entries()) {
      diffs.push({ kind: 'edge', edgeKey: edgeKeyValue, from: 'unknown', to })
    }

    if (diffs.length === 0) {
      return null
    }

    return {
      message:
        'Impossible degree states were removed at one or more vertices, and edges agreed on by every remaining candidate were decided.',
      diffs,
      affectedCells: [],
    }
  },
})

type CornerCandidateTuple = [VertexCandidate, VertexCandidate, VertexCandidate, VertexCandidate]

const candidateForCorner = (
  candidatesByCorner: Record<SectorCorner, VertexCandidate[]>,
  corner: SectorCorner,
): VertexCandidate[] => candidatesByCorner[corner]

const cellEdgeLineCount = (
  cellEdges: string[],
  candidates: CornerCandidateTuple,
): number => cellEdges.filter((edgeKeyValue) => candidates.some((candidate) => candidateContains(candidate, edgeKeyValue))).length

const isCellEdgeConsistent = (
  edgeKeyValue: string,
  candidateA: VertexCandidate,
  candidateB: VertexCandidate,
): boolean => candidateContains(candidateA, edgeKeyValue) === candidateContains(candidateB, edgeKeyValue)

const cornerLineCountFromCandidates = (
  cornerEdges: [string, string],
  candidate: VertexCandidate,
): SectorLineCount =>
  cornerEdges.filter((edgeKeyValue) => candidateContains(candidate, edgeKeyValue)).length as SectorLineCount

export const createClueVertexCandidateCombinationPruningRule = (): Rule => ({
  id: 'clue-vertex-candidate-combination-pruning',
  name: 'Clue Combination Pruning',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const diffs: RuleApplication['diffs'] = []
    const nextVertexCandidates = new Map<string, VertexCandidate[]>()
    const nextSectorMasks = new Map<string, SectorConstraintMask>()
    const affectedCells = new Set<string>()
    const affectedSectors = new Set<string>()

    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const clue = puzzle.cells[cellKey(row, col)]?.clue
        if (clue?.kind !== 'number' || clue.value === '?') {
          continue
        }

        const targetLineCount = Number(clue.value)
        const [topEdge, bottomEdge, leftEdge, rightEdge] = getCellEdgeKeys(row, col)
        const cellEdges = [topEdge, bottomEdge, leftEdge, rightEdge]
        const vertices = cornerVertices(row, col)
        const candidatesByCorner = vertices.reduce<Record<SectorCorner, VertexCandidate[]>>((acc, vertex) => {
          const [vertexRow, vertexCol] = vertex.vertexKey.split(',').map(Number)
          acc[vertex.corner] =
            nextVertexCandidates.get(vertex.vertexKey) ??
            getVertexCandidates(puzzle, vertex.vertexKey, vertexRow, vertexCol)
          return acc
        }, {} as Record<SectorCorner, VertexCandidate[]>)

        const supportedByCorner: Record<SectorCorner, Map<string, VertexCandidate>> = {
          nw: new Map(),
          ne: new Map(),
          sw: new Map(),
          se: new Map(),
        }
        const sectorCounts: Record<SectorCorner, Set<number>> = {
          nw: new Set(),
          ne: new Set(),
          sw: new Set(),
          se: new Set(),
        }
        let survivingCombinations = 0

        for (const nw of candidateForCorner(candidatesByCorner, 'nw')) {
          const partialNwCount = cellEdges.filter((edgeKeyValue) => candidateContains(nw, edgeKeyValue)).length
          if (partialNwCount > targetLineCount || 2 - partialNwCount > 4 - targetLineCount) continue

          for (const ne of candidateForCorner(candidatesByCorner, 'ne')) {
            if (!isCellEdgeConsistent(topEdge, nw, ne)) continue
            const partialTopCount = cellEdges.filter((edgeKeyValue) =>
              [nw, ne].some((candidate) => candidateContains(candidate, edgeKeyValue)),
            ).length
            if (partialTopCount > targetLineCount || 3 - partialTopCount > 4 - targetLineCount) continue

            for (const sw of candidateForCorner(candidatesByCorner, 'sw')) {
              if (!isCellEdgeConsistent(leftEdge, nw, sw)) continue

              for (const se of candidateForCorner(candidatesByCorner, 'se')) {
                if (!isCellEdgeConsistent(bottomEdge, sw, se)) continue
                if (!isCellEdgeConsistent(rightEdge, ne, se)) continue

                const tuple: CornerCandidateTuple = [nw, ne, sw, se]
                if (cellEdgeLineCount(cellEdges, tuple) !== targetLineCount) continue

                const candidatesByName: Record<SectorCorner, VertexCandidate> = { nw, ne, sw, se }
                let sectorMasksAllowCombination = true
                for (const corner of CORNERS) {
                  const lineCount = cornerLineCountFromCandidates(getCornerEdgeKeys(row, col, corner), candidatesByName[corner])
                  const currentMask = puzzle.sectors[sectorKey(row, col, corner)]?.constraintsMask ?? SECTOR_MASK_ALL
                  if (!sectorMaskAllows(currentMask, lineCount)) {
                    sectorMasksAllowCombination = false
                    break
                  }
                }
                if (!sectorMasksAllowCombination) continue

                survivingCombinations += 1
                for (const corner of CORNERS) {
                  const candidate = candidatesByName[corner]
                  supportedByCorner[corner].set(candidateId(candidate), candidate)
                  sectorCounts[corner].add(
                    cornerLineCountFromCandidates(getCornerEdgeKeys(row, col, corner), candidate),
                  )
                }
              }
            }
          }
        }

        if (survivingCombinations === 0) {
          continue
        }

        for (const vertex of vertices) {
          const currentCandidates = candidatesByCorner[vertex.corner]
          const supportedCandidates = normalizeCandidates([...supportedByCorner[vertex.corner].values()])
          const existing = nextVertexCandidates.get(vertex.vertexKey) ?? currentCandidates
          const narrowed = normalizeCandidates(
            existing.filter((candidate) => supportedByCorner[vertex.corner].has(candidateId(candidate))),
          )
          if (!sameCandidates(existing, narrowed)) {
            nextVertexCandidates.set(vertex.vertexKey, narrowed)
            affectedCells.add(cellKey(row, col))
          } else if (!sameCandidates(currentCandidates, supportedCandidates)) {
            affectedCells.add(cellKey(row, col))
          }
        }

        for (const corner of CORNERS) {
          const counts = sectorCounts[corner]
          if (counts.size === 0) {
            continue
          }
          const key = sectorKey(row, col, corner)
          const currentMask = nextSectorMasks.get(key) ?? (puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL)
          const narrowedMask = sectorMaskIntersect(currentMask, maskForAllowedCounts(counts))
          if (narrowedMask === 0 || narrowedMask === currentMask) {
            continue
          }
          nextSectorMasks.set(key, narrowedMask)
          affectedCells.add(cellKey(row, col))
          affectedSectors.add(key)
        }
      }
    }

    for (const [key, toCandidates] of nextVertexCandidates.entries()) {
      const [row, col] = key.split(',').map(Number)
      const fromCandidates = getVertexCandidates(puzzle, key, row, col)
      addVertexDiff(diffs, key, fromCandidates, toCandidates)
    }

    for (const [key, toMask] of nextSectorMasks.entries()) {
      const fromMask = puzzle.sectors[key]?.constraintsMask ?? SECTOR_MASK_ALL
      if (fromMask === toMask) continue
      diffs.push({ kind: 'sector', sectorKey: key, fromMask, toMask })
    }

    if (diffs.length === 0) {
      return null
    }

    return {
      message:
        'Only clue-compatible four-corner combinations survive, so unsupported vertex candidates and sector counts are removed.',
      diffs,
      affectedCells: [...affectedCells],
      affectedSectors: [...affectedSectors],
    }
  },
})

export const createSectorDiagonalSharedVertexPropagationRule = (): Rule => ({
  id: 'sector-diagonal-shared-vertex-propagation',
  name: 'Diagonal Sector Propagation',
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
      message:
        'Diagonal sectors sharing a vertex must agree on compatible corner counts, so the opposite sector constraint is narrowed.',
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
    let firstReason: string | null = null

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
              if (firstExample === null) {
                firstExample = formatSectorLabel(r, c, corner)
                firstReason =
                  clueValue === 1
                    ? 'this clue-1 sector already has exactly one line, so the opposite cell edges are blank'
                    : 'this clue-3 sector already has exactly one line, so the opposite cell edges must be lines'
              }
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
          ? `Sector ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: ${firstReason}.`
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
    let firstReason: string | null = null

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
              if (firstExample === null) {
                firstExample = formatVertexLabel(vr, vc)
                firstReason = 'an exactly-one sector uses one line at this vertex, so the only outside edge must complete degree 2'
              }
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
            if (firstExample === null) {
              firstExample = formatVertexLabel(vr, vc)
              firstReason =
                toMark === 'line'
                  ? 'the outside sector balance needs one more line at this vertex'
                  : 'the outside sector balance already has its needed line, so the other outside edge is blank'
            }
          }
        }
      }
    }

    if (decidedEdges.size === 0) return null

    return {
      message:
        firstExample !== null
          ? `Vertex ${firstExample}: ${firstReason}.`
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
    let firstReason: string | null = null

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
          let reason: string | null = null

          if (mask === SECTOR_MASK_ONLY_2) {
            toMark = 'line'
            edgesToDecide = unknownEdges
            reason = 'the sector must contain two lines, so every unknown sector edge is a line'
          } else if (mask === SECTOR_MASK_ONLY_0) {
            toMark = 'blank'
            edgesToDecide = unknownEdges
            reason = 'the sector must contain zero lines, so every unknown sector edge is blank'
          } else if (mask === SECTOR_MASK_ONLY_1) {
            if (lineCount === 1 && blankCount === 0 && unknownEdges.length === 1) {
              toMark = 'blank'
              edgesToDecide = [unknownEdges[0]]
              reason = 'the sector already has its one line, so the remaining sector edge is blank'
            } else if (blankCount === 1 && lineCount === 0 && unknownEdges.length === 1) {
              toMark = 'line'
              edgesToDecide = [unknownEdges[0]]
              reason = 'the sector needs exactly one line, so the remaining sector edge is a line'
            }
          } else if (mask === SECTOR_MASK_NOT_1) {
            if (lineCount === 1 && blankCount === 0 && unknownEdges.length === 1) {
              toMark = 'line'
              edgesToDecide = [unknownEdges[0]]
              reason = 'the sector cannot have exactly one line, so the remaining sector edge is also a line'
            } else if (blankCount === 1 && lineCount === 0 && unknownEdges.length === 1) {
              toMark = 'blank'
              edgesToDecide = [unknownEdges[0]]
              reason = 'the sector cannot have exactly one line, so the remaining sector edge is also blank'
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
            if (firstExample === null) {
              firstExample = formatSectorLabel(r, c, corner)
              firstReason = reason
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
          ? `Sector ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: ${firstReason}.`
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
          if (firstExample === null) firstExample = formatCellLabel(r, c)
        }
      }
    }

    if (decidedEdges.size === 0) return null

    const extra = affectedCells.size - 1
    return {
      message:
        firstExample !== null
          ? `Cell ${firstExample}${extra > 0 ? ` and ${extra} other(s)` : ''}: with clue 2, a not-one sector opposite an existing line cannot take any line, so its edges are blank.`
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
