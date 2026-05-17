import { lineKey, parseTileKey, tileKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  formatMasyuTileKeyLabel,
  isMasyuTileColor,
  oppositeMasyuTileColor,
  type MasyuTileColor,
} from './color'

const OUTSIDE_COMPONENT = '__outside__'

type TileAdjacency = {
  left: string
  right: string
  separatorLine: string | null
}

type ConnectivityCutPassOptions = {
  target: MasyuTileColor
  includeOutsideSource: boolean
  getEffectiveTileColor: (key: string) => MasyuTileColor | null
}

type ConnectivityColorReason = 'cut' | 'unreachable'

type ConnectivityTileColorUpdate = {
  tileKey: string
  toFill: MasyuTileColor
  reason: ConnectivityColorReason
}

const isBoundaryTileKey = (puzzle: PuzzleIR, key: string): boolean => {
  const [row, col] = parseTileKey(key)
  return row === 0 || row === puzzle.rows || col === 0 || col === puzzle.cols
}

const getTileAdjacencies = (puzzle: PuzzleIR): TileAdjacency[] => {
  const adjacencies: TileAdjacency[] = []

  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const separatorLine =
        row > 0 && row < puzzle.rows ? lineKey([row - 1, col], [row, col]) : null
      adjacencies.push({
        left: tileKey(row, col),
        right: tileKey(row, col + 1),
        separatorLine,
      })
    }
  }

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      const separatorLine =
        col > 0 && col < puzzle.cols ? lineKey([row, col - 1], [row, col]) : null
      adjacencies.push({
        left: tileKey(row, col),
        right: tileKey(row + 1, col),
        separatorLine,
      })
    }
  }

  return adjacencies
}

const getSeparatorMark = (puzzle: PuzzleIR, adjacency: TileAdjacency): LineMark | 'permanent-blank' => {
  if (adjacency.separatorLine === null) {
    return 'permanent-blank'
  }
  return puzzle.lines[adjacency.separatorLine]?.mark ?? 'unknown'
}

const findConnectivityTileColorUpdates = (
  puzzle: PuzzleIR,
  { target, includeOutsideSource, getEffectiveTileColor }: ConnectivityCutPassOptions,
): ConnectivityTileColorUpdate[] => {
  const blocked = oppositeMasyuTileColor(target)
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()

  const tileKeys: string[] = []
  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      tileKeys.push(tileKey(row, col))
    }
  }

  const isCandidateTile = (key: string): boolean => getEffectiveTileColor(key) !== blocked

  const ensureNode = (key: string): void => {
    if (parent.has(key)) {
      return
    }
    parent.set(key, key)
    rank.set(key, 0)
  }

  const find = (key: string): string => {
    ensureNode(key)
    const currentParent = parent.get(key)
    if (currentParent === undefined || currentParent === key) {
      return key
    }
    const root = find(currentParent)
    parent.set(key, root)
    return root
  }

  const union = (left: string, right: string): void => {
    const rootA = find(left)
    const rootB = find(right)
    if (rootA === rootB) {
      return
    }
    const rankA = rank.get(rootA) ?? 0
    const rankB = rank.get(rootB) ?? 0
    if (rankA < rankB) {
      parent.set(rootA, rootB)
      return
    }
    parent.set(rootB, rootA)
    if (rankA === rankB) {
      rank.set(rootA, rankA + 1)
    }
  }

  for (const key of tileKeys) {
    if (isCandidateTile(key)) {
      ensureNode(key)
    }
  }
  if (includeOutsideSource) {
    ensureNode(OUTSIDE_COMPONENT)
  }

  const adjacencies = getTileAdjacencies(puzzle)
  for (const adjacency of adjacencies) {
    const mark = getSeparatorMark(puzzle, adjacency)
    if (mark !== 'blank' && mark !== 'permanent-blank') {
      continue
    }
    if (!isCandidateTile(adjacency.left) || !isCandidateTile(adjacency.right)) {
      continue
    }
    union(adjacency.left, adjacency.right)
  }

  const componentTiles = new Map<string, string[]>()
  const sourceComponents = new Set<string>()
  for (const key of tileKeys) {
    if (!isCandidateTile(key)) {
      continue
    }
    const root = find(key)
    const tiles = componentTiles.get(root) ?? []
    tiles.push(key)
    componentTiles.set(root, tiles)
    if (getEffectiveTileColor(key) === target) {
      sourceComponents.add(root)
    }
  }
  if (includeOutsideSource) {
    sourceComponents.add(find(OUTSIDE_COMPONENT))
  }
  if (sourceComponents.size === 0) {
    return []
  }

  const graph = new Map<string, Set<string>>()
  const addGraphNode = (node: string): void => {
    if (!graph.has(node)) {
      graph.set(node, new Set())
    }
  }
  const addGraphEdge = (left: string, right: string): void => {
    if (left === right) {
      addGraphNode(left)
      return
    }
    addGraphNode(left)
    addGraphNode(right)
    graph.get(left)?.add(right)
    graph.get(right)?.add(left)
  }

  for (const root of componentTiles.keys()) {
    addGraphNode(root)
  }
  if (includeOutsideSource) {
    addGraphNode(find(OUTSIDE_COMPONENT))
  }

  for (const adjacency of adjacencies) {
    const mark = getSeparatorMark(puzzle, adjacency)
    if (mark === 'line') {
      continue
    }
    if (!isCandidateTile(adjacency.left) || !isCandidateTile(adjacency.right)) {
      continue
    }
    addGraphEdge(find(adjacency.left), find(adjacency.right))
  }

  if (includeOutsideSource) {
    for (const key of tileKeys) {
      if (isBoundaryTileKey(puzzle, key) && isCandidateTile(key)) {
        addGraphEdge(find(OUTSIDE_COMPONENT), find(key))
      }
    }
  }

  const discovery = new Map<string, number>()
  const low = new Map<string, number>()
  const subtreeSources = new Map<string, number>()
  const treeChildren = new Map<string, string[]>()
  const cutComponents = new Set<string>()
  const reachableComponents = new Set<string>()
  let timestamp = 0

  const dfs = (node: string, parentNode: string | null, connectedNodes: string[]): void => {
    discovery.set(node, timestamp)
    low.set(node, timestamp)
    timestamp += 1
    subtreeSources.set(node, sourceComponents.has(node) ? 1 : 0)
    connectedNodes.push(node)
    reachableComponents.add(node)

    for (const neighbor of graph.get(node) ?? []) {
      if (neighbor === parentNode) {
        continue
      }
      if (!discovery.has(neighbor)) {
        const children = treeChildren.get(node) ?? []
        children.push(neighbor)
        treeChildren.set(node, children)
        dfs(neighbor, node, connectedNodes)
        low.set(node, Math.min(low.get(node) ?? 0, low.get(neighbor) ?? 0))
        subtreeSources.set(node, (subtreeSources.get(node) ?? 0) + (subtreeSources.get(neighbor) ?? 0))
        continue
      }
      low.set(node, Math.min(low.get(node) ?? 0, discovery.get(neighbor) ?? 0))
    }
  }

  const evaluateCuts = (node: string, totalSources: number): void => {
    for (const neighbor of treeChildren.get(node) ?? []) {
      if ((low.get(neighbor) ?? 0) >= (discovery.get(node) ?? 0)) {
        const childSources = subtreeSources.get(neighbor) ?? 0
        if (childSources > 0 && totalSources - childSources > 0) {
          cutComponents.add(node)
        }
      }
      evaluateCuts(neighbor, totalSources)
    }
  }

  for (const node of sourceComponents) {
    if (discovery.has(node)) {
      continue
    }
    const connectedNodes: string[] = []
    dfs(node, null, connectedNodes)
    const totalSources = connectedNodes.filter((component) => sourceComponents.has(component)).length
    if (totalSources < 2) {
      continue
    }
    evaluateCuts(node, totalSources)
  }

  const updates = new Map<string, ConnectivityTileColorUpdate>()
  for (const component of cutComponents) {
    for (const key of componentTiles.get(component) ?? []) {
      if (getEffectiveTileColor(key) === null) {
        updates.set(key, { tileKey: key, toFill: target, reason: 'cut' })
      }
    }
  }

  const unreachableFill = oppositeMasyuTileColor(target)
  for (const [component, tiles] of componentTiles) {
    if (reachableComponents.has(component)) {
      continue
    }
    for (const key of tiles) {
      if (getEffectiveTileColor(key) === null) {
        updates.set(key, { tileKey: key, toFill: unreachableFill, reason: 'unreachable' })
      }
    }
  }

  return tileKeys.flatMap((key) => updates.get(key) ?? [])
}

export const createMasyuTileConnectivityCutColoringRule = (): Rule => ({
  id: 'masyu-tile-connectivity-cut-coloring',
  name: 'Masyu Tile Connectivity Cut Coloring',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decidedTileFills = new Map<string, MasyuTileColor>()
    const affectedTiles = new Set<string>()
    const stats = {
      greenCuts: 0,
      yellowCuts: 0,
      greenUnreachable: 0,
      yellowUnreachable: 0,
    }

    const getEffectiveTileColor = (key: string): MasyuTileColor | null => {
      const decided = decidedTileFills.get(key)
      if (decided) {
        return decided
      }
      const current = puzzle.tiles[key]?.fill
      return isMasyuTileColor(current) ? current : null
    }

    const rememberTileFill = (update: ConnectivityTileColorUpdate): void => {
      const { tileKey: key, toFill, reason } = update
      if (getEffectiveTileColor(key) !== null) {
        return
      }
      decidedTileFills.set(key, toFill)
      affectedTiles.add(key)
      if (reason === 'cut' && toFill === 'green') {
        stats.greenCuts += 1
      } else if (reason === 'cut' && toFill === 'yellow') {
        stats.yellowCuts += 1
      } else if (reason === 'unreachable' && toFill === 'yellow') {
        stats.greenUnreachable += 1
      } else if (reason === 'unreachable' && toFill === 'green') {
        stats.yellowUnreachable += 1
      }
    }

    for (const update of findConnectivityTileColorUpdates(puzzle, {
      target: 'green',
      includeOutsideSource: false,
      getEffectiveTileColor,
    })) {
      rememberTileFill(update)
    }

    for (const update of findConnectivityTileColorUpdates(puzzle, {
      target: 'yellow',
      includeOutsideSource: true,
      getEffectiveTileColor,
    })) {
      rememberTileFill(update)
    }

    if (decidedTileFills.size === 0) {
      return null
    }

    const diffs: RuleApplication['diffs'] = []
    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        const key = tileKey(row, col)
        const toFill = decidedTileFills.get(key)
        if (!toFill) {
          continue
        }
        diffs.push({
          kind: 'tile' as const,
          tileKey: key,
          fromFill: (puzzle.tiles[key]?.fill ?? null) as string | null,
          toFill,
        })
      }
    }

    const firstTile = diffs.find((diff) => diff.kind === 'tile')?.tileKey
    return {
      message: `Tile connectivity forces color updates near ${firstTile ? formatMasyuTileKeyLabel(firstTile) : 'the Masyu region graph'}: inside cuts ${stats.greenCuts}, outside cuts ${stats.yellowCuts}, unreachable-from-inside ${stats.greenUnreachable}, unreachable-from-outside ${stats.yellowUnreachable}.`,
      diffs,
      affectedCells: [],
      affectedTiles: [...affectedTiles],
    }
  },
})
