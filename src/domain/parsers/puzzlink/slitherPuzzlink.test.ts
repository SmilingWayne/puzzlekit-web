import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink, encodeSlitherToPuzzlink } from './slitherPuzzlink'

describe('slither puzzlink parser', () => {
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

  it('encodes puzzle back to puzzlink format', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const url = encodeSlitherToPuzzlink(puzzle)
    expect(url.startsWith('https://puzz.link/p?slither/3/3/')).toBe(true)
  })
})
