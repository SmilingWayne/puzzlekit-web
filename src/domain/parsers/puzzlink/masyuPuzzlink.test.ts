import { describe, expect, it } from 'vitest'
import { cellKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import { createSlitherPuzzle } from '../../ir/slither'
import {
  decodeMasyuFromPuzzlink,
  encodeMasyuToPuzzlink,
  number3Decode,
  number3Encode,
} from './masyuPuzzlink'

const SAMPLE_URL = 'https://puzz.link/p?mashu/5/5/001390360'

const addPearl = (
  puzzle: ReturnType<typeof createMasyuPuzzle>,
  row: number,
  col: number,
  color: 'white' | 'black',
) => {
  puzzle.cells[cellKey(row, col)] = { clue: { kind: 'pearl', color } }
}

describe('number3Decode', () => {
  it('unpacks each base-36 character into three trits', () => {
    expect(number3Decode('9')).toEqual([1, 0, 0])
    expect(number3Decode('z')).toEqual([0, 2, 2])
  })
})

describe('number3Encode', () => {
  it('packs three trits into one base-36 character', () => {
    expect(number3Encode([1, 0, 0], 3)).toBe('9')
    expect(number3Encode([0, 2, 2], 3)).toBe('8')
  })

  it('pads the tail with zeroes when the length is not divisible by three', () => {
    expect(number3Encode([2], 1)).toBe('i')
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

  it('decodes pzplus.tck.mn and pzprxs.vercel.app urls with the same data as puzz.link', () => {
    const fromPuzzlink = decodeMasyuFromPuzzlink(SAMPLE_URL)
    const fromPzplus = decodeMasyuFromPuzzlink(
      SAMPLE_URL.replace('https://puzz.link/p?', 'https://pzplus.tck.mn/p.html?'),
    )
    const fromPzprxs = decodeMasyuFromPuzzlink(
      SAMPLE_URL.replace('https://puzz.link', 'https://pzprxs.vercel.app'),
    )

    expect(fromPzplus.cells).toEqual(fromPuzzlink.cells)
    expect(fromPzprxs.cells).toEqual(fromPuzzlink.cells)
  })
})

describe('encodeMasyuToPuzzlink', () => {
  it('exports the supplied 6x6 Masyu puzzle as a mashu puzz.link URL', () => {
    const puzzle = createMasyuPuzzle(6, 6)
    addPearl(puzzle, 1, 1, 'white')
    addPearl(puzzle, 4, 3, 'white')
    addPearl(puzzle, 2, 2, 'black')
    addPearl(puzzle, 2, 3, 'black')
    addPearl(puzzle, 0, 5, 'black')

    expect(encodeMasyuToPuzzlink(puzzle)).toBe('https://puzz.link/p?mashu/6/6/02302i000900')
  })

  it('exports the supplied 5x6 Masyu puzzle as a mashu puzz.link URL', () => {
    const puzzle = createMasyuPuzzle(5, 6)
    addPearl(puzzle, 0, 0, 'black')
    addPearl(puzzle, 4, 5, 'black')
    addPearl(puzzle, 1, 4, 'white')
    addPearl(puzzle, 4, 2, 'white')

    expect(encodeMasyuToPuzzlink(puzzle)).toBe('https://puzz.link/p?mashu/6/5/i003000012')
  })

  it('round-trips decoded pearl layouts through the encoder', () => {
    const encoded = encodeMasyuToPuzzlink(decodeMasyuFromPuzzlink(SAMPLE_URL))
    const roundTripped = decodeMasyuFromPuzzlink(encoded)

    expect(roundTripped.cells).toEqual(decodeMasyuFromPuzzlink(SAMPLE_URL).cells)
  })

  it('rejects non-Masyu puzzles', () => {
    expect(() => encodeMasyuToPuzzlink(createSlitherPuzzle(3, 3))).toThrow(
      'puzz.link export only supports Masyu puzzles.',
    )
  })
})
