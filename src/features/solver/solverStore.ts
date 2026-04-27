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
import { buildPuzzleFromSteps, rewindPuzzleByStep, runNextRule } from '../../domain/rules/engine'
import {
  analyzeSlitherCompletion,
  type SlitherCompletionReport,
} from '../../domain/rules/slither/completion'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/18/10/i61ch28cg16dg122cg63bi3ah1di2dcg0bgb1bc6c8bchd8b6cd1cbg2cgb3ci1dh3ci18dg132bg72bg82bh36dg'

export type TerminalSolveReport = SlitherCompletionReport & {
  stepCount: number
  totalDurationMs: number
}

export type SolveProgress = {
  current: number
  total: number
}

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
  solveProgress: SolveProgress | null
  terminalReport: TerminalSolveReport | null
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
  solveAll: (limit?: number) => Promise<void>
  resetTimeline: () => void
  setIncludeVertexNumbers: (enabled: boolean) => void
}

const buildStateFromSteps = (initialPuzzle: PuzzleIR, steps: RuleStep[], pointer: number): PuzzleIR => {
  return buildPuzzleFromSteps(initialPuzzle, steps, pointer)
}

const getActiveSteps = (steps: RuleStep[], pointer: number): RuleStep[] => steps.slice(0, pointer)

const getStepColorCells = (step?: RuleStep): string[] =>
  step?.diffs.flatMap((diff) => (diff.kind === 'cell' && diff.toFill !== null ? [diff.cellKey] : [])) ?? []

const yieldToBrowser = (): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, 0))

export const sumRuleStepDurationMs = (steps: RuleStep[]): number =>
  steps.reduce((sum, step) => sum + (step.durationMs ?? 0), 0)

const buildTerminalReport = (
  pluginId: string,
  puzzle: PuzzleIR,
  activeSteps: RuleStep[],
): TerminalSolveReport | null => {
  if (pluginId !== 'slitherlink') {
    return null
  }
  return {
    ...analyzeSlitherCompletion(puzzle),
    stepCount: activeSteps.length,
    totalDurationMs: sumRuleStepDurationMs(activeSteps),
  }
}

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
  solveProgress: null,
  terminalReport: null,
  includeVertexNumbers: false,
  selectedCellKey: null,
  setPluginId: (pluginId) => set({ pluginId, solveProgress: null, terminalReport: null }),
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
      solveProgress: null,
      terminalReport: null,
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
      solveProgress: null,
      terminalReport: null,
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
        solveProgress: null,
        terminalReport: null,
        selectedCellKey: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ importError: message })
    }
  },
  nextStep: () => {
    const { pluginId, currentPuzzle, steps, pointer, terminalReport } = get()
    if (terminalReport) {
      return
    }
    const plugin = puzzleRegistry.get(pluginId)
    if (!plugin) {
      return
    }
    const activeSteps = getActiveSteps(steps, pointer)
    const { nextPuzzle, step } = runNextRule(currentPuzzle, plugin.getRules(), activeSteps.length + 1)
    if (!step) {
      const report = buildTerminalReport(pluginId, currentPuzzle, activeSteps)
      if (report) {
        set({ terminalReport: report })
      }
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
      terminalReport: null,
    })
  },
  prevStep: () => {
    const { initialPuzzle, currentPuzzle, steps, pointer } = get()
    if (pointer === 0) {
      return
    }
    const stepToUndo = steps[pointer - 1]
    const nextPointer = pointer - 1
    const currentPuzzleAfterUndo = stepToUndo
      ? rewindPuzzleByStep(currentPuzzle, stepToUndo)
      : buildStateFromSteps(initialPuzzle, steps, nextPointer)
    const currentStep = steps[nextPointer - 1]
    set({
      currentPuzzle: currentPuzzleAfterUndo,
      pointer: nextPointer,
      highlightedCells: currentStep?.affectedCells ?? [],
      highlightedColorCells: getStepColorCells(currentStep),
      highlightedEdges: currentStep?.affectedEdges ?? [],
      terminalReport: null,
    })
  },
  solveAll: (limit = 100) => {
    if (get().terminalReport || get().isRunning) {
      return Promise.resolve()
    }
    set({ isRunning: true, solveProgress: { current: 0, total: limit } })
    return (async () => {
      await yieldToBrowser()
      let loops = 0
      let before = get().pointer
      while (loops < limit) {
        get().nextStep()
        loops += 1
        const after = get().pointer
        set({ solveProgress: { current: loops, total: limit } })
        if (after === before || get().terminalReport) {
          break
        }
        before = after
        await yieldToBrowser()
      }
      set({ isRunning: false, solveProgress: null })
    })()
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
      solveProgress: null,
      terminalReport: null,
    })
  },
}))
