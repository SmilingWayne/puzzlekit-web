import { cellKey, parseLineKey } from '../../../ir/keys'
import type { CellCoord, LineMark, PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  buildMasyuLineDiffs,
  collectMasyuLineDecisionWithoutDegreeOverflow,
  formatMasyuLineLabel,
} from './shared'

type CandidateEdge = {
  lineKey: string
  mark: LineMark
  left: string
  right: string
}

type CandidateGraph = {
  cellKeys: string[]
  edges: CandidateEdge[]
  adjacency: Map<string, CandidateEdge[]>
}

const getEndpointKey = ([row, col]: CellCoord): string => cellKey(row, col)

const getOtherEndpoint = (edge: CandidateEdge, node: string): string =>
  edge.left === node ? edge.right : edge.left

const buildMasyuCandidateGraph = (puzzle: PuzzleIR): CandidateGraph => {
  const cellKeys: string[] = []
  const adjacency = new Map<string, CandidateEdge[]>()

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const key = cellKey(row, col)
      cellKeys.push(key)
      adjacency.set(key, [])
    }
  }

  const edges: CandidateEdge[] = []
  for (const lineKeyValue of Object.keys(puzzle.lines)) {
    const mark = puzzle.lines[lineKeyValue]?.mark ?? 'unknown'
    if (mark === 'blank') {
      continue
    }
    const [leftCoord, rightCoord] = parseLineKey(lineKeyValue)
    const edge = {
      lineKey: lineKeyValue,
      mark,
      left: getEndpointKey(leftCoord),
      right: getEndpointKey(rightCoord),
    }
    edges.push(edge)
    adjacency.get(edge.left)?.push(edge)
    adjacency.get(edge.right)?.push(edge)
  }

  return { cellKeys, edges, adjacency }
}

const getRequiredSources = (puzzle: PuzzleIR, graph: CandidateGraph): Set<string> => {
  const sources = new Set<string>()

  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind === 'pearl') {
      sources.add(key)
    }
  }

  for (const edge of graph.edges) {
    if (edge.mark !== 'line') {
      continue
    }
    sources.add(edge.left)
    sources.add(edge.right)
  }

  return sources
}

const getSourceComponentCount = (graph: CandidateGraph, sources: ReadonlySet<string>): number => {
  const seen = new Set<string>()
  let sourceComponents = 0

  for (const start of graph.cellKeys) {
    if (seen.has(start)) {
      continue
    }
    const stack = [start]
    seen.add(start)
    let hasSource = false

    while (stack.length > 0) {
      const node = stack.pop()
      if (node === undefined) {
        continue
      }
      if (sources.has(node)) {
        hasSource = true
      }
      for (const edge of graph.adjacency.get(node) ?? []) {
        const neighbor = getOtherEndpoint(edge, node)
        if (seen.has(neighbor)) {
          continue
        }
        seen.add(neighbor)
        stack.push(neighbor)
      }
    }

    if (hasSource) {
      sourceComponents += 1
    }
  }

  return sourceComponents
}

export const createMasyuCandidateBridgeLineRule = (): Rule => ({
  id: 'masyu-candidate-bridge-line',
  name: 'Masyu Candidate Bridge Line',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const graph = buildMasyuCandidateGraph(puzzle)
    const requiredSources = getRequiredSources(puzzle, graph)

    if (requiredSources.size < 2 || getSourceComponentCount(graph, requiredSources) > 1) {
      return null
    }

    const decisions = new Map<string, LineMark>()
    const affectedCells = new Set<string>()
    const affectedLines = new Set<string>()
    const discovery = new Map<string, number>()
    const low = new Map<string, number>()
    let timestamp = 0
    let firstForcedLine: string | null = null

    const rememberBridge = (edge: CandidateEdge, childRequired: number, totalRequired: number): void => {
      if (edge.mark !== 'unknown' || childRequired === 0 || totalRequired - childRequired === 0) {
        return
      }
      if (!collectMasyuLineDecisionWithoutDegreeOverflow(decisions, puzzle, edge.lineKey, 'line')) {
        return
      }
      affectedLines.add(edge.lineKey)
      affectedCells.add(edge.left)
      affectedCells.add(edge.right)
      if (firstForcedLine === null) {
        firstForcedLine = edge.lineKey
      }
    }

    const dfs = (node: string, parentEdge: string | null, totalRequired: number): number => {
      discovery.set(node, timestamp)
      low.set(node, timestamp)
      timestamp += 1

      let subtreeRequired = requiredSources.has(node) ? 1 : 0

      for (const edge of graph.adjacency.get(node) ?? []) {
        if (edge.lineKey === parentEdge) {
          continue
        }
        const neighbor = getOtherEndpoint(edge, node)
        if (!discovery.has(neighbor)) {
          const childRequired = dfs(neighbor, edge.lineKey, totalRequired)
          low.set(node, Math.min(low.get(node) ?? 0, low.get(neighbor) ?? 0))
          subtreeRequired += childRequired

          if ((low.get(neighbor) ?? 0) > (discovery.get(node) ?? 0)) {
            rememberBridge(edge, childRequired, totalRequired)
          }
          continue
        }
        low.set(node, Math.min(low.get(node) ?? 0, discovery.get(neighbor) ?? 0))
      }

      return subtreeRequired
    }

    for (const start of graph.cellKeys) {
      if (discovery.has(start)) {
        continue
      }
      const componentNodes: string[] = []
      const stack = [start]
      const seen = new Set<string>([start])

      while (stack.length > 0) {
        const node = stack.pop()
        if (node === undefined) {
          continue
        }
        componentNodes.push(node)
        for (const edge of graph.adjacency.get(node) ?? []) {
          const neighbor = getOtherEndpoint(edge, node)
          if (seen.has(neighbor)) {
            continue
          }
          seen.add(neighbor)
          stack.push(neighbor)
        }
      }

      const totalRequired = componentNodes.filter((node) => requiredSources.has(node)).length
      dfs(start, null, totalRequired)
    }

    if (decisions.size === 0 || firstForcedLine === null) {
      return null
    }

    const diffs = buildMasyuLineDiffs(decisions, puzzle)
    return {
      message:
        `This candidate line is the only remaining connection between required loop regions, so it must be part of the loop: ${formatMasyuLineLabel(firstForcedLine)}` +
        `${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`,
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: [...affectedLines],
    }
  },
})
