import { z } from 'zod'
import { cellKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import type { PuzzleIR } from '../../ir/types'
import type { PuzzleFormatAdapter } from '../types'

const PUZZLINK_HOSTS = new Set(['puzz.link', 'pzplus.tck.mn', 'pzv.jp'])
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
      throw new Error('Only puzz.link, pzplus.tck.mn, and pzv.jp URLs are supported in this adapter.')
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

export const encodeMasyuToPuzzlink = (): string => {
  throw new Error('Masyu puzz.link export is not implemented yet.')
}

export const masyuPuzzlinkAdapter: PuzzleFormatAdapter = {
  decode: decodeMasyuFromPuzzlink,
  encode: encodeMasyuToPuzzlink,
}
