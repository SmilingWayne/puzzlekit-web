import { create } from 'zustand'
import type { DifficultySnapshot } from '../../domain/difficulty/types'
import { clonePuzzle } from '../../domain/ir/normalize'
import {
  createSlitherPuzzle,
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../../domain/ir/slither'
import type { NumberClueValue, PuzzleIR } from '../../domain/ir/types'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { runNextRule } from '../../domain/rules/engine'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/18/10/i61ch28cg16dg122cg63bi3ah1di2dcg0bgb1bc6c8bchd8b6cd1cbg2cgb3ci1dh3ci18dg132bg72bg82bh36dg'

type SolverStore = {
  pluginId: string
  sourceUrl: string
  importError?: string
  initialPuzzle: PuzzleIR
  currentPuzzle: PuzzleIR
  steps: RuleStep[]
  pointer: number
  highlightedCells: string[]
  highlightedColorCells: string[]
  highlightedEdges: string[]
  isRunning: boolean
  includeVertexNumbers: boolean
  selectedCellKey: string | null
  importFromUrl: (url: string, pluginId?: string) => void
  setSourceUrl: (url: string) => void
  setPluginId: (pluginId: string) => void
  setSelectedCellKey: (key: string | null) => void
  applyCustomSlitherGrid: (rows: number, cols: number) => void
  setSlitherCellClue: (cellKey: string, value: NumberClueValue | null) => void
  nextStep: () => void
  prevStep: () => void
  solveAll: (limit?: number) => void
  resetTimeline: () => void
  setIncludeVertexNumbers: (enabled: boolean) => void
}

const buildStateFromSteps = (initialPuzzle: PuzzleIR, steps: RuleStep[], pointer: number): PuzzleIR => {
  const clamped = Math.max(0, Math.min(pointer, steps.length))
  const next = clonePuzzle(initialPuzzle)
  for (let i = 0; i < clamped; i += 1) {
    for (const diff of steps[i].diffs) {
      if (diff.kind === 'edge') {
        if (!next.edges[diff.edgeKey]) {
          next.edges[diff.edgeKey] = { mark: diff.to }
        } else {
          next.edges[diff.edgeKey].mark = diff.to
        }
        continue
      }
      if (diff.kind === 'sector') {
        if (!next.sectors[diff.sectorKey]) {
          next.sectors[diff.sectorKey] = { constraintsMask: diff.toMask }
        } else {
          next.sectors[diff.sectorKey].constraintsMask = diff.toMask
        }
        continue
      }
      if (!next.cells[diff.cellKey]) {
        next.cells[diff.cellKey] = {}
      }
      if (diff.toFill === null) {
        delete next.cells[diff.cellKey].fill
      } else {
        next.cells[diff.cellKey].fill = diff.toFill
      }
    }
  }
  return next
}

const getActiveSteps = (steps: RuleStep[], pointer: number): RuleStep[] => steps.slice(0, pointer)

const getStepColorCells = (step?: RuleStep): string[] =>
  step?.diffs.flatMap((diff) => (diff.kind === 'cell' && diff.toFill !== null ? [diff.cellKey] : [])) ?? []

export const buildDifficultySnapshot = (steps: RuleStep[]): DifficultySnapshot => {
  const ruleUsage: Record<string, number> = {}
  let totalEdgeChanges = 0
  for (const step of steps) {
    ruleUsage[step.ruleId] = (ruleUsage[step.ruleId] ?? 0) + 1
    totalEdgeChanges += step.diffs.filter((diff) => diff.kind === 'edge').length
  }

  return {
    totalSteps: steps.length,
    totalEdgeChanges,
    uniqueRules: Object.keys(ruleUsage).length,
    ruleUsage,
  }
}

const getSamplePuzzle = (): PuzzleIR => {
  const plugin = puzzleRegistry.get('slitherlink')
  if (!plugin) {
    return createSlitherPuzzle(3, 3)
  }
  try {
    return plugin.parse(SAMPLE_URL)
  } catch {
    return createSlitherPuzzle(3, 3)
  }
}

const initialPuzzle = getSamplePuzzle()

export const useSolverStore = create<SolverStore>((set, get) => ({
  pluginId: 'slitherlink',
  sourceUrl: SAMPLE_URL,
  initialPuzzle,
  currentPuzzle: clonePuzzle(initialPuzzle),
  steps: [],
  pointer: 0,
  highlightedCells: [],
  highlightedColorCells: [],
  highlightedEdges: [],
  isRunning: false,
  includeVertexNumbers: false,
  selectedCellKey: null,
  setPluginId: (pluginId) => set({ pluginId }),
  setSourceUrl: (sourceUrl) => set({ sourceUrl }),
  setIncludeVertexNumbers: (includeVertexNumbers) => set({ includeVertexNumbers }),
  setSelectedCellKey: (selectedCellKey) => set({ selectedCellKey }),
  applyCustomSlitherGrid: (rows, cols) => {
    if (get().pluginId !== 'slitherlink') {
      return
    }
    const r = Math.min(SLITHER_CUSTOM_GRID_MAX, Math.max(SLITHER_CUSTOM_GRID_MIN, Math.floor(rows)))
    const c = Math.min(SLITHER_CUSTOM_GRID_MAX, Math.max(SLITHER_CUSTOM_GRID_MIN, Math.floor(cols)))
    const next = createSlitherPuzzle(r, c)
    next.puzzleType = 'slitherlink'
    next.title = 'slitherlink'
    set({
      initialPuzzle: next,
      currentPuzzle: clonePuzzle(next),
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      sourceUrl: '',
      importError: undefined,
      selectedCellKey: null,
    })
  },
  setSlitherCellClue: (key, value) => {
    if (get().pluginId !== 'slitherlink') {
      return
    }
    const { initialPuzzle } = get()
    const [row, col] = key.split(',').map(Number)
    if (
      row < 0 ||
      col < 0 ||
      row >= initialPuzzle.rows ||
      col >= initialPuzzle.cols ||
      Number.isNaN(row) ||
      Number.isNaN(col)
    ) {
      return
    }
    const nextInitial = clonePuzzle(initialPuzzle)
    if (value === null) {
      if (nextInitial.cells[key]) {
        delete nextInitial.cells[key]
      }
    } else {
      const numeric = Number(value)
      if (value !== '?' && (!Number.isInteger(numeric) || numeric < 0 || numeric > 3)) {
        return
      }
      nextInitial.cells[key] = {
        ...nextInitial.cells[key],
        clue: { kind: 'number', value },
      }
    }
    set({
      initialPuzzle: nextInitial,
      currentPuzzle: clonePuzzle(nextInitial),
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
    })
  },
  importFromUrl: (url, pluginId) => {
    const activePluginId = pluginId ?? get().pluginId
    const plugin = puzzleRegistry.get(activePluginId)
    if (!plugin) {
      set({ importError: `Plugin "${activePluginId}" not found.` })
      return
    }
    try {
      const parsed = plugin.parse(url)
      set({
        pluginId: activePluginId,
        sourceUrl: url,
        importError: undefined,
        initialPuzzle: parsed,
        currentPuzzle: clonePuzzle(parsed),
        steps: [],
        pointer: 0,
        highlightedCells: [],
        highlightedColorCells: [],
        highlightedEdges: [],
        selectedCellKey: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ importError: message })
    }
  },
  nextStep: () => {
    const { pluginId, currentPuzzle, steps, pointer } = get()
    const plugin = puzzleRegistry.get(pluginId)
    if (!plugin) {
      return
    }
    const activeSteps = getActiveSteps(steps, pointer)
    const { nextPuzzle, step } = runNextRule(currentPuzzle, plugin.getRules(), activeSteps.length + 1)
    if (!step) {
      return
    }
    const nextSteps = [...activeSteps, step]
    set({
      currentPuzzle: nextPuzzle,
      steps: nextSteps,
      pointer: nextSteps.length,
      highlightedCells: step.affectedCells,
      highlightedColorCells: getStepColorCells(step),
      highlightedEdges: step.affectedEdges,
    })
  },
  prevStep: () => {
    const { initialPuzzle, steps, pointer } = get()
    if (pointer === 0) {
      return
    }
    const nextPointer = pointer - 1
    const currentPuzzle = buildStateFromSteps(initialPuzzle, steps, nextPointer)
    const currentStep = steps[nextPointer - 1]
    set({
      currentPuzzle,
      pointer: nextPointer,
      highlightedCells: currentStep?.affectedCells ?? [],
      highlightedColorCells: getStepColorCells(currentStep),
      highlightedEdges: currentStep?.affectedEdges ?? [],
    })
  },
  solveAll: (limit = 300) => {
    set({ isRunning: true })
    let loops = 0
    let before = get().pointer
    while (loops < limit) {
      get().nextStep()
      loops += 1
      const after = get().pointer
      if (after === before) {
        break
      }
      before = after
    }
    set({ isRunning: false })
  },
  resetTimeline: () => {
    const { initialPuzzle } = get()
    set({
      currentPuzzle: clonePuzzle(initialPuzzle),
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
    })
  },
}))
