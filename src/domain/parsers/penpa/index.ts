import { decompressSync, strFromU8 } from 'fflate'
import { cellKey } from '../../ir/keys'
import { createMasyuPuzzle } from '../../ir/masyu'
import { createSlitherPuzzle } from '../../ir/slither'
import type { NumberClueValue, PuzzleIR } from '../../ir/types'
import type { PuzzleFormatAdapter } from '../types'

const PENPA_PREFIX = 'm=edit&p='

type PenpaInput = {
  mode: string
  pPayload: string
  rawParams: Record<string, string[]>
  extraParams: Record<string, string[]>
  normalizedFragment: string
}

type PenpaBoard = {
  number?: Record<string, [unknown, unknown, unknown]>
  symbol?: Record<string, [unknown, unknown, unknown]>
}

type PenpaDimensions = {
  rows: number
  cols: number
  rowsWithMargins: number
  colsWithMargins: number
  realRows: number
  realCols: number
  margins: [number, number, number, number]
}

type PenpaDecodedPuzzle = {
  input: string
  penpaInput: PenpaInput
  parts: string[]
  header: string[]
  genre: string
  dimensions: PenpaDimensions
  board: PenpaBoard
}

const COMPRESS_SUB: [string, string][] = [
  ['z', 'zZ'],
  ['"qa"', 'z9'],
  ['"pu_q"', 'zQ'],
  ['"pu_a"', 'zA'],
  ['"grid"', 'zG'],
  ['"edit_mode"', 'zM'],
  ['"surface"', 'zS'],
  ['"line"', 'zL'],
  ['"lineE"', 'zE'],
  ['"wall"', 'zW'],
  ['"cage"', 'zC'],
  ['"number"', 'zN'],
  ['"symbol"', 'zY'],
  ['"special"', 'zP'],
  ['"board"', 'zB'],
  ['"command_redo"', 'zR'],
  ['"command_undo"', 'zU'],
  ['"command_replay"', 'z8'],
  ['"numberS"', 'z1'],
  ['"freeline"', 'zF'],
  ['"freelineE"', 'z2'],
  ['"thermo"', 'zT'],
  ['"arrows"', 'z3'],
  ['"direction"', 'zD'],
  ['"squareframe"', 'z0'],
  ['"polygon"', 'z5'],
  ['"deletelineE"', 'z4'],
  ['"killercages"', 'z6'],
  ['"nobulbthermo"', 'z7'],
  ['"_a"', 'z_'],
  ['null', 'zO'],
]

const decodeUriComponentSafe = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const parsePenpaQuery = (fragment: string): [string, string][] => {
  if (!fragment) {
    return []
  }
  return fragment
    .split('&')
    .filter(Boolean)
    .map((token) => {
      const separatorIndex = token.indexOf('=')
      if (separatorIndex < 0) {
        return ['p', decodeUriComponentSafe(token)]
      }
      const key = token.slice(0, separatorIndex)
      const value = token.slice(separatorIndex + 1)
      return [decodeUriComponentSafe(key), decodeUriComponentSafe(value)]
    })
}

export const parsePenpaInput = (input: string): PenpaInput => {
  const raw = input.trim()
  if (!raw) {
    throw new Error('Penpa input must be a non-empty string.')
  }

  let fragment = ''
  let query = ''
  if (raw.includes('://')) {
    const url = new URL(raw)
    fragment = url.hash.replace(/^#/, '').trim()
    query = url.search.replace(/^\?/, '').trim()
  } else {
    const hashIndex = raw.indexOf('#')
    fragment = hashIndex >= 0 ? raw.slice(hashIndex + 1).trim() : ''
    const queryIndex = raw.indexOf('?')
    query = queryIndex >= 0 ? raw.slice(queryIndex + 1).trim() : ''
  }

  if (fragment.startsWith('?')) {
    fragment = fragment.slice(1)
  }
  if (query.startsWith('?')) {
    query = query.slice(1)
  }

  let candidate = fragment || query
  if (!candidate) {
    candidate = raw.includes('#') ? raw.split('#', 2)[1] : raw
    candidate = candidate.replace(/^#/, '').trim()
    if (candidate.startsWith('?')) {
      candidate = candidate.slice(1)
    }
  }

  let mode = 'edit'
  let pPayload = ''
  let paramsPairs: [string, string][] = []
  if (candidate.includes('=') || candidate.includes('&')) {
    paramsPairs = parsePenpaQuery(candidate)
    for (const [key, value] of paramsPairs) {
      if (key === 'm') {
        mode = value || 'edit'
      } else if (key === 'p' && !pPayload) {
        pPayload = value
      }
    }
    if (!pPayload && paramsPairs.every(([key]) => key !== 'm' && key !== 'p')) {
      pPayload = candidate
      paramsPairs = []
    }
  } else {
    pPayload = candidate
  }

  if (!pPayload) {
    throw new Error('Cannot parse Penpa payload from input.')
  }

  const rawParams: Record<string, string[]> = {}
  for (const [key, value] of paramsPairs) {
    rawParams[key] = [...(rawParams[key] ?? []), value]
  }
  const extraParams = Object.fromEntries(
    Object.entries(rawParams).filter(([key]) => key !== 'm' && key !== 'p'),
  )

  return {
    mode,
    pPayload,
    rawParams,
    extraParams,
    normalizedFragment: [
      `m=${mode}`,
      `p=${pPayload}`,
      ...Object.entries(extraParams).flatMap(([key, values]) =>
        values.map((value) => `${key}=${value}`),
      ),
    ].join('&'),
  }
}

const base64ToBytes = (payload: string): Uint8Array => {
  const binary = globalThis.atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const expandPenpaJson = (value: string): string =>
  COMPRESS_SUB.reduce((current, [original, abbreviation]) => {
    return current.split(abbreviation).join(original)
  }, value)

const parseGenreTag = (raw: string | undefined): string => {
  if (!raw) {
    throw new Error('Penpa payload does not include a puzzle genre tag.')
  }
  const parsed = JSON.parse(raw.replaceAll("'", '"')) as unknown
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || !parsed[0]) {
    throw new Error('Penpa payload does not include a puzzle genre tag.')
  }
  return parsed[0]
}

const normalizePuzzleType = (raw: string): string => {
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '')
  if (normalized === 'slither' || normalized === 'slitherlink') {
    return 'slitherlink'
  }
  if (
    normalized === 'masyu' ||
    normalized === 'mashu' ||
    normalized === 'pearl'
  ) {
    return 'masyu'
  }
  return raw.toLowerCase()
}

const indexToCellCoord = (
  index: number,
  realRows: number,
  realCols: number,
): [number, number] => {
  const boardSize = realRows * realCols
  const cellIndex = index % boardSize
  return [Math.floor(cellIndex / realCols) - 2, (cellIndex % realCols) - 2]
}

const decodePenpaPayload = (payload: string): string[] => {
  try {
    return strFromU8(decompressSync(base64ToBytes(payload))).split('\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Invalid Penpa URL: unable to decode compressed payload (${message}).`,
    )
  }
}

const decodePenpaBoard = (rawBoard: string | undefined): PenpaBoard => {
  if (!rawBoard) {
    throw new Error('Invalid Penpa payload: missing board data.')
  }
  try {
    return JSON.parse(expandPenpaJson(rawBoard)) as PenpaBoard
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Invalid Penpa payload: board data is not readable JSON (${message}).`,
    )
  }
}

const parsePenpaDimensions = (
  header: string[],
  rawMargins: string | undefined,
): PenpaDimensions => {
  const margins = JSON.parse(rawMargins ?? '[0,0,0,0]') as [
    number,
    number,
    number,
    number,
  ]
  const [topMargin, bottomMargin, leftMargin, rightMargin] = margins
  const rowsWithMargins = Number(header[2])
  const colsWithMargins = Number(header[1])
  const rows = rowsWithMargins - topMargin - bottomMargin
  const cols = colsWithMargins - leftMargin - rightMargin
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows <= 0 ||
    cols <= 0
  ) {
    throw new Error('Invalid Penpa payload: grid dimensions are not valid.')
  }

  return {
    rows,
    cols,
    rowsWithMargins,
    colsWithMargins,
    realRows: rowsWithMargins + 4,
    realCols: colsWithMargins + 4,
    margins,
  }
}

const decodePenpaPuzzle = (input: string): PenpaDecodedPuzzle => {
  const penpaInput = parsePenpaInput(input)
  const parts = decodePenpaPayload(penpaInput.pPayload)
  const header = parts[0]?.split(',') ?? []
  if (header[0] !== 'square') {
    throw new Error(`Unsupported Penpa grid type: ${header[0] ?? 'unknown'}.`)
  }

  const genre = normalizePuzzleType(parseGenreTag(parts[17]))
  const dimensions = parsePenpaDimensions(header, parts[1])
  const board = decodePenpaBoard(parts[3])

  return {
    input,
    penpaInput,
    parts,
    header,
    genre,
    dimensions,
    board,
  }
}

const applyPenpaMetadata = (
  puzzle: PuzzleIR,
  decoded: PenpaDecodedPuzzle,
  puzzleType: 'slitherlink' | 'masyu',
): void => {
  puzzle.gridType = 'square'
  puzzle.puzzleType = puzzleType
  puzzle.title = decoded.header[15]?.replace(/^Title: /, '') ?? puzzleType
  puzzle.author = decoded.header[16]?.replace(/^Author: /, '') ?? ''
  puzzle.source = 'penpa'
  puzzle.metadata.originalUrl = decoded.input
  puzzle.metadata.penpaMode = decoded.penpaInput.mode
  puzzle.metadata.penpaParams = decoded.penpaInput.rawParams
  puzzle.metadata.penpaExtraParams = decoded.penpaInput.extraParams
  puzzle.metadata.penpaNormalizedFragment =
    decoded.penpaInput.normalizedFragment
}

export const decodeSlitherFromPenpa = (input: string): PuzzleIR => {
  const decoded = decodePenpaPuzzle(input)
  const {
    genre,
    dimensions: { rows, cols, realRows, realCols },
    board,
  } = decoded
  if (genre !== 'slitherlink') {
    throw new Error(
      `Unsupported Penpa puzzle type: ${genre}. Only Slitherlink import is supported.`,
    )
  }

  const puzzle = createSlitherPuzzle(rows, cols)
  applyPenpaMetadata(puzzle, decoded, 'slitherlink')

  for (const [index, numberData] of Object.entries(board.number ?? {})) {
    const rawValue = String(numberData[0] ?? '')
    if (!rawValue) {
      continue
    }
    if (rawValue.includes('_')) {
      continue
    }
    const numeric = Number(rawValue)
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 3) {
      throw new Error(`Invalid Slitherlink clue in Penpa payload: ${rawValue}.`)
    }
    const [r, c] = indexToCellCoord(Number(index), realRows, realCols)
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      continue
    }
    puzzle.cells[cellKey(r, c)] = {
      clue: {
        kind: 'number',
        value: numeric as NumberClueValue,
      },
    }
  }

  return puzzle
}

const classifyMasyuSymbol = (
  symbolIndex: number,
  symbolType: string,
): 'white' | 'black' | null => {
  if (
    (symbolType === 'circle_L' || symbolType === 'circle') &&
    (symbolIndex === 0 || symbolIndex === 1)
  ) {
    return 'white'
  }
  if (symbolType === 'circle_M' && symbolIndex === 8) {
    return 'white'
  }
  if (
    (symbolType === 'circle_L' ||
      symbolType === 'circle' ||
      symbolType === 'circle_M') &&
    symbolIndex === 2
  ) {
    return 'black'
  }
  return null
}

export const decodeMasyuFromPenpa = (input: string): PuzzleIR => {
  const decoded = decodePenpaPuzzle(input)
  const {
    genre,
    dimensions: { rows, cols, realRows, realCols },
    board,
  } = decoded
  if (genre !== 'masyu') {
    throw new Error(
      `Unsupported Penpa puzzle type: ${genre}. Only Masyu import is supported.`,
    )
  }

  const puzzle = createMasyuPuzzle(rows, cols)
  applyPenpaMetadata(puzzle, decoded, 'masyu')

  for (const [index, symbolData] of Object.entries(board.symbol ?? {})) {
    const symbolIndex = Number(symbolData[0])
    const symbolType = String(symbolData[1] ?? '')
    if (!Number.isInteger(symbolIndex) || !symbolType) {
      continue
    }

    const pearlColor = classifyMasyuSymbol(symbolIndex, symbolType)
    if (!pearlColor) {
      continue
    }

    const [r, c] = indexToCellCoord(Number(index), realRows, realCols)
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      continue
    }
    puzzle.cells[cellKey(r, c)] = {
      clue: {
        kind: 'pearl',
        color: pearlColor,
      },
    }
  }

  return puzzle
}

export const penpaAdapter: PuzzleFormatAdapter = {
  decode: (input: string): PuzzleIR => {
    const decoded = decodePenpaPuzzle(input)
    if (decoded.genre === 'slitherlink') {
      return decodeSlitherFromPenpa(input)
    }
    if (decoded.genre === 'masyu') {
      return decodeMasyuFromPenpa(input)
    }
    throw new Error(`Unsupported Penpa puzzle type: ${decoded.genre}.`)
  },
  encode: (): string => {
    throw new Error('Penpa URL encoding is reserved and not implemented yet.')
  },
}

export const PENPA_EDIT_PREFIX = PENPA_PREFIX
