import { bench, describe } from 'vitest'
import { clonePuzzle } from '../ir/normalize'
import { decodeSlitherFromPuzzlink } from '../parsers/puzzlink'
import { applyRuleDiffs } from './engine'
import type { RuleDiff } from './types'

const SAMPLE_URL =
  'https://puzz.link/p?slither/18/10/i61ch28cg16dg122cg63bi3ah1di2dcg0bgb1bc6c8bchd8b6cd1cbg2cgb3ci1dh3ci18dg132bg72bg82bh36dg'

const puzzle = decodeSlitherFromPuzzlink(SAMPLE_URL)
const edgeKeys = Object.keys(puzzle.edges)
const sectorKeys = Object.keys(puzzle.sectors)

const diffs: RuleDiff[] = [
  {
    kind: 'edge',
    edgeKey: edgeKeys[0],
    from: 'unknown',
    to: 'line',
  },
  {
    kind: 'edge',
    edgeKey: edgeKeys[1],
    from: 'unknown',
    to: 'blank',
  },
  {
    kind: 'sector',
    sectorKey: sectorKeys[0],
    fromMask: puzzle.sectors[sectorKeys[0]].constraintsMask,
    toMask: 1,
  },
  {
    kind: 'cell',
    cellKey: '0,0',
    fromFill: null,
    toFill: 'green',
  },
]

const applyDiffsWithJsonClone = () => {
  const next = clonePuzzle(puzzle)
  for (const diff of diffs) {
    if (diff.kind === 'edge') {
      if (!next.edges[diff.edgeKey]) {
        next.edges[diff.edgeKey] = { mark: diff.to }
      } else {
        next.edges[diff.edgeKey].mark = diff.to
      }
      continue
    }
    if (diff.kind === 'sector') {
      if (!next.sectors[diff.sectorKey]) {
        next.sectors[diff.sectorKey] = { constraintsMask: diff.toMask }
      } else {
        next.sectors[diff.sectorKey].constraintsMask = diff.toMask
      }
      continue
    }
    if (!next.cells[diff.cellKey]) {
      next.cells[diff.cellKey] = {}
    }
    if (diff.toFill === null) {
      delete next.cells[diff.cellKey].fill
    } else {
      next.cells[diff.cellKey].fill = diff.toFill
    }
  }
}

describe('engine diff-apply benchmark', () => {
  bench('legacy json clone + apply', () => {
    applyDiffsWithJsonClone()
  })

  bench('copy-on-write applyRuleDiffs', () => {
    applyRuleDiffs(puzzle, diffs)
  })
})
