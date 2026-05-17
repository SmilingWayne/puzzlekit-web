import { describe, expect, it } from 'vitest'
import { cellKey } from '../../ir/keys'
import { decodeMasyuFromPuzzlink, number3Decode } from './masyuPuzzlink'

const SAMPLE_URL = 'https://puzz.link/p?mashu/5/5/001390360'

describe('number3Decode', () => {
  it('unpacks each base-36 character into three trits', () => {
    expect(number3Decode('9')).toEqual([1, 0, 0])
    expect(number3Decode('z')).toEqual([0, 2, 2])
  })
})

describe('decodeMasyuFromPuzzlink', () => {
  it('imports the sample Masyu puzzle with expected pearl coordinates', () => {
    const puzzle = decodeMasyuFromPuzzlink(SAMPLE_URL)

    expect(puzzle.puzzleType).toBe('masyu')
    expect(puzzle.rows).toBe(5)
    expect(puzzle.cols).toBe(5)
    expect(Object.keys(puzzle.lines)).toHaveLength(40)
    expect(puzzle.cells[cellKey(1, 3)]?.clue).toEqual({ kind: 'pearl', color: 'white' })
    expect(puzzle.cells[cellKey(2, 0)]?.clue).toEqual({ kind: 'pearl', color: 'white' })
    expect(puzzle.cells[cellKey(2, 2)]?.clue).toEqual({ kind: 'pearl', color: 'white' })
    expect(puzzle.cells[cellKey(3, 4)]?.clue).toEqual({ kind: 'pearl', color: 'white' })
    expect(puzzle.cells[cellKey(4, 2)]?.clue).toEqual({ kind: 'pearl', color: 'black' })
  })

  it('accepts Masyu aliases and strips optional header segments', () => {
    expect(decodeMasyuFromPuzzlink('masyu/v:/3/1/9').cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(decodeMasyuFromPuzzlink('pearl/b/3/1/2').cells[cellKey(0, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
  })
})
