import { describe, expect, it } from 'vitest'
import { createSlitherPuzzle } from '../../ir/slither'
import { cellKey } from '../../ir/keys'
import { slitherPlugin } from '../../plugins/slitherPlugin'
import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from './slitherPuzzlink'

describe('slither puzzlink parser', () => {
  const complexSlitherUrl =
    'https://puzz.link/p?slither/18/10/bgdhdbc58cd6dhdkdjbi8dg5d8518ak8an7ck8068c8dg7diajdkdh8cd88bbcdhagc'

  it('decodes url into slither puzzle and clues', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    expect(puzzle.rows).toBe(3)
    expect(puzzle.cols).toBe(3)
    expect(Object.keys(puzzle.cells).length).toBe(1)
    const clue = puzzle.cells['0,1']?.clue
    expect(clue?.kind).toBe('number')
    if (clue?.kind !== 'number') {
      throw new Error('Expected number clue')
    }
    expect(clue.value).toBe(0)
  })

  it('decodes pzv.jp urls with the same data as puzz.link', () => {
    const fromPuzzlink = decodeSlitherFromPuzzlink(complexSlitherUrl)
    const fromPzv = decodeSlitherFromPuzzlink(
      complexSlitherUrl.replace('https://puzz.link', 'http://pzv.jp'),
    )

    expect(fromPzv.rows).toBe(fromPuzzlink.rows)
    expect(fromPzv.cols).toBe(fromPuzzlink.cols)
    expect(fromPzv.cells).toEqual(fromPuzzlink.cells)
  })

  it('decodes pzplus.tck.mn urls with the same data as puzz.link', () => {
    const fromPuzzlink = decodeSlitherFromPuzzlink(complexSlitherUrl)
    const fromPzplus = decodeSlitherFromPuzzlink(
      complexSlitherUrl.replace('https://puzz.link', 'https://pzplus.tck.mn'),
    )

    expect(fromPzplus.rows).toBe(fromPuzzlink.rows)
    expect(fromPzplus.cols).toBe(fromPuzzlink.cols)
    expect(fromPzplus.cells).toEqual(fromPuzzlink.cells)
  })

  it('rejects unsupported url hosts', () => {
    expect(() => decodeSlitherFromPuzzlink('https://example.com/p?slither/3/3/g0h')).toThrow(
      /Only puzz\.link, pzplus\.tck\.mn, and pzv\.jp URLs are supported/,
    )
  })

  it('encodes puzzle back to puzzlink format', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const url = encodeSlitherToPuzzlink(puzzle)
    expect(url.startsWith('https://puzz.link/p?slither/3/3/')).toBe(true)
  })

  it('encode rejects grid smaller than 3×3', () => {
    const puzzle = createSlitherPuzzle(2, 2)
    expect(() => encodeSlitherToPuzzlink(puzzle)).toThrow(/between 3/)
  })

  it('encode rejects clue value 4', () => {
    const puzzle = createSlitherPuzzle(3, 3)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 4 } }
    expect(() => encodeSlitherToPuzzlink(puzzle)).toThrow(/Invalid Slitherlink clue/)
  })

  it('round-trips a sparse custom slither grid', () => {
    const puzzle = createSlitherPuzzle(4, 5)
    puzzle.cells[cellKey(1, 2)] = { clue: { kind: 'number', value: 2 } }
    puzzle.cells[cellKey(3, 4)] = { clue: { kind: 'number', value: '?' } }
    const url = encodeSlitherToPuzzlink(puzzle)
    const again = decodeSlitherFromPuzzlink(url)
    expect(again.rows).toBe(4)
    expect(again.cols).toBe(5)
    expect(again.cells[cellKey(1, 2)]?.clue).toEqual({ kind: 'number', value: 2 })
    expect(again.cells[cellKey(3, 4)]?.clue).toEqual({ kind: 'number', value: '?' })
  })

  it('keeps the slither plugin puzz.link path working', () => {
    const puzzle = slitherPlugin.parse('https://puzz.link/p?slither/3/3/g0h')
    expect(puzzle.rows).toBe(3)
    expect(puzzle.cols).toBe(3)
    expect(puzzle.cells[cellKey(0, 1)]?.clue).toEqual({ kind: 'number', value: 0 })
  })
})
