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

export interface PuzzlePlugin {
  id: string
  displayName: string
  help?: PuzzleHelpContent
  parse: (input: string) => PuzzleIR
  encode: (puzzle: PuzzleIR) => string
  getRules: () => Rule[]
}
