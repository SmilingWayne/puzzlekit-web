import { describe, expect, it } from 'vitest'
import { cellKey, edgeKey } from '../../ir/keys'
import { createSlitherPuzzle } from '../../ir/slither'
import type { EdgeMark, PuzzleIR } from '../../ir/types'
import { analyzeSlitherCompletion } from './completion'

const markEdge = (puzzle: PuzzleIR, edge: string, mark: EdgeMark): void => {
  puzzle.edges[edge] = { ...puzzle.edges[edge], mark }
}

const markCellLoop = (puzzle: PuzzleIR, row: number, col: number): void => {
  markEdge(puzzle, edgeKey([row, col], [row, col + 1]), 'line')
  markEdge(puzzle, edgeKey([row + 1, col], [row + 1, col + 1]), 'line')
  markEdge(puzzle, edgeKey([row, col], [row + 1, col]), 'line')
  markEdge(puzzle, edgeKey([row, col + 1], [row + 1, col + 1]), 'line')
}

describe('slither completion analysis', () => {
  it('returns solved for one closed connected loop with satisfied clues', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    for (let col = 0; col < 2; col += 1) {
      markEdge(puzzle, edgeKey([0, col], [0, col + 1]), 'line')
      markEdge(puzzle, edgeKey([2, col], [2, col + 1]), 'line')
    }
    for (let row = 0; row < 2; row += 1) {
      markEdge(puzzle, edgeKey([row, 0], [row + 1, 0]), 'line')
      markEdge(puzzle, edgeKey([row, 2], [row + 1, 2]), 'line')
    }
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        puzzle.cells[cellKey(row, col)] = { clue: { kind: 'number', value: 2 } }
      }
    }

    expect(analyzeSlitherCompletion(puzzle)).toMatchObject({
      status: 'solved',
      reasons: [],
    })
  })

  it('reports clue mismatches', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    markCellLoop(puzzle, 0, 0)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 3 } }

    const report = analyzeSlitherCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('clue cell'))).toBe(true)
  })

  it('reports multiple disconnected closed loops', () => {
    const puzzle = createSlitherPuzzle(1, 3)
    markCellLoop(puzzle, 0, 0)
    markCellLoop(puzzle, 0, 2)

    const report = analyzeSlitherCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('connected component'))).toBe(true)
  })

  it('reports line endpoints', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    markEdge(puzzle, edgeKey([0, 0], [0, 1]), 'line')

    const report = analyzeSlitherCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('degree 2'))).toBe(true)
  })

  it('reports branch vertices', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    for (let col = 0; col < 2; col += 1) {
      markEdge(puzzle, edgeKey([0, col], [0, col + 1]), 'line')
      markEdge(puzzle, edgeKey([2, col], [2, col + 1]), 'line')
    }
    for (let row = 0; row < 2; row += 1) {
      markEdge(puzzle, edgeKey([row, 0], [row + 1, 0]), 'line')
      markEdge(puzzle, edgeKey([row, 2], [row + 1, 2]), 'line')
    }
    markEdge(puzzle, edgeKey([1, 1], [1, 2]), 'line')

    const report = analyzeSlitherCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('branch'))).toBe(true)
  })

  it('calculates decided edge coverage', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    markEdge(puzzle, edgeKey([0, 0], [0, 1]), 'line')
    markEdge(puzzle, edgeKey([1, 0], [1, 1]), 'blank')

    const report = analyzeSlitherCompletion(puzzle)

    expect(report.stats).toMatchObject({
      totalEdges: 4,
      lineEdges: 1,
      blankEdges: 1,
      unknownEdges: 2,
      decidedEdges: 2,
      decidedEdgeRatio: 0.5,
    })
  })
})
