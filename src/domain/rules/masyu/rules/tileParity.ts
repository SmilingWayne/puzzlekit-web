import { parseLineKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'

export type MasyuTileColor = 'green' | 'yellow'
export type MasyuTileParity = 0 | 1

export type MasyuTileParityConflict = {
  kind: 'relation' | 'anchor'
  source: string
  message: string
}

export type MasyuTileParityGraph = {
  find: (key: string) => { root: string; parity: MasyuTileParity }
  anchorColors: Map<string, MasyuTileColor>
  inconsistentRoots: Set<string>
  firstConflict: MasyuTileParityConflict | null
  getInferredColor: (key: string) => MasyuTileColor | null
}

export const isMasyuTileColor = (
  fill: string | undefined,
): fill is MasyuTileColor => fill === 'green' || fill === 'yellow'

export const oppositeMasyuTileColor = (fill: MasyuTileColor): MasyuTileColor =>
  fill === 'green' ? 'yellow' : 'green'

export const applyMasyuTileParity = (
  color: MasyuTileColor,
  parity: MasyuTileParity,
): MasyuTileColor => (parity === 0 ? color : oppositeMasyuTileColor(color))

export const isMasyuBoundaryTile = (
  puzzle: PuzzleIR,
  row: number,
  col: number,
): boolean =>
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

export const buildMasyuTileParityGraph = (
  puzzle: PuzzleIR,
): MasyuTileParityGraph => {
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()
  const parityToParent = new Map<string, MasyuTileParity>()
  const inconsistentRoots = new Set<string>()
  const anchorColors = new Map<string, MasyuTileColor>()
  let firstConflict: MasyuTileParityConflict | null = null

  const ensure = (key: string): void => {
    if (parent.has(key)) {
      return
    }
    parent.set(key, key)
    rank.set(key, 0)
    parityToParent.set(key, 0)
  }

  const find = (key: string): { root: string; parity: MasyuTileParity } => {
    ensure(key)
    const currentParent = parent.get(key)
    if (currentParent === undefined || currentParent === key) {
      return { root: key, parity: 0 }
    }
    const found = find(currentParent)
    const parity = ((parityToParent.get(key) ?? 0) ^
      found.parity) as MasyuTileParity
    parent.set(key, found.root)
    parityToParent.set(key, parity)
    return { root: found.root, parity }
  }

  const markInconsistent = (
    root: string,
    conflict: MasyuTileParityConflict,
  ): void => {
    inconsistentRoots.add(find(root).root)
    firstConflict ??= conflict
  }

  const union = (
    left: string,
    right: string,
    relation: MasyuTileParity,
    source: string,
  ): void => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot.root === rightRoot.root) {
      if ((leftRoot.parity ^ rightRoot.parity) !== relation) {
        markInconsistent(leftRoot.root, {
          kind: 'relation',
          source,
          message: 'line/tile parity requirements conflict',
        })
      }
      return
    }

    const mergedParity = (leftRoot.parity ^
      rightRoot.parity ^
      relation) as MasyuTileParity
    const leftRank = rank.get(leftRoot.root) ?? 0
    const rightRank = rank.get(rightRoot.root) ?? 0
    const leftInconsistent = inconsistentRoots.delete(leftRoot.root)
    const rightInconsistent = inconsistentRoots.delete(rightRoot.root)

    if (leftRank < rightRank) {
      parent.set(leftRoot.root, rightRoot.root)
      parityToParent.set(leftRoot.root, mergedParity)
      if (leftInconsistent || rightInconsistent) {
        inconsistentRoots.add(rightRoot.root)
      }
      return
    }

    parent.set(rightRoot.root, leftRoot.root)
    parityToParent.set(rightRoot.root, mergedParity)
    if (leftRank === rightRank) {
      rank.set(leftRoot.root, leftRank + 1)
    }
    if (leftInconsistent || rightInconsistent) {
      inconsistentRoots.add(leftRoot.root)
    }
  }

  const rememberAnchor = (key: string, color: MasyuTileColor): void => {
    const { root, parity } = find(key)
    const rootColor = applyMasyuTileParity(color, parity)
    const current = anchorColors.get(root)
    if (current !== undefined && current !== rootColor) {
      markInconsistent(root, {
        kind: 'anchor',
        source: key,
        message: `fixed Masyu tile colors require both ${current} and ${rootColor}`,
      })
      return
    }
    anchorColors.set(root, rootColor)
  }

  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      ensure(tileKey(row, col))
    }
  }

  for (const [lineKeyValue, line] of Object.entries(puzzle.lines)) {
    const mark: LineMark = line?.mark ?? 'unknown'
    if (mark !== 'line' && mark !== 'blank') {
      continue
    }
    const relation = getMasyuLineTileRelation(puzzle, lineKeyValue)
    if (relation) {
      union(
        relation.leftTile,
        relation.rightTile,
        mark === 'line' ? 1 : 0,
        lineKeyValue,
      )
    }
  }

  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      if (isMasyuBoundaryTile(puzzle, row, col)) {
        rememberAnchor(tileKey(row, col), 'yellow')
      }
    }
  }

  for (const [key, tile] of Object.entries(puzzle.tiles ?? {})) {
    if (isMasyuTileColor(tile.fill)) {
      rememberAnchor(key, tile.fill)
    }
  }

  return {
    find,
    anchorColors,
    inconsistentRoots,
    get firstConflict() {
      return firstConflict
    },
    getInferredColor: (key: string): MasyuTileColor | null => {
      const { root, parity } = find(key)
      if (inconsistentRoots.has(root)) {
        return null
      }
      const rootColor = anchorColors.get(root)
      return rootColor === undefined
        ? null
        : applyMasyuTileParity(rootColor, parity)
    },
  }
}
