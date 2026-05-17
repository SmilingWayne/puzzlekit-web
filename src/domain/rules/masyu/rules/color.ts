import { parseLineKey, parseTileKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { buildMasyuLineDiffs, formatMasyuLineLabel } from './shared'

export type MasyuTileColor = 'green' | 'yellow'

type Parity = 0 | 1

export const isMasyuTileColor = (fill: string | undefined): fill is MasyuTileColor =>
  fill === 'green' || fill === 'yellow'

export const oppositeMasyuTileColor = (fill: MasyuTileColor): MasyuTileColor =>
  fill === 'green' ? 'yellow' : 'green'

export const formatMasyuTileKeyLabel = (key: string): string => {
  const [row, col] = parseTileKey(key)
  return `T(${row}, ${col})`
}

const applyParity = (color: MasyuTileColor, parity: Parity): MasyuTileColor =>
  parity === 0 ? color : oppositeMasyuTileColor(color)

const isBoundaryTile = (puzzle: PuzzleIR, row: number, col: number): boolean =>
  row === 0 || row === puzzle.rows || col === 0 || col === puzzle.cols

export const getMasyuLineTileRelation = (
  puzzle: PuzzleIR,
  lineKeyValue: string,
): { leftTile: string; rightTile: string } | null => {
  const [left, right] = parseLineKey(lineKeyValue)
  if (left[0] === right[0] && Math.abs(left[1] - right[1]) === 1) {
    const row = left[0]
    const col = Math.min(left[1], right[1])
    if (row < 0 || row >= puzzle.rows || col < 0 || col >= puzzle.cols - 1) {
      return null
    }
    return {
      leftTile: tileKey(row, col + 1),
      rightTile: tileKey(row + 1, col + 1),
    }
  }
  if (left[1] === right[1] && Math.abs(left[0] - right[0]) === 1) {
    const row = Math.min(left[0], right[0])
    const col = left[1]
    if (row < 0 || row >= puzzle.rows - 1 || col < 0 || col >= puzzle.cols) {
      return null
    }
    return {
      leftTile: tileKey(row + 1, col),
      rightTile: tileKey(row + 1, col + 1),
    }
  }
  return null
}

export const createMasyuColorLinePropagationRule = (): Rule => ({
  id: 'masyu-color-line-propagation',
  name: 'Masyu Color-Line Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = new Map<string, LineMark>()
    const affectedLines = new Set<string>()
    const affectedTiles = new Set<string>()
    let firstReason: string | null = null

    for (const [lineKeyValue, lineState] of Object.entries(puzzle.lines ?? {})) {
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
      decisions.set(lineKeyValue, to)
      affectedLines.add(lineKeyValue)
      affectedTiles.add(relation.leftTile)
      affectedTiles.add(relation.rightTile)
      firstReason ??=
        to === 'line'
          ? `${formatMasyuTileKeyLabel(relation.leftTile)} and ${formatMasyuTileKeyLabel(relation.rightTile)} have different colors, so ${formatMasyuLineLabel(lineKeyValue)} must be a line`
          : `${formatMasyuTileKeyLabel(relation.leftTile)} and ${formatMasyuTileKeyLabel(relation.rightTile)} have the same color, so ${formatMasyuLineLabel(lineKeyValue)} must be crossed out`
    }

    if (decisions.size === 0) {
      return null
    }

    return {
      message: `${firstReason ?? 'Known Masyu tile colors decide separating line marks'} (${decisions.size} line update(s)).`,
      diffs: buildMasyuLineDiffs(decisions, puzzle),
      affectedCells: [],
      affectedLines: [...affectedLines],
      affectedTiles: [...affectedTiles],
    }
  },
})

export const createMasyuTileColorPropagationRule = (): Rule => ({
  id: 'masyu-tile-color-propagation',
  name: 'Masyu Tile Color Propagation',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const parent = new Map<string, string>()
    const rank = new Map<string, number>()
    const parityToParent = new Map<string, Parity>()
    const inconsistentRoots = new Set<string>()

    const ensureTile = (key: string): void => {
      if (parent.has(key)) {
        return
      }
      parent.set(key, key)
      rank.set(key, 0)
      parityToParent.set(key, 0)
    }

    const find = (key: string): { root: string; parity: Parity } => {
      ensureTile(key)
      const currentParent = parent.get(key)
      if (currentParent === undefined || currentParent === key) {
        return { root: key, parity: 0 }
      }
      const parentResult = find(currentParent)
      const compressedParity = ((parityToParent.get(key) ?? 0) ^ parentResult.parity) as Parity
      parent.set(key, parentResult.root)
      parityToParent.set(key, compressedParity)
      return { root: parentResult.root, parity: compressedParity }
    }

    const markInconsistent = (root: string): void => {
      inconsistentRoots.add(find(root).root)
    }

    const union = (tileA: string, tileB: string, relation: Parity): void => {
      const rootA = find(tileA)
      const rootB = find(tileB)
      if (rootA.root === rootB.root) {
        if ((rootA.parity ^ rootB.parity) !== relation) {
          markInconsistent(rootA.root)
        }
        return
      }

      const mergedParity = (rootA.parity ^ rootB.parity ^ relation) as Parity
      const rankA = rank.get(rootA.root) ?? 0
      const rankB = rank.get(rootB.root) ?? 0
      const rootAWasInconsistent = inconsistentRoots.delete(rootA.root)
      const rootBWasInconsistent = inconsistentRoots.delete(rootB.root)

      if (rankA < rankB) {
        parent.set(rootA.root, rootB.root)
        parityToParent.set(rootA.root, mergedParity)
        if (rootAWasInconsistent || rootBWasInconsistent) {
          inconsistentRoots.add(rootB.root)
        }
        return
      }

      parent.set(rootB.root, rootA.root)
      parityToParent.set(rootB.root, mergedParity)
      if (rankA === rankB) {
        rank.set(rootA.root, rankA + 1)
      }
      if (rootAWasInconsistent || rootBWasInconsistent) {
        inconsistentRoots.add(rootA.root)
      }
    }

    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        ensureTile(tileKey(row, col))
      }
    }

    for (const [lineKeyValue, lineState] of Object.entries(puzzle.lines ?? {})) {
      const mark: LineMark = lineState?.mark ?? 'unknown'
      if (mark !== 'line' && mark !== 'blank') {
        continue
      }
      const relation = getMasyuLineTileRelation(puzzle, lineKeyValue)
      if (!relation) {
        continue
      }
      union(relation.leftTile, relation.rightTile, mark === 'line' ? 1 : 0)
    }

    const anchoredRootColors = new Map<string, MasyuTileColor>()
    const rememberAnchor = (key: string, color: MasyuTileColor): void => {
      const { root, parity } = find(key)
      const rootColor = applyParity(color, parity)
      const current = anchoredRootColors.get(root)
      if (current !== undefined && current !== rootColor) {
        markInconsistent(root)
        return
      }
      anchoredRootColors.set(root, rootColor)
    }

    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        if (isBoundaryTile(puzzle, row, col)) {
          rememberAnchor(tileKey(row, col), 'yellow')
        }
      }
    }

    for (const [key, tile] of Object.entries(puzzle.tiles ?? {})) {
      if (isMasyuTileColor(tile.fill)) {
        rememberAnchor(key, tile.fill)
      }
    }

    const decidedTileFills = new Map<string, MasyuTileColor>()
    const affectedTiles = new Set<string>()
    let firstInferredTile: string | null = null

    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        const key = tileKey(row, col)
        const currentFill = puzzle.tiles[key]?.fill
        if (isMasyuTileColor(currentFill)) {
          continue
        }
        const { root, parity } = find(key)
        if (inconsistentRoots.has(root)) {
          continue
        }
        const rootColor = anchoredRootColors.get(root)
        if (rootColor === undefined) {
          continue
        }
        const inferredColor = applyParity(rootColor, parity)
        decidedTileFills.set(key, inferredColor)
        affectedTiles.add(key)
        firstInferredTile ??= key
      }
    }

    if (decidedTileFills.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = [...decidedTileFills.entries()].map(([key, toFill]) => ({
      kind: 'tile' as const,
      tileKey: key,
      fromFill: (puzzle.tiles[key]?.fill ?? null) as string | null,
      toFill,
    }))

    return {
      message: `Known Masyu lines and the exterior boundary color tile regions; ${firstInferredTile ? formatMasyuTileKeyLabel(firstInferredTile) : 'matching tiles'} and related tiles are yellow/green (${diffs.length} tile update(s)).`,
      diffs,
      affectedCells: [],
      affectedTiles: [...affectedTiles],
    }
  },
})
