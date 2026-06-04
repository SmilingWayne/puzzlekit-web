import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import { createMasyuLineDecisionCollector } from './decisionCollector'
import {
  buildMasyuCandidateGraph,
  getMasyuOtherEndpoint,
  getMasyuRequiredSources,
  getMasyuSourceComponentCount,
  type MasyuCandidateEdge,
} from './lineGraph'
import { formatMasyuLineLabel } from './shared'

export const createMasyuCandidateBridgeLineRule = (): Rule => ({
  id: 'masyu-candidate-bridge-line',
  name: 'Masyu Candidate Bridge Line',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const graph = buildMasyuCandidateGraph(puzzle)
    const requiredSources = getMasyuRequiredSources(puzzle, graph)

    if (
      requiredSources.size < 2 ||
      getMasyuSourceComponentCount(graph, requiredSources) > 1
    ) {
      return null
    }

    const decisions = createMasyuLineDecisionCollector(puzzle, {
      guardLineDegree: true,
    })
    const affectedCells = new Set<string>()
    const affectedLines = new Set<string>()
    const discovery = new Map<string, number>()
    const low = new Map<string, number>()
    let timestamp = 0
    let firstForcedLine: string | null = null

    const rememberBridge = (
      edge: MasyuCandidateEdge,
      childRequired: number,
      totalRequired: number,
    ): void => {
      if (
        edge.mark !== 'unknown' ||
        childRequired === 0 ||
        totalRequired - childRequired === 0
      ) {
        return
      }
      if (!decisions.add(edge.lineKey, 'line')) {
        return
      }
      affectedLines.add(edge.lineKey)
      affectedCells.add(edge.left)
      affectedCells.add(edge.right)
      if (firstForcedLine === null) {
        firstForcedLine = edge.lineKey
      }
    }

    const dfs = (
      node: string,
      parentEdge: string | null,
      totalRequired: number,
    ): number => {
      discovery.set(node, timestamp)
      low.set(node, timestamp)
      timestamp += 1

      let subtreeRequired = requiredSources.has(node) ? 1 : 0

      for (const edge of graph.adjacency.get(node) ?? []) {
        if (edge.lineKey === parentEdge) {
          continue
        }
        const neighbor = getMasyuOtherEndpoint(edge, node)
        if (!discovery.has(neighbor)) {
          const childRequired = dfs(neighbor, edge.lineKey, totalRequired)
          low.set(node, Math.min(low.get(node) ?? 0, low.get(neighbor) ?? 0))
          subtreeRequired += childRequired

          if ((low.get(neighbor) ?? 0) > (discovery.get(node) ?? 0)) {
            rememberBridge(edge, childRequired, totalRequired)
          }
          continue
        }
        low.set(
          node,
          Math.min(low.get(node) ?? 0, discovery.get(neighbor) ?? 0),
        )
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
          const neighbor = getMasyuOtherEndpoint(edge, node)
          if (seen.has(neighbor)) {
            continue
          }
          seen.add(neighbor)
          stack.push(neighbor)
        }
      }

      const totalRequired = componentNodes.filter((node) =>
        requiredSources.has(node),
      ).length
      dfs(start, null, totalRequired)
    }

    if (!decisions.hasChanges() || firstForcedLine === null) {
      return null
    }

    const diffs = decisions.diffs()
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
