import { describe, expect, it } from 'vitest'
import { cellKey } from '../ir/keys'
import { createSlitherPuzzle } from '../ir/slither'
import { getSlitherStats } from './slitherPlugin'

describe('getSlitherStats', () => {
  it('counts numeric clue cells and clue distribution percentages', () => {
    const puzzle = createSlitherPuzzle(10, 10)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 0 } }
    puzzle.cells[cellKey(0, 1)] = { clue: { kind: 'number', value: 1 } }
    puzzle.cells[cellKey(0, 2)] = { clue: { kind: 'number', value: 1 } }
    puzzle.cells[cellKey(0, 3)] = { clue: { kind: 'number', value: 2 } }
    puzzle.cells[cellKey(0, 4)] = { clue: { kind: 'number', value: 3 } }
    puzzle.cells[cellKey(0, 5)] = { clue: { kind: 'number', value: '?' } }
    puzzle.cells[cellKey(0, 6)] = { clue: { kind: 'text', text: 'A' } }

    const stats = getSlitherStats(puzzle)
    const total = stats.groups[0].items[0]
    const distribution = stats.groups[1].items

    expect(stats.summary).toBe('Numbered cells 5 / 100 (5.0%)')
    expect(total).toEqual({ label: 'Total', value: '5 / 100', detail: '5.0%' })
    expect(distribution).toEqual([
      { label: 'Clue 0', value: '1', detail: '20.0%' },
      { label: 'Clue 1', value: '2', detail: '40.0%' },
      { label: 'Clue 2', value: '1', detail: '20.0%' },
      { label: 'Clue 3', value: '1', detail: '20.0%' },
    ])
  })

  it('uses stable zero percentages when there are no numeric clues', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: '?' } }

    const stats = getSlitherStats(puzzle)

    expect(stats.summary).toBe('Numbered cells 0 / 9 (0.0%)')
    expect(stats.groups[1].items).toEqual([
      { label: 'Clue 0', value: '0', detail: '0.0%' },
      { label: 'Clue 1', value: '0', detail: '0.0%' },
      { label: 'Clue 2', value: '0', detail: '0.0%' },
      { label: 'Clue 3', value: '0', detail: '0.0%' },
    ])
  })
})
