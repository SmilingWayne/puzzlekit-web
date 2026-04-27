export type PuzzleKind = 'slitherlink' | 'masyu' | 'nonogram' | string
export type GridType = 'square' | string

export type Vertex = [row: number, col: number]
export type CellCoord = [row: number, col: number]
export type Margins = [top: number, bottom: number, left: number, right: number]

export type NumberClueValue = number | '?'

export type Clue =
  | { kind: 'number'; value: NumberClueValue }
  | { kind: 'text'; text: string }
  | { kind: 'arrow'; value?: number; direction: string }
  | { kind: 'tapa'; values: number[] }

export type CellState = {
  clue?: Clue
  fill?: string
  shaded?: boolean
  symbol?: {
    symbolIndex: number
    symbolType: string
    symbolStyle: number
  }
}

export type EdgeMark = 'unknown' | 'line' | 'blank'
export type SectorCorner = 'nw' | 'ne' | 'sw' | 'se'
export type SectorLineCount = 0 | 1 | 2
export type SectorConstraintMask = number

export const SECTOR_ALLOW_0: SectorConstraintMask = 1 << 0
export const SECTOR_ALLOW_1: SectorConstraintMask = 1 << 1
export const SECTOR_ALLOW_2: SectorConstraintMask = 1 << 2
export const SECTOR_MASK_ALL: SectorConstraintMask = SECTOR_ALLOW_0 | SECTOR_ALLOW_1 | SECTOR_ALLOW_2
export const SECTOR_MASK_ONLY_0: SectorConstraintMask = SECTOR_ALLOW_0
export const SECTOR_MASK_ONLY_1: SectorConstraintMask = SECTOR_ALLOW_1
export const SECTOR_MASK_ONLY_2: SectorConstraintMask = SECTOR_ALLOW_2
export const SECTOR_MASK_NOT_0: SectorConstraintMask = SECTOR_ALLOW_1 | SECTOR_ALLOW_2
export const SECTOR_MASK_NOT_1: SectorConstraintMask = SECTOR_ALLOW_0 | SECTOR_ALLOW_2
export const SECTOR_MASK_NOT_2: SectorConstraintMask = SECTOR_ALLOW_0 | SECTOR_ALLOW_1

export const sectorMaskAllows = (
  mask: SectorConstraintMask,
  lineCount: SectorLineCount,
): boolean => (mask & (1 << lineCount)) !== 0

export const sectorMaskIntersect = (
  a: SectorConstraintMask,
  b: SectorConstraintMask,
): SectorConstraintMask => a & b

export const sectorMaskIsValid = (mask: SectorConstraintMask): boolean =>
  (mask & SECTOR_MASK_ALL) !== 0

export const sectorMaskIsSingle = (mask: SectorConstraintMask): boolean =>
  mask === SECTOR_MASK_ONLY_0 || mask === SECTOR_MASK_ONLY_1 || mask === SECTOR_MASK_ONLY_2

export const sectorMaskSingleValue = (mask: SectorConstraintMask): SectorLineCount | null => {
  if (mask === SECTOR_MASK_ONLY_0) return 0
  if (mask === SECTOR_MASK_ONLY_1) return 1
  if (mask === SECTOR_MASK_ONLY_2) return 2
  return null
}

export type EdgeState = {
  connected?: boolean
  edgeType?: number
  mark: EdgeMark
  symbol?: {
    symbolIndex: number
    symbolType: string
    symbolStyle: number
  }
}

export type SectorState = {
  constraintsMask: SectorConstraintMask
}

export interface PuzzleIR {
  gridType: GridType
  puzzleType: PuzzleKind
  title: string
  author: string
  source: string
  rows: number
  cols: number
  margins: Margins
  boxes: number[]
  cells: Record<string, CellState>
  edges: Record<string, EdgeState>
  sectors: Record<string, SectorState>
  metadata: Record<string, unknown>
}

export const defaultPuzzleIR = (): PuzzleIR => ({
  gridType: 'square',
  puzzleType: 'slitherlink',
  title: '',
  author: '',
  source: '',
  rows: 0,
  cols: 0,
  margins: [0, 0, 0, 0],
  boxes: [],
  cells: {},
  edges: {},
  sectors: {},
  metadata: {},
})
