import { create } from 'zustand'
import { cellKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { clonePuzzle } from '../../domain/ir/normalize'
import {
  createSlitherPuzzle,
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../../domain/ir/slither'
import type { EdgeMark, NumberClueValue, PuzzleIR } from '../../domain/ir/types'
import { puzzleRegistry } from '../../domain/plugins/registry'

export type SlitherClueDraft = NumberClueValue | null
export type MasyuPearlDraft = 'white' | 'black' | null

type EditorStore = {
  pluginId: string
  puzzle: PuzzleIR
  sourceUrl: string
  importError?: string
  setPluginId: (pluginId: string) => void
  createBlankPuzzle: (rows: number, cols: number, pluginId?: string) => void
  createBlankSlither: (rows: number, cols: number) => void
  loadEditorPuzzle: (puzzle: PuzzleIR, options?: { sourceUrl?: string }) => void
  importFromUrl: (url: string) => void
  setSlitherCellClue: (key: string, value: SlitherClueDraft) => void
  setSlitherEdgeMark: (key: string, mark: EdgeMark) => void
  setMasyuCellPearl: (key: string, color: MasyuPearlDraft) => void
  cycleMasyuCellPearl: (key: string) => void
}

const EDITOR_CUSTOM_GRID_MIN = SLITHER_CUSTOM_GRID_MIN
const EDITOR_CUSTOM_GRID_MAX = SLITHER_CUSTOM_GRID_MAX

const clampEditorSize = (value: number): number => {
  if (!Number.isFinite(value)) {
    return EDITOR_CUSTOM_GRID_MIN
  }
  return Math.min(EDITOR_CUSTOM_GRID_MAX, Math.max(EDITOR_CUSTOM_GRID_MIN, Math.floor(value)))
}

const createBlankPuzzleForPlugin = (pluginId: string, rows: number, cols: number): PuzzleIR | null => {
  const clampedRows = clampEditorSize(rows)
  const clampedCols = clampEditorSize(cols)
  if (pluginId === 'slitherlink') {
    return createSlitherPuzzle(clampedRows, clampedCols)
  }
  if (pluginId === 'masyu') {
    return createMasyuPuzzle(clampedRows, clampedCols)
  }
  return null
}

const isCellKeyInPuzzle = (key: string, puzzle: PuzzleIR): boolean => {
  const [row, col] = key.split(',').map(Number)
  return (
    row >= 0 &&
    col >= 0 &&
    row < puzzle.rows &&
    col < puzzle.cols &&
    !Number.isNaN(row) &&
    !Number.isNaN(col)
  )
}

const deleteCellClueIfEmpty = (puzzle: PuzzleIR, key: string): void => {
  if (!puzzle.cells[key]) {
    return
  }
  delete puzzle.cells[key].clue
  if (!puzzle.cells[key].fill && !puzzle.cells[key].shaded && !puzzle.cells[key].symbol) {
    delete puzzle.cells[key]
  }
}

const defaultPuzzle = createSlitherPuzzle(10, 10)

export const useEditorStore = create<EditorStore>((set, get) => ({
  pluginId: 'slitherlink',
  puzzle: defaultPuzzle,
  sourceUrl: '',
  importError: undefined,
  setPluginId: (pluginId) => {
    const puzzle = createBlankPuzzleForPlugin(pluginId, get().puzzle.rows, get().puzzle.cols)
    if (!puzzle) {
      set({ pluginId, importError: undefined })
      return
    }
    set({
      pluginId,
      puzzle,
      sourceUrl: '',
      importError: undefined,
    })
  },
  createBlankPuzzle: (rows, cols, pluginId) => {
    const nextPluginId = pluginId ?? get().pluginId
    const puzzle = createBlankPuzzleForPlugin(nextPluginId, rows, cols)
    if (!puzzle) {
      set({ pluginId: nextPluginId, sourceUrl: '', importError: undefined })
      return
    }
    set({
      pluginId: nextPluginId,
      puzzle,
      sourceUrl: '',
      importError: undefined,
    })
  },
  createBlankSlither: (rows, cols) => {
    get().createBlankPuzzle(rows, cols, 'slitherlink')
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
    if (puzzle.puzzleType !== 'slitherlink' || !isCellKeyInPuzzle(key, puzzle)) {
      return
    }
    const next = clonePuzzle(puzzle)
    if (value === null) {
      deleteCellClueIfEmpty(next, key)
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
  setMasyuCellPearl: (key, color) => {
    const { puzzle } = get()
    if (puzzle.puzzleType !== 'masyu' || !isCellKeyInPuzzle(key, puzzle)) {
      return
    }
    const next = clonePuzzle(puzzle)
    if (color === null) {
      deleteCellClueIfEmpty(next, key)
    } else {
      next.cells[key] = {
        ...next.cells[key],
        clue: { kind: 'pearl', color },
      }
    }
    set({ puzzle: next })
  },
  cycleMasyuCellPearl: (key) => {
    const { puzzle } = get()
    if (puzzle.puzzleType !== 'masyu' || !isCellKeyInPuzzle(key, puzzle)) {
      return
    }
    const current = puzzle.cells[key]?.clue
    const nextColor: MasyuPearlDraft =
      current?.kind !== 'pearl' ? 'white' : current.color === 'white' ? 'black' : null
    get().setMasyuCellPearl(key, nextColor)
  },
}))

export const getEditorCellKey = cellKey
