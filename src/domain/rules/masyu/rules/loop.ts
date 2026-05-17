import { parseLineKey } from '../../../ir/keys'
import type { LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { buildMasyuLineDiffs, formatMasyuLineLabel } from './shared'

export type MasyuLineOverlay = ReadonlyMap<string, LineMark>

const getOverlayLineMark = (puzzle: PuzzleIR, overlay: MasyuLineOverlay, lineKey: string): LineMark =>
  overlay.get(lineKey) ?? puzzle.lines[lineKey]?.mark ?? 'unknown'

const buildMasyuLineUnion = (puzzle: PuzzleIR, overlay: MasyuLineOverlay = new Map()) => {
  const cellCount = puzzle.rows * puzzle.cols
  const parent = Array.from({ length: cellCount }, (_, idx) => idx)
  const rank = new Array<number>(cellCount).fill(0)
  const toCellIndex = (row: number, col: number): number => row * puzzle.cols + col
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

  const lineKeys = Object.keys(puzzle.lines).filter((lineKeyValue) => getOverlayLineMark(puzzle, overlay, lineKeyValue) === 'line')
  for (const lineKeyValue of lineKeys) {
    const [left, right] = parseLineKey(lineKeyValue)
    union(toCellIndex(left[0], left[1]), toCellIndex(right[0], right[1]))
  }

  return { find, lineKeys, toCellIndex }
}

export const findMasyuPrematureLoopClosingLines = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): string[] => {
  const { find, lineKeys, toCellIndex } = buildMasyuLineUnion(puzzle, overlay)
  const lineComponentRoots = new Set(
    lineKeys.map((lineKeyValue) => {
      const [left] = parseLineKey(lineKeyValue)
      return find(toCellIndex(left[0], left[1]))
    }),
  )
  const closingLines: string[] = []

  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    if (getOverlayLineMark(puzzle, overlay, lineKeyValue) !== 'unknown') {
      continue
    }
    const [left, right] = parseLineKey(lineKeyValue)
    const leftRoot = find(toCellIndex(left[0], left[1]))
    const rightRoot = find(toCellIndex(right[0], right[1]))
    if (leftRoot !== rightRoot) {
      continue
    }
    if (![...lineComponentRoots].some((root) => root !== leftRoot)) {
      continue
    }
    closingLines.push(lineKeyValue)
  }

  return closingLines
}

export const hasMasyuPrematureLoop = (
  puzzle: PuzzleIR,
  overlay: MasyuLineOverlay = new Map(),
): boolean => {
  const { find, lineKeys, toCellIndex } = buildMasyuLineUnion(puzzle, overlay)
  const components = new Map<number, { edgeCount: number; vertices: Set<number> }>()

  for (const lineKeyValue of lineKeys) {
    const [left, right] = parseLineKey(lineKeyValue)
    const leftIndex = toCellIndex(left[0], left[1])
    const rightIndex = toCellIndex(right[0], right[1])
    const root = find(leftIndex)
    const component = components.get(root) ?? { edgeCount: 0, vertices: new Set<number>() }
    component.edgeCount += 1
    component.vertices.add(leftIndex)
    component.vertices.add(rightIndex)
    components.set(root, component)
  }

  for (const component of components.values()) {
    if (component.edgeCount >= component.vertices.size && lineKeys.length > component.edgeCount) {
      return true
    }
  }

  return false
}

export const createPreventPrematureLoopRule = (): Rule => ({
  id: 'masyu-prevent-premature-loop',
  name: 'Prevent Premature Loop',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = new Map<string, LineMark>()
    let firstExample: string | null = null

    for (const lineKeyValue of findMasyuPrematureLoopClosingLines(puzzle)) {
      decisions.set(lineKeyValue, 'blank')
      if (firstExample === null) {
        firstExample = formatMasyuLineLabel(lineKeyValue)
      }
    }

    if (decisions.size === 0) {
      return null
    }

    const diffs = buildMasyuLineDiffs(decisions, puzzle)
    return {
      message:
        firstExample !== null
          ? `${firstExample} would close a smaller loop while other lines remain outside it, so it must be blank.`
          : 'Lines that would close a smaller loop while other lines remain outside it are blank.',
      diffs,
      affectedCells: [],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})
