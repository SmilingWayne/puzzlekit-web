import { create } from 'zustand'
import type { DifficultySnapshot } from '../../domain/difficulty/types'
import { clonePuzzle } from '../../domain/ir/normalize'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import type { PuzzleIR } from '../../domain/ir/types'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { buildPuzzleFromSteps, rewindPuzzleByStep, runNextRule } from '../../domain/rules/engine'
import {
  analyzeSlitherCompletion,
  type SlitherCompletionReport,
} from '../../domain/rules/slither/completion'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/18/10/c82chcdgcbgd63c173ah6aibi81b71cdjcdcb123ddbcbjb37d16didi8dh161c36cdgcagdbh28bb'
export const DEFAULT_SOLVE_CHUNK_SIZE = 50
export const MAX_SOLVE_CHUNK_SIZE = 1000

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
  solveChunkSize: number
  terminalReport: TerminalSolveReport | null
  includeVertexNumbers: boolean
  loadPuzzle: (puzzle: PuzzleIR, options?: LoadPuzzleOptions) => void
  importFromUrl: (url: string, pluginId?: string) => void
  setSourceUrl: (url: string) => void
  setPluginId: (pluginId: string) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (targetPointer: number) => void
  setSolveChunkSize: (value: number) => void
  solveAll: (limit?: number) => Promise<void>
  resetTimeline: () => void
  setIncludeVertexNumbers: (enabled: boolean) => void
}

export type LoadPuzzleOptions = {
  pluginId?: string
  sourceUrl?: string
}

const buildStateFromSteps = (initialPuzzle: PuzzleIR, steps: RuleStep[], pointer: number): PuzzleIR => {
  return buildPuzzleFromSteps(initialPuzzle, steps, pointer)
}

const getActiveSteps = (steps: RuleStep[], pointer: number): RuleStep[] => steps.slice(0, pointer)

const getStepColorCells = (step?: RuleStep): string[] =>
  step?.diffs.flatMap((diff) => (diff.kind === 'cell' && diff.toFill !== null ? [diff.cellKey] : [])) ?? []

const yieldToBrowser = (): Promise<void> => new Promise((resolve) => globalThis.setTimeout(resolve, 0))

const clampPointer = (pointer: number, stepsLength: number): number => {
  if (!Number.isFinite(pointer)) {
    return 0
  }
  return Math.min(stepsLength, Math.max(0, Math.floor(pointer)))
}

const clampSolveChunkSize = (value: number, fallback = DEFAULT_SOLVE_CHUNK_SIZE): number => {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(MAX_SOLVE_CHUNK_SIZE, Math.max(1, Math.floor(value)))
}

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
  solveChunkSize: DEFAULT_SOLVE_CHUNK_SIZE,
  terminalReport: null,
  includeVertexNumbers: false,
  setPluginId: (pluginId) => set({ pluginId, solveProgress: null, terminalReport: null }),
  setSourceUrl: (sourceUrl) => set({ sourceUrl }),
  setIncludeVertexNumbers: (includeVertexNumbers) => set({ includeVertexNumbers }),
  loadPuzzle: (puzzle, options) => {
    const nextInitial = clonePuzzle(puzzle)
    set({
      pluginId: options?.pluginId ?? puzzle.puzzleType,
      sourceUrl: options?.sourceUrl ?? '',
      importError: undefined,
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
      get().loadPuzzle(parsed, { pluginId: activePluginId, sourceUrl: url })
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
  goToStep: (targetPointer) => {
    const { initialPuzzle, steps, isRunning } = get()
    if (isRunning) {
      return
    }
    const nextPointer = clampPointer(targetPointer, steps.length)
    const currentStep = steps[nextPointer - 1]
    set({
      currentPuzzle: buildStateFromSteps(initialPuzzle, steps, nextPointer),
      pointer: nextPointer,
      highlightedCells: currentStep?.affectedCells ?? [],
      highlightedColorCells: getStepColorCells(currentStep),
      highlightedEdges: currentStep?.affectedEdges ?? [],
      terminalReport: null,
    })
  },
  setSolveChunkSize: (value) => {
    const fallback = get().solveChunkSize || DEFAULT_SOLVE_CHUNK_SIZE
    set({ solveChunkSize: clampSolveChunkSize(value, fallback) })
  },
  solveAll: (limit) => {
    if (get().terminalReport || get().isRunning) {
      return Promise.resolve()
    }
    const solveLimit = clampSolveChunkSize(limit ?? get().solveChunkSize)
    set({ isRunning: true, solveProgress: { current: 0, total: solveLimit } })
    return (async () => {
      await yieldToBrowser()
      let loops = 0
      let before = get().pointer
      while (loops < solveLimit) {
        get().nextStep()
        loops += 1
        const after = get().pointer
        set({ solveProgress: { current: loops, total: solveLimit } })
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
