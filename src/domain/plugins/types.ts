import type { PuzzleIR } from '../ir/types'
import type { Rule } from '../rules/types'

export type PuzzleHelpExampleEdge = {
  edge: [[row: number, col: number], [row: number, col: number]]
  mark: 'line' | 'blank'
}

export type PuzzleHelpExample = {
  label: string
  description: string
  rows: number
  cols: number
  clues: Array<{ row: number; col: number; value: number | '?' }>
  edges: PuzzleHelpExampleEdge[]
}

export type PuzzleLegendSectorMarker = {
  row: number
  col: number
  corner: 'nw' | 'ne' | 'sw' | 'se'
  kind: 'onlyOne' | 'notOne' | 'notZero' | 'notTwo'
}

export type PuzzleLegendExample = {
  rows: number
  cols: number
  clues?: Array<{ row: number; col: number; value: number | '?' }>
  edges?: PuzzleHelpExampleEdge[]
  filledCells?: Array<{ row: number; col: number; fill: 'green' | 'yellow' }>
  sectors?: PuzzleLegendSectorMarker[]
}

export type PuzzleLegendItem = {
  label: string
  description: string
  example: PuzzleLegendExample
}

export type PuzzleLegendContent = {
  title: string
  items: PuzzleLegendItem[]
}

export type PuzzleHelpContent = {
  title: string
  summary: string
  rules: string[]
  notes?: string[]
  example?: {
    title: string
    before: PuzzleHelpExample
    after: PuzzleHelpExample
  }
}

export type PuzzleStatsItem = {
  label: string
  value: string
  detail?: string
}

export type PuzzleStatsGroup = {
  title: string
  items: PuzzleStatsItem[]
}

export type PuzzleStatsContent = {
  title: string
  summary: string
  groups: PuzzleStatsGroup[]
}

export type PuzzleDisplayOption = {
  id: string
  label: string
  enabledByDefault: boolean
  description?: string
}

export type LiveStatsCoverageSource =
  | 'edge'
  | 'line'
  | 'cell'
  | 'tile'
  | 'vertex'
  | 'sector'

export type LiveStatsCoverageSeries = {
  source: LiveStatsCoverageSource
  label: string
  color: string
}

export type PuzzleLiveStatsConfig = {
  coverageTitle: string
  coverageDescription: string
  coverageSeries: LiveStatsCoverageSeries[]
}

export interface PuzzlePlugin {
  id: string
  displayName: string
  help?: PuzzleHelpContent
  legend?: PuzzleLegendContent
  displayOptions?: PuzzleDisplayOption[]
  liveStats?: PuzzleLiveStatsConfig
  getStats?: (puzzle: PuzzleIR) => PuzzleStatsContent | null
  parse: (input: string) => PuzzleIR
  encode: (puzzle: PuzzleIR) => string
  getRules: () => Rule[]
}
