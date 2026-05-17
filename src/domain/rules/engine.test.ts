import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../parsers/puzzlink'
import { tileKey, vertexKey } from '../ir/keys'
import { createMasyuPuzzle } from '../ir/masyu'
import { applyRuleDiffs, revertRuleDiffs, runNextRule } from './engine'
import { slitherRules } from './slither/rules'
import type { RuleDiff } from './types'

describe('rule engine', () => {
  it('finds at least one step for simple zero clue puzzle', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const result = runNextRule(puzzle, slitherRules, 1)
    expect(result.step).not.toBeNull()
    expect(result.step?.diffs.length).toBeGreaterThan(0)
    expect(result.step?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('applies and reverts diffs without mutating input puzzle', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const edgeKey = Object.keys(puzzle.edges)[0]
    const sectorKey = Object.keys(puzzle.sectors)[0]
    const centerVertexKey = vertexKey(1, 1)
    const fromCandidates = puzzle.vertices[centerVertexKey].candidateEdgeSets
    const toCandidates = fromCandidates.slice(0, 2)
    const diffs: RuleDiff[] = [
      {
        kind: 'edge',
        edgeKey,
        from: 'unknown',
        to: 'line',
      },
      {
        kind: 'sector',
        sectorKey,
        fromMask: puzzle.sectors[sectorKey].constraintsMask,
        toMask: 1,
      },
      {
        kind: 'cell',
        cellKey: '0,0',
        fromFill: null,
        toFill: 'green',
      },
      {
        kind: 'vertex',
        vertexKey: centerVertexKey,
        fromCandidates,
        toCandidates,
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.edges[edgeKey].mark).toBe('line')
    expect(next.sectors[sectorKey].constraintsMask).toBe(1)
    expect(next.cells['0,0']?.fill).toBe('green')
    expect(next.vertices[centerVertexKey].candidateEdgeSets).toEqual(toCandidates)
    expect(puzzle.edges[edgeKey].mark).toBe('unknown')
    expect(puzzle.cells['0,0']?.fill).toBeUndefined()
    expect(puzzle.vertices[centerVertexKey].candidateEdgeSets).toEqual(fromCandidates)

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.edges[edgeKey].mark).toBe('unknown')
    expect(rewound.sectors[sectorKey].constraintsMask).toBe(puzzle.sectors[sectorKey].constraintsMask)
    expect(rewound.cells['0,0']?.fill).toBeUndefined()
    expect(rewound.vertices[centerVertexKey].candidateEdgeSets).toEqual(fromCandidates)
  })

  it('applies and reverts line diffs without mutating input puzzle', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const lineKey = Object.keys(puzzle.lines)[0]
    const diffs: RuleDiff[] = [
      {
        kind: 'line',
        lineKey,
        from: 'unknown',
        to: 'line',
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.lines[lineKey].mark).toBe('line')
    expect(puzzle.lines[lineKey].mark).toBe('unknown')

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.lines[lineKey].mark).toBe('unknown')
  })

  it('applies and reverts tile fill diffs without mutating input puzzle', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const key = tileKey(1, 1)
    const diffs: RuleDiff[] = [
      {
        kind: 'tile',
        tileKey: key,
        fromFill: null,
        toFill: 'green',
      },
    ]

    const next = applyRuleDiffs(puzzle, diffs)
    expect(next.tiles[key]?.fill).toBe('green')
    expect(puzzle.tiles[key]?.fill).toBeUndefined()

    const rewound = revertRuleDiffs(next, diffs)
    expect(rewound.tiles[key]?.fill).toBeUndefined()
  })
})
