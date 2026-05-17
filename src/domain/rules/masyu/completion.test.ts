import { describe, expect, it } from 'vitest'
import { cellKey, lineKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import type { LineMark, PuzzleIR } from '../../ir/types'
import { analyzeMasyuCompletion } from './completion'

const markLine = (puzzle: PuzzleIR, key: string, mark: LineMark): void => {
  puzzle.lines[key] = { ...puzzle.lines[key], mark }
}

const addPearl = (puzzle: PuzzleIR, row: number, col: number, color: 'white' | 'black'): void => {
  puzzle.cells[cellKey(row, col)] = { clue: { kind: 'pearl', color } }
}

const markRectLoop = (
  puzzle: PuzzleIR,
  top: number,
  left: number,
  bottom: number,
  right: number,
): void => {
  for (let col = left; col < right; col += 1) {
    markLine(puzzle, lineKey([top, col], [top, col + 1]), 'line')
    markLine(puzzle, lineKey([bottom, col], [bottom, col + 1]), 'line')
  }
  for (let row = top; row < bottom; row += 1) {
    markLine(puzzle, lineKey([row, left], [row + 1, left]), 'line')
    markLine(puzzle, lineKey([row, right], [row + 1, right]), 'line')
  }
}

describe('Masyu completion analysis', () => {
  it('returns solved for one valid loop with satisfied pearls', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 3, 3)
    addPearl(puzzle, 0, 0, 'black')
    addPearl(puzzle, 0, 1, 'white')

    expect(analyzeMasyuCompletion(puzzle)).toMatchObject({
      status: 'solved',
      reasons: [],
    })
  })

  it('reports when no line segments have been drawn', () => {
    const puzzle = createMasyuPuzzle(3, 3)

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('No line segments'))).toBe(true)
  })

  it('reports open path endpoints', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    markLine(puzzle, lineKey([1, 0], [1, 1]), 'line')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('degree 2'))).toBe(true)
    expect(report.reasons.some((reason) => reason.includes('endpoint'))).toBe(true)
  })

  it('reports branch cells', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 3, 3)
    markLine(puzzle, lineKey([0, 1], [1, 1]), 'line')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('branch'))).toBe(true)
  })

  it('reports disconnected sub-loops', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 1, 1)
    markRectLoop(puzzle, 2, 2, 3, 3)

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('connected component'))).toBe(true)
  })

  it('reports a black pearl that goes straight', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 3, 3)
    addPearl(puzzle, 0, 1, 'black')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('black pearl'))).toBe(true)
  })

  it('reports a black pearl turn without straight extensions', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    markRectLoop(puzzle, 0, 0, 1, 1)
    addPearl(puzzle, 0, 0, 'black')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('black pearl'))).toBe(true)
  })

  it('reports a white pearl that turns on the pearl cell', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 3, 3)
    addPearl(puzzle, 0, 0, 'white')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('white pearl'))).toBe(true)
  })

  it('reports a white pearl that never turns after passing through', () => {
    const puzzle = createMasyuPuzzle(1, 4)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(puzzle, lineKey([0, 1], [0, 2]), 'line')
    markLine(puzzle, lineKey([0, 2], [0, 3]), 'line')
    addPearl(puzzle, 0, 1, 'white')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.status).toBe('stalled')
    expect(report.reasons.some((reason) => reason.includes('white pearl'))).toBe(true)
  })

  it('accepts a white pearl with one adjacent side turning', () => {
    const puzzle = createMasyuPuzzle(4, 4)
    markRectLoop(puzzle, 0, 0, 3, 3)
    addPearl(puzzle, 0, 1, 'white')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.reasons.some((reason) => reason.includes('white pearl'))).toBe(false)
  })

  it('calculates decided line coverage', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    markLine(puzzle, lineKey([0, 0], [0, 1]), 'line')

    const report = analyzeMasyuCompletion(puzzle)

    expect(report.stats).toMatchObject({
      totalLines: 1,
      lineLines: 1,
      blankLines: 0,
      unknownLines: 0,
      decidedLines: 1,
      decidedLineRatio: 1,
      totalUnits: 1,
      decidedUnits: 1,
      decidedRatio: 1,
      unitLabel: 'Lines',
    })
  })
})
