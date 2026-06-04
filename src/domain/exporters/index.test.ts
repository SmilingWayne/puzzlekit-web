import { describe, expect, it } from 'vitest'
import { cellKey } from '../ir/keys'
import { createMasyuPuzzle } from '../ir/masyu'
import { decodeSlitherFromPuzzlink } from '../parsers/puzzlink'
import { exportPuzzle } from './index'

describe('URL exporters', () => {
  it('exports Slitherlink puzzles to supported puzz.link-compatible URL variants', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const context = { puzzle, pluginId: 'slitherlink' }

    expect(exportPuzzle(context, 'puzzlink')).toBe('https://puzz.link/p?slither/3/3/gak')
    expect(exportPuzzle(context, 'pzplus')).toBe('https://pzplus.tck.mn/p.html?slither/3/3/gak')
    expect(exportPuzzle(context, 'pzprxs')).toBe('https://pzprxs.vercel.app/p?slither/3/3/gak')
  })

  it('exports Masyu puzzles to supported puzz.link-compatible URL variants', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    puzzle.cells[cellKey(1, 1)] = { clue: { kind: 'pearl', color: 'white' } }
    puzzle.cells[cellKey(4, 3)] = { clue: { kind: 'pearl', color: 'white' } }
    puzzle.cells[cellKey(2, 2)] = { clue: { kind: 'pearl', color: 'black' } }
    puzzle.cells[cellKey(2, 3)] = { clue: { kind: 'pearl', color: 'black' } }
    puzzle.cells[cellKey(0, 5)] = { clue: { kind: 'pearl', color: 'black' } }
    const context = { puzzle, pluginId: 'masyu' }

    expect(exportPuzzle(context, 'puzzlink')).toBe('https://puzz.link/p?mashu/6/6/02302i000900')
    expect(exportPuzzle(context, 'pzplus')).toBe('https://pzplus.tck.mn/p.html?mashu/6/6/02302i000900')
    expect(exportPuzzle(context, 'pzprxs')).toBe('https://pzprxs.vercel.app/p?mashu/6/6/02302i000900')
  })
})
