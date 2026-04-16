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
export type SectorMark = 'unknown' | 'onlyOne' | 'notOne' | 'notTwo' | 'notZero'

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
  mark: SectorMark
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
