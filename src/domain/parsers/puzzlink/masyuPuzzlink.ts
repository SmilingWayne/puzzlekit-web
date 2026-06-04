import { z } from 'zod'
import { cellKey, parseCellKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import type { PuzzleIR } from '../../ir/types'
import type { PuzzleFormatAdapter } from '../types'

const PUZZLINK_HOSTS = new Set(['puzz.link', 'pzplus.tck.mn', 'pzprxs.vercel.app', 'pzv.jp'])
const typeAlias: Record<string, string> = {
  masyu: 'masyu',
  mashu: 'masyu',
  pearl: 'masyu',
}

const HeaderSchema = z.object({
  puzzleType: z.string(),
  cols: z.coerce.number().int().positive(),
  rows: z.coerce.number().int().positive(),
  body: z.string(),
})

const parsePuzzlinkPath = (input: string) => {
  if (input.includes('://')) {
    const url = new URL(input)
    if (!PUZZLINK_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error(
        'Only puzz.link, pzplus.tck.mn, pzprxs.vercel.app, and pzv.jp URLs are supported in this adapter.',
      )
    }
    const q = decodeURIComponent(url.search.replace(/^\?/, '')).split('&')[0] ?? ''
    if (q.length > 0) {
      return q
    }
    const pathTokens = url.pathname.split('/').filter(Boolean)
    if (pathTokens[0] === 'p') {
      return pathTokens.slice(1).join('/')
    }
    throw new Error('Invalid puzz.link URL query.')
  }
  return input.replace(/^p\?/, '').split('&')[0] ?? ''
}

const parseHeader = (path: string) => {
  const tokens = path.split('/').filter(Boolean)
  if (tokens[1] === 'v:') {
    tokens.splice(1, 1)
  }
  if (tokens[1] === 'b') {
    tokens.splice(1, 1)
  }
  if (tokens.length < 4) {
    throw new Error('Malformed puzz.link Masyu puzzle path.')
  }
  return HeaderSchema.parse({
    puzzleType: tokens[0],
    cols: tokens[1],
    rows: tokens[2],
    body: tokens.slice(3).join('/'),
  })
}

export const number3Decode = (body: string): number[] => {
  const result: number[] = []
  for (const ch of body.toLowerCase()) {
    const value = Number.parseInt(ch, 36)
    if (!Number.isInteger(value) || value < 0 || value > 35) {
      throw new Error(`Invalid number3 character: "${ch}".`)
    }
    result.push(Math.floor(value / 9) % 3)
    result.push(Math.floor(value / 3) % 3)
    result.push(value % 3)
  }
  return result
}

export const number3Encode = (values: number[], totalCells: number): string => {
  let result = ''
  for (let idx = 0; idx < totalCells; idx += 3) {
    const a = values[idx] ?? 0
    const b = values[idx + 1] ?? 0
    const c = values[idx + 2] ?? 0
    if (a < 0 || a > 2 || b < 0 || b > 2 || c < 0 || c > 2) {
      throw new Error('number3 values must be trits between 0 and 2.')
    }
    result += (a * 9 + b * 3 + c).toString(36)
  }
  return result
}

export const decodeMasyuFromPuzzlink = (input: string): PuzzleIR => {
  const path = parsePuzzlinkPath(input)
  const header = parseHeader(path)
  const normalizedType = typeAlias[header.puzzleType]
  if (normalizedType !== 'masyu') {
    throw new Error(`Unsupported puzz.link type: ${header.puzzleType}`)
  }

  const puzzle = createMasyuPuzzle(header.rows, header.cols)
  puzzle.puzzleType = normalizedType
  puzzle.title = normalizedType
  puzzle.source = 'puzz.link'
  puzzle.metadata.originalUrl = input

  const trits = number3Decode(header.body)
  const totalCells = header.rows * header.cols
  for (let idx = 0; idx < totalCells; idx += 1) {
    const trit = trits[idx] ?? 0
    if (trit !== 1 && trit !== 2) {
      continue
    }
    const r = Math.floor(idx / header.cols)
    const c = idx % header.cols
    puzzle.cells[cellKey(r, c)] = {
      clue: {
        kind: 'pearl',
        color: trit === 1 ? 'white' : 'black',
      },
    }
  }
  return puzzle
}

export const encodeMasyuToPuzzlink = (puzzle: PuzzleIR): string => {
  if (puzzle.puzzleType !== 'masyu') {
    throw new Error('puzz.link export only supports Masyu puzzles.')
  }

  const rows = puzzle.rows - puzzle.margins[0] - puzzle.margins[1]
  const cols = puzzle.cols - puzzle.margins[2] - puzzle.margins[3]
  const totalCells = rows * cols
  const values = Array<number>(totalCells).fill(0)

  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'pearl') {
      continue
    }
    const [row, col] = parseCellKey(key)
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      continue
    }
    const rr = row - puzzle.margins[0]
    const cc = col - puzzle.margins[2]
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
      continue
    }
    values[rr * cols + cc] = cell.clue.color === 'white' ? 1 : 2
  }

  return `https://puzz.link/p?mashu/${cols}/${rows}/${number3Encode(values, totalCells)}`
}

export const masyuPuzzlinkAdapter: PuzzleFormatAdapter = {
  decode: decodeMasyuFromPuzzlink,
  encode: encodeMasyuToPuzzlink,
}
