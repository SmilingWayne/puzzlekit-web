import { create } from 'zustand'
import { cellKey } from '../../domain/ir/keys'
import { clonePuzzle } from '../../domain/ir/normalize'
import {
  createSlitherPuzzle,
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../../domain/ir/slither'
import type { EdgeMark, NumberClueValue, PuzzleIR } from '../../domain/ir/types'
import { puzzleRegistry } from '../../domain/plugins/registry'

export type SlitherClueDraft = NumberClueValue | null

type EditorStore = {
  pluginId: string
  puzzle: PuzzleIR
  sourceUrl: string
  importError?: string
  setPluginId: (pluginId: string) => void
  createBlankSlither: (rows: number, cols: number) => void
  loadEditorPuzzle: (puzzle: PuzzleIR, options?: { sourceUrl?: string }) => void
  importFromUrl: (url: string) => void
  setSlitherCellClue: (key: string, value: SlitherClueDraft) => void
  setSlitherEdgeMark: (key: string, mark: EdgeMark) => void
}

const clampSlitherSize = (value: number): number => {
  if (!Number.isFinite(value)) {
    return SLITHER_CUSTOM_GRID_MIN
  }
  return Math.min(SLITHER_CUSTOM_GRID_MAX, Math.max(SLITHER_CUSTOM_GRID_MIN, Math.floor(value)))
}

const defaultPuzzle = createSlitherPuzzle(10, 10)

export const useEditorStore = create<EditorStore>((set, get) => ({
  pluginId: 'slitherlink',
  puzzle: defaultPuzzle,
  sourceUrl: '',
  importError: undefined,
  setPluginId: (pluginId) => set({ pluginId, importError: undefined }),
  createBlankSlither: (rows, cols) => {
    const puzzle = createSlitherPuzzle(clampSlitherSize(rows), clampSlitherSize(cols))
    set({
      pluginId: 'slitherlink',
      puzzle,
      sourceUrl: '',
      importError: undefined,
    })
  },
  loadEditorPuzzle: (puzzle, options) => {
    set({
      pluginId: puzzle.puzzleType,
      puzzle: clonePuzzle(puzzle),
      sourceUrl: options?.sourceUrl ?? '',
      importError: undefined,
    })
  },
  importFromUrl: (url) => {
    const plugin = puzzleRegistry.get(get().pluginId)
    if (!plugin) {
      set({ sourceUrl: url, importError: `Plugin "${get().pluginId}" not found.` })
      return
    }
    try {
      const puzzle = plugin.parse(url)
      get().loadEditorPuzzle(puzzle, { sourceUrl: url })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ sourceUrl: url, importError: message })
    }
  },
  setSlitherCellClue: (key, value) => {
    const { puzzle } = get()
    if (puzzle.puzzleType !== 'slitherlink') {
      return
    }
    const [row, col] = key.split(',').map(Number)
    if (
      row < 0 ||
      col < 0 ||
      row >= puzzle.rows ||
      col >= puzzle.cols ||
      Number.isNaN(row) ||
      Number.isNaN(col)
    ) {
      return
    }
    const next = clonePuzzle(puzzle)
    if (value === null) {
      if (next.cells[key]) {
        delete next.cells[key].clue
        if (!next.cells[key].fill && !next.cells[key].shaded && !next.cells[key].symbol) {
          delete next.cells[key]
        }
      }
    } else {
      const numeric = Number(value)
      if (value !== '?' && (!Number.isInteger(numeric) || numeric < 0 || numeric > 3)) {
        return
      }
      next.cells[key] = {
        ...next.cells[key],
        clue: { kind: 'number', value },
      }
    }
    set({ puzzle: next })
  },
  setSlitherEdgeMark: (key, mark) => {
    const { puzzle } = get()
    if (puzzle.puzzleType !== 'slitherlink' || !puzzle.edges[key]) {
      return
    }
    const next = clonePuzzle(puzzle)
    next.edges[key] = { ...next.edges[key], mark }
    set({ puzzle: next })
  },
}))

export const getEditorCellKey = cellKey
