import { bench, describe } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../../parsers/puzzlink'
import { createCellCountRule, createVertexDegreeRule } from './rules/core'
import { createColorEdgePropagationRule } from './rules/color'
import { createApplySectorsInference } from './rules/sectorInference'
import { getEdgeAdjacentCellKeys } from './rules/shared'

const SAMPLE_URL =
  'https://puzz.link/p?slither/18/10/i61ch28cg16dg122cg63bi3ah1di2dcg0bgb1bc6c8bchd8b6cd1cbg2cgb3ci1dh3ci18dg132bg72bg82bh36dg'

const puzzle = decodeSlitherFromPuzzlink(SAMPLE_URL)
const edgeKeys = Object.keys(puzzle.edges)

const colorEdgeRule = createColorEdgePropagationRule()
const sectorInferenceRule = createApplySectorsInference()
const cellCountRule = createCellCountRule()
const vertexDegreeRule = createVertexDegreeRule()

describe('slither hotspot benchmark', () => {
  bench('shared.getEdgeAdjacentCellKeys over all edges', () => {
    for (const edgeKey of edgeKeys) {
      getEdgeAdjacentCellKeys(puzzle, edgeKey)
    }
  })

  bench('color edge propagation apply', () => {
    colorEdgeRule.apply(puzzle)
  })

  bench('sector inference apply', () => {
    sectorInferenceRule.apply(puzzle)
  })

  bench('core cell count apply', () => {
    cellCountRule.apply(puzzle)
  })

  bench('core vertex degree apply', () => {
    vertexDegreeRule.apply(puzzle)
  })
})
