import { z } from 'zod'
import { cellKey } from '../../ir/keys'
import { createSlitherPuzzle } from '../../ir/slither'
import type { NumberClueValue, PuzzleIR } from '../../ir/types'
import type { PuzzleFormatAdapter } from '../types'

const PUZZLINK_HOST = 'puzz.link'
const typeAlias: Record<string, string> = {
  slither: 'slitherlink',
  slitherlink: 'slitherlink',
  vslither: 'slitherlink',
  tslither: 'slitherlink',
}

const HeaderSchema = z.object({
  puzzleType: z.string(),
  cols: z.coerce.number().int().positive(),
  rows: z.coerce.number().int().positive(),
  body: z.string(),
})

const base36 = '0123456789abcdefghijklmnopqrstuvwxyz'

const number4Decode = (body: string): Record<number, NumberClueValue> => {
  const result: Record<number, NumberClueValue> = {}
  let pos = 0
  for (const ch of body) {
    if (ch === '.') {
      result[pos] = '?'
      pos += 1
      continue
    }
    if (ch >= '0' && ch <= '4') {
      result[pos] = Number(ch)
      pos += 1
      continue
    }
    if (ch >= '5' && ch <= '9') {
      result[pos] = Number(ch) - 5
      pos += 2
      continue
    }
    if (ch >= 'a' && ch <= 'e') {
      result[pos] = Number.parseInt(ch, 16) - 10
      pos += 3
      continue
    }
    const idx = base36.indexOf(ch)
    if (idx >= 16) {
      pos += idx - 16 + 1
      continue
    }
    pos += 1
  }
  return result
}

const getSkipChar = (skipCount: number): string => {
  const encoded = 16 + (skipCount - 1)
  return base36[encoded] ?? 'z'
}

const number4Encode = (
  clueMap: Record<number, NumberClueValue>,
  totalCells: number,
): string => {
  let out = ''
  let i = 0
  while (i < totalCells) {
    const value = clueMap[i]
    if (value === undefined) {
      let skip = 1
      while (i + skip < totalCells && clueMap[i + skip] === undefined && skip < 20) {
        skip += 1
      }
      out += getSkipChar(skip)
      i += skip
      continue
    }

    if (value === '?') {
      out += '.'
      i += 1
      continue
    }

    const numeric = Number(value)
    const canPackOne = clueMap[i + 1] === undefined
    const canPackTwo = clueMap[i + 1] === undefined && clueMap[i + 2] === undefined

    if (canPackTwo) {
      out += base36[numeric + 10]
      i += 3
      continue
    }
    if (canPackOne) {
      out += String(numeric + 5)
      i += 2
      continue
    }
    out += String(numeric)
    i += 1
  }
  return out.replace(/z+$/g, '')
}

const parsePuzzlinkPath = (input: string) => {
  if (input.includes('://')) {
    const url = new URL(input)
    if (!url.hostname.includes(PUZZLINK_HOST)) {
      throw new Error('Only puzz.link URLs are supported in this adapter.')
    }
    const q = decodeURIComponent(url.search.replace(/^\?/, ''))
    if (q.length > 0) {
      return q
    }
    const pathTokens = url.pathname.split('/').filter(Boolean)
    if (pathTokens[0] === 'p') {
      return pathTokens.slice(1).join('/')
    }
    throw new Error('Invalid puzz.link URL query.')
  }
  return input.replace(/^p\?/, '')
}

const parseHeader = (path: string) => {
  const tokens = path.split('/').filter(Boolean)
  if (tokens.length < 4) {
    throw new Error('Malformed puzz.link puzzle path.')
  }
  return HeaderSchema.parse({
    puzzleType: tokens[0],
    cols: tokens[1],
    rows: tokens[2],
    body: tokens.slice(3).join('/'),
  })
}

export const decodeSlitherFromPuzzlink = (input: string): PuzzleIR => {
  const path = parsePuzzlinkPath(input)
  const header = parseHeader(path)
  const normalizedType = typeAlias[header.puzzleType]
  if (normalizedType !== 'slitherlink') {
    throw new Error(`Unsupported puzz.link type: ${header.puzzleType}`)
  }

  const puzzle = createSlitherPuzzle(header.rows, header.cols)
  puzzle.puzzleType = normalizedType
  puzzle.title = normalizedType
  puzzle.source = 'puzz.link'
  puzzle.metadata.originalUrl = input

  const numberMap = number4Decode(header.body)
  for (const [idxStr, raw] of Object.entries(numberMap)) {
    const idx = Number(idxStr)
    const r = Math.floor(idx / header.cols)
    const c = idx % header.cols
    puzzle.cells[cellKey(r, c)] = {
      clue: {
        kind: 'number',
        value: raw,
      },
    }
  }
  return puzzle
}

export const encodeSlitherToPuzzlink = (puzzle: PuzzleIR): string => {
  const cols = puzzle.cols - puzzle.margins[2] - puzzle.margins[3]
  const rows = puzzle.rows - puzzle.margins[0] - puzzle.margins[1]
  const map: Record<number, NumberClueValue> = {}
  for (const [key, cell] of Object.entries(puzzle.cells)) {
    if (cell.clue?.kind !== 'number') {
      continue
    }
    const [r, c] = key.split(',').map(Number)
    const rr = r - puzzle.margins[0]
    const cc = c - puzzle.margins[2]
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
      continue
    }
    const value = cell.clue.value
    if (value !== '?' && (Number(value) < 0 || Number(value) > 4)) {
      continue
    }
    map[rr * cols + cc] = value
  }
  const body = number4Encode(map, rows * cols)
  return `https://puzz.link/p?slither/${cols}/${rows}/${body}`
}

export const slitherPuzzlinkAdapter: PuzzleFormatAdapter = {
  decode: decodeSlitherFromPuzzlink,
  encode: encodeSlitherToPuzzlink,
}
