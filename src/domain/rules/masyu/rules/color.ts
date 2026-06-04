import { parseCellKey, parseTileKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  createMasyuLineDecisionCollector,
  createMasyuTileDecisionCollector,
} from './decisionCollector'
import { formatMasyuCellKeyLabel, formatMasyuLineLabel } from './shared'
import {
  buildMasyuTileParityGraph,
  getMasyuLineTileRelation,
  isMasyuTileColor,
  oppositeMasyuTileColor,
} from './tileParity'

export {
  getMasyuLineTileRelation,
  isMasyuTileColor,
  oppositeMasyuTileColor,
  type MasyuTileColor,
} from './tileParity'

export const formatMasyuTileKeyLabel = (key: string): string => {
  const [row, col] = parseTileKey(key)
  return `T(${row}, ${col})`
}

export const createMasyuColorLinePropagationRule = (): Rule => ({
  id: 'masyu-color-line-propagation',
  name: 'Masyu Color-Line Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedLines = new Set<string>()
    const affectedTiles = new Set<string>()
    let firstReason: string | null = null

    for (const [lineKeyValue, lineState] of Object.entries(
      puzzle.lines ?? {},
    )) {
      if ((lineState?.mark ?? 'unknown') !== 'unknown') {
        continue
      }

      const relation = getMasyuLineTileRelation(puzzle, lineKeyValue)
      if (!relation) {
        continue
      }

      const leftColor = puzzle.tiles[relation.leftTile]?.fill
      const rightColor = puzzle.tiles[relation.rightTile]?.fill
      if (!isMasyuTileColor(leftColor) || !isMasyuTileColor(rightColor)) {
        continue
      }

      const to: LineMark = leftColor === rightColor ? 'blank' : 'line'
      decisions.add(lineKeyValue, to)
      affectedLines.add(lineKeyValue)
      affectedTiles.add(relation.leftTile)
      affectedTiles.add(relation.rightTile)
      firstReason ??=
        to === 'line'
          ? `${formatMasyuTileKeyLabel(relation.leftTile)} and ${formatMasyuTileKeyLabel(relation.rightTile)} have different colors, so ${formatMasyuLineLabel(lineKeyValue)} must be a line`
          : `${formatMasyuTileKeyLabel(relation.leftTile)} and ${formatMasyuTileKeyLabel(relation.rightTile)} have the same color, so ${formatMasyuLineLabel(lineKeyValue)} must be crossed out`
    }

    if (!decisions.hasChanges()) {
      return null
    }

    return {
      message: `${firstReason ?? 'Known Masyu tile colors decide separating line marks'} (${decisions.affectedLines().length} line update(s)).`,
      diffs: decisions.diffs(),
      affectedCells: [],
      affectedLines: [...affectedLines],
      affectedTiles: [...affectedTiles],
    }
  },
})

export const createMasyuColorPearlPropagationRule = (): Rule => ({
  id: 'masyu-color-pearl-propagation',
  name: 'Masyu Color-Pearl Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedTileFills = createMasyuTileDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    const affectedTiles = new Set<string>()
    let firstReason: string | null = null

    const inferOppositeDiagonal = (
      pearlKey: string,
      knownTile: string,
      oppositeTile: string,
    ): void => {
      const knownFill = puzzle.tiles[knownTile]?.fill
      if (!isMasyuTileColor(knownFill)) {
        return
      }
      const oppositeFill = puzzle.tiles[oppositeTile]?.fill
      if (isMasyuTileColor(oppositeFill)) {
        return
      }

      const toFill = oppositeMasyuTileColor(knownFill)
      if (!decidedTileFills.add(oppositeTile, toFill)) {
        return
      }
      affectedCells.add(pearlKey)
      affectedTiles.add(knownTile)
      affectedTiles.add(oppositeTile)
      firstReason ??=
        `White pearl ${formatMasyuCellKeyLabel(pearlKey)} is crossed straight, so diagonal tiles ` +
        `${formatMasyuTileKeyLabel(knownTile)} and ${formatMasyuTileKeyLabel(oppositeTile)} must have opposite colors`
    }

    for (const [key, cell] of Object.entries(puzzle.cells ?? {})) {
      if (cell.clue?.kind !== 'pearl' || cell.clue.color !== 'white') {
        continue
      }
      const [row, col] = parseCellKey(key)
      const nw = tileKey(row, col)
      const ne = tileKey(row, col + 1)
      const sw = tileKey(row + 1, col)
      const se = tileKey(row + 1, col + 1)

      inferOppositeDiagonal(key, nw, se)
      inferOppositeDiagonal(key, se, nw)
      inferOppositeDiagonal(key, ne, sw)
      inferOppositeDiagonal(key, sw, ne)
    }

    if (!decidedTileFills.hasChanges()) {
      return null
    }

    const diffs = decidedTileFills.diffs()

    return {
      message: `${firstReason ?? 'White pearl diagonal tile colors force opposite colors'} (${diffs.length} tile update(s)).`,
      diffs,
      affectedCells: [...affectedCells],
      affectedTiles: [...affectedTiles],
    }
  },
})

export const createMasyuTileColorPropagationRule = (): Rule => ({
  id: 'masyu-tile-color-propagation',
  name: 'Masyu Tile Color Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const parityGraph = buildMasyuTileParityGraph(puzzle)
    const decidedTileFills = createMasyuTileDecisionCollector(puzzle)
    const affectedTiles = new Set<string>()
    let firstInferredTile: string | null = null

    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        const key = tileKey(row, col)
        const currentFill = puzzle.tiles[key]?.fill
        if (isMasyuTileColor(currentFill)) {
          continue
        }
        const inferredColor = parityGraph.getInferredColor(key)
        if (!inferredColor) {
          continue
        }
        decidedTileFills.add(key, inferredColor)
        affectedTiles.add(key)
        firstInferredTile ??= key
      }
    }

    if (!decidedTileFills.hasChanges()) {
      return null
    }

    const diffs = decidedTileFills.diffs()

    return {
      message: `Known Masyu lines and the exterior boundary color tile regions; ${firstInferredTile ? formatMasyuTileKeyLabel(firstInferredTile) : 'matching tiles'} and related tiles are yellow/green (${diffs.length} tile update(s)).`,
      diffs,
      affectedCells: [],
      affectedTiles: [...affectedTiles],
    }
  },
})
