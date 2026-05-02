import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey, edgeKey } from '../../domain/ir/keys'
import { semanticEquals } from '../../domain/ir/normalize'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import type { EdgeMark, PuzzleIR } from '../../domain/ir/types'
import { buildPuzzleFromSteps } from '../../domain/rules/engine'
import {
  DEFAULT_SOLVE_CHUNK_SIZE,
  MAX_SOLVE_CHUNK_SIZE,
  sumRuleStepDurationMs,
  useSolverStore,
  type TerminalSolveReport,
} from './solverStore'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'

const markEdge = (puzzle: PuzzleIR, edge: string, mark: EdgeMark): void => {
  puzzle.edges[edge] = { ...puzzle.edges[edge], mark }
}

const createSolvedLoopPuzzle = (): PuzzleIR => {
  const puzzle = createSlitherPuzzle(1, 1)
  markEdge(puzzle, edgeKey([0, 0], [0, 1]), 'line')
  markEdge(puzzle, edgeKey([1, 0], [1, 1]), 'line')
  markEdge(puzzle, edgeKey([0, 0], [1, 0]), 'line')
  markEdge(puzzle, edgeKey([0, 1], [1, 1]), 'line')
  return puzzle
}

const mockTerminalReport: TerminalSolveReport = {
  status: 'stalled',
  stepCount: 0,
  totalDurationMs: 0,
  reasons: ['No line edges have been drawn.'],
  stats: {
    totalEdges: 4,
    lineEdges: 0,
    blankEdges: 0,
    unknownEdges: 4,
    decidedEdges: 0,
    decidedEdgeRatio: 0,
  },
}

describe('solver timeline behavior', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    useSolverStore.getState().setSolveChunkSize(DEFAULT_SOLVE_CHUNK_SIZE)
  })

  it('drops future branch after previous step and re-next', () => {
    const store = useSolverStore.getState()
    store.nextStep()
    expect(useSolverStore.getState().steps.length).toBe(1)
    expect(useSolverStore.getState().pointer).toBe(1)

    store.prevStep()
    expect(useSolverStore.getState().pointer).toBe(0)
    expect(useSolverStore.getState().steps.length).toBe(1)

    store.nextStep()
    expect(useSolverStore.getState().pointer).toBe(1)
    expect(useSolverStore.getState().steps.length).toBe(1)
  })

  it('keeps prevStep state consistent with replayed prefix state', () => {
    const store = useSolverStore.getState()
    store.nextStep()
    store.nextStep()
    const stateBeforePrev = useSolverStore.getState()
    expect(stateBeforePrev.pointer).toBeGreaterThan(0)

    store.prevStep()
    const stateAfterPrev = useSolverStore.getState()
    const replayed = buildPuzzleFromSteps(stateAfterPrev.initialPuzzle, stateAfterPrev.steps, stateAfterPrev.pointer)

    expect(semanticEquals(stateAfterPrev.currentPuzzle, replayed)).toBe(true)
  })

  it('goToStep jumps to a replayed prefix and restores matching highlights', () => {
    const initialPuzzle = createSlitherPuzzle(1, 2)
    const firstEdge = edgeKey([0, 0], [0, 1])
    const secondEdge = edgeKey([0, 1], [0, 2])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'test-rule-a',
        ruleName: 'Test Rule A',
        message: 'first',
        diffs: [{ kind: 'edge', edgeKey: firstEdge, from: 'unknown', to: 'line' }],
        affectedCells: [cellKey(0, 0)],
        affectedEdges: [firstEdge],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
      {
        id: 'step-2',
        ruleId: 'test-rule-b',
        ruleName: 'Test Rule B',
        message: 'second',
        diffs: [{ kind: 'edge', edgeKey: secondEdge, from: 'unknown', to: 'blank' }],
        affectedCells: [cellKey(0, 1)],
        affectedEdges: [secondEdge],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
    ]
    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle,
      currentPuzzle: buildPuzzleFromSteps(initialPuzzle, steps, 2),
      steps,
      pointer: 2,
      highlightedCells: steps[1].affectedCells,
      highlightedColorCells: [],
      highlightedEdges: steps[1].affectedEdges,
      terminalReport: mockTerminalReport,
      isRunning: false,
    }))

    useSolverStore.getState().goToStep(1)
    const after = useSolverStore.getState()

    expect(after.pointer).toBe(1)
    expect(semanticEquals(after.currentPuzzle, buildPuzzleFromSteps(initialPuzzle, steps, 1))).toBe(true)
    expect(after.highlightedCells).toEqual([cellKey(0, 0)])
    expect(after.highlightedEdges).toEqual([firstEdge])
    expect(after.terminalReport).toBeNull()
  })

  it('goToStep clamps out-of-range targets and clears highlights at step zero', () => {
    const initialPuzzle = createSlitherPuzzle(1, 1)
    const topEdge = edgeKey([0, 0], [0, 1])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        message: 'test',
        diffs: [{ kind: 'edge', edgeKey: topEdge, from: 'unknown', to: 'line' }],
        affectedCells: [cellKey(0, 0)],
        affectedEdges: [topEdge],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
    ]
    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle,
      currentPuzzle: buildPuzzleFromSteps(initialPuzzle, steps, 1),
      steps,
      pointer: 1,
      highlightedCells: steps[0].affectedCells,
      highlightedColorCells: [],
      highlightedEdges: steps[0].affectedEdges,
      isRunning: false,
    }))

    useSolverStore.getState().goToStep(-10)
    expect(useSolverStore.getState().pointer).toBe(0)
    expect(useSolverStore.getState().highlightedCells).toEqual([])
    expect(useSolverStore.getState().highlightedColorCells).toEqual([])
    expect(useSolverStore.getState().highlightedEdges).toEqual([])
    expect(semanticEquals(useSolverStore.getState().currentPuzzle, initialPuzzle)).toBe(true)

    useSolverStore.getState().goToStep(99)
    expect(useSolverStore.getState().pointer).toBe(steps.length)
    expect(useSolverStore.getState().highlightedEdges).toEqual([topEdge])
  })

  it('goToStep does not move while solve is running', () => {
    useSolverStore.setState((state) => ({
      ...state,
      isRunning: true,
      pointer: 0,
    }))

    useSolverStore.getState().goToStep(1)

    expect(useSolverStore.getState().pointer).toBe(0)
    useSolverStore.setState((state) => ({ ...state, isRunning: false }))
  })
})

describe('solve chunk sizing', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    useSolverStore.getState().setSolveChunkSize(DEFAULT_SOLVE_CHUNK_SIZE)
  })

  it('clamps solve chunk size to the supported range', () => {
    const store = useSolverStore.getState()

    store.setSolveChunkSize(0)
    expect(useSolverStore.getState().solveChunkSize).toBe(1)

    store.setSolveChunkSize(-5)
    expect(useSolverStore.getState().solveChunkSize).toBe(1)

    store.setSolveChunkSize(12.8)
    expect(useSolverStore.getState().solveChunkSize).toBe(12)

    store.setSolveChunkSize(MAX_SOLVE_CHUNK_SIZE + 1)
    expect(useSolverStore.getState().solveChunkSize).toBe(MAX_SOLVE_CHUNK_SIZE)

    store.setSolveChunkSize(25)
    store.setSolveChunkSize(Number.NaN)
    expect(useSolverStore.getState().solveChunkSize).toBe(25)
  })

  it('solveAll defaults to solveChunkSize and still accepts an explicit limit', async () => {
    const state = useSolverStore.getState()
    const originalNextStep = state.nextStep
    let calls = 0
    useSolverStore.setState({
      ...state,
      pointer: 0,
      steps: [],
      currentPuzzle: state.initialPuzzle,
      terminalReport: null,
      isRunning: false,
      nextStep: () => {
        calls += 1
        useSolverStore.setState((current) => ({ ...current, pointer: current.pointer + 1 }))
      },
    })

    await useSolverStore.getState().solveAll()
    expect(calls).toBe(DEFAULT_SOLVE_CHUNK_SIZE)

    calls = 0
    useSolverStore.setState((current) => ({ ...current, pointer: 0, terminalReport: null }))
    await useSolverStore.getState().solveAll(100)
    expect(calls).toBe(100)

    useSolverStore.setState((current) => ({ ...current, nextStep: originalNextStep }))
  })
})

describe('custom slither grid and clue editing', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
  })

  it('applyCustomSlitherGrid clears steps and sourceUrl', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().steps.length).toBeGreaterThan(0)
    useSolverStore.getState().applyCustomSlitherGrid(5, 7)
    const after = useSolverStore.getState()
    expect(after.steps.length).toBe(0)
    expect(after.pointer).toBe(0)
    expect(after.sourceUrl).toBe('')
    expect(after.currentPuzzle.rows).toBe(5)
    expect(after.currentPuzzle.cols).toBe(7)
  })

  it('applyCustomSlitherGrid clamps size to 3–100', () => {
    useSolverStore.getState().applyCustomSlitherGrid(1, 200)
    const after = useSolverStore.getState()
    expect(after.currentPuzzle.rows).toBe(3)
    expect(after.currentPuzzle.cols).toBe(100)
  })

  it('setSlitherCellClue resets timeline', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().pointer).toBeGreaterThan(0)
    useSolverStore.getState().setSlitherCellClue(cellKey(0, 0), 2)
    const after = useSolverStore.getState()
    expect(after.pointer).toBe(0)
    expect(after.steps.length).toBe(0)
    expect(after.currentPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })
  })

  it('importFromUrl replaces a partial custom solve', () => {
    useSolverStore.getState().applyCustomSlitherGrid(4, 4)
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().currentPuzzle.rows).toBe(4)
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    const after = useSolverStore.getState()
    expect(after.currentPuzzle.rows).toBe(3)
    expect(after.currentPuzzle.cols).toBe(3)
    expect(after.steps.length).toBe(0)
    expect(after.sourceUrl).toBe(SAMPLE_URL)
  })
})

describe('solver terminal reports', () => {
  beforeEach(() => {
    const puzzle = createSolvedLoopPuzzle()
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      terminalReport: null,
    }))
  })

  it('writes a terminal report when nextStep finds no available rule', async () => {
    await useSolverStore.getState().solveAll(100)
    const terminalState = useSolverStore.getState()
    useSolverStore.setState((state) => ({ ...state, terminalReport: null }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport).toMatchObject({
      status: 'solved',
      stepCount: terminalState.pointer,
    })
    expect(useSolverStore.getState().terminalReport?.totalDurationMs).toBeGreaterThanOrEqual(0)
  })

  it('writes a terminal report when solveAll reaches no progress', async () => {
    const pending = useSolverStore.getState().solveAll(100)
    expect(useSolverStore.getState().solveProgress).toEqual({ current: 0, total: 100 })
    await pending

    expect(useSolverStore.getState().terminalReport).toMatchObject({
      status: 'solved',
      stepCount: useSolverStore.getState().pointer,
    })
    expect(useSolverStore.getState().terminalReport?.totalDurationMs).toBeGreaterThanOrEqual(0)
    expect(useSolverStore.getState().isRunning).toBe(false)
    expect(useSolverStore.getState().solveProgress).toBeNull()
  })

  it('clears terminal report when moving back in the timeline', () => {
    const step: RuleStep = {
      id: 'step-1',
      ruleId: 'test-rule',
      ruleName: 'Test Rule',
      message: 'test',
      diffs: [
        {
          kind: 'edge',
          edgeKey: edgeKey([0, 0], [0, 1]),
          from: 'unknown',
          to: 'line',
        },
      ],
      affectedCells: [],
      affectedEdges: [edgeKey([0, 0], [0, 1])],
      affectedSectors: [],
      timestamp: Date.now(),
      durationMs: 12,
    }
    const initialPuzzle = createSlitherPuzzle(1, 1)
    const currentPuzzle = createSolvedLoopPuzzle()
    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle,
      currentPuzzle,
      steps: [step],
      pointer: 1,
      terminalReport: mockTerminalReport,
      solveProgress: null,
    }))

    useSolverStore.getState().prevStep()

    expect(useSolverStore.getState().terminalReport).toBeNull()
  })

  it('clears terminal report when resetting, importing, editing clues, or applying a custom grid', () => {
    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().resetTimeline()
    expect(useSolverStore.getState().terminalReport).toBeNull()

    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    expect(useSolverStore.getState().terminalReport).toBeNull()

    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().setSlitherCellClue(cellKey(0, 0), 2)
    expect(useSolverStore.getState().terminalReport).toBeNull()

    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().applyCustomSlitherGrid(5, 5)
    expect(useSolverStore.getState().terminalReport).toBeNull()
  })

  it('sums only provided active step durations and treats missing durations as zero', () => {
    const steps = [
      { durationMs: 10 },
      {},
      { durationMs: 2.5 },
    ] as RuleStep[]

    expect(sumRuleStepDurationMs(steps)).toBe(12.5)
  })
})

describe('solver store cell color replay', () => {
  it('replays cell fill diffs and tracks highlightedColorCells', () => {
    const colorCell = cellKey(0, 0)
    const mockStep: RuleStep = {
      id: 'step-1',
      ruleId: 'color-edge-propagation',
      ruleName: 'Color-Edge Propagation',
      message: 'test',
      diffs: [
        {
          kind: 'cell',
          cellKey: colorCell,
          fromFill: null,
          toFill: 'green',
        },
      ],
      affectedCells: [colorCell],
      affectedEdges: [],
      affectedSectors: [],
      timestamp: Date.now(),
      durationMs: 7,
    }
    const state = useSolverStore.getState()
    const originalNextStep = state.nextStep
    useSolverStore.setState({
      ...state,
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      nextStep: () => {
        const now = useSolverStore.getState()
        useSolverStore.setState({
          ...now,
          currentPuzzle: {
            ...now.currentPuzzle,
            cells: {
              ...now.currentPuzzle.cells,
              [colorCell]: {
                ...now.currentPuzzle.cells[colorCell],
                fill: 'green',
              },
            },
          },
          steps: [mockStep],
          pointer: 1,
          highlightedCells: mockStep.affectedCells,
          highlightedColorCells: [colorCell],
          highlightedEdges: [],
        })
      },
    })

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBe('green')
    expect(useSolverStore.getState().highlightedColorCells).toEqual([colorCell])

    useSolverStore.getState().prevStep()
    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBeUndefined()
    expect(useSolverStore.getState().highlightedColorCells).toEqual([])

    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBe('green')
    expect(useSolverStore.getState().highlightedColorCells).toEqual([colorCell])

    useSolverStore.setState((prev) => ({ ...prev, nextStep: originalNextStep }))
  })
})
