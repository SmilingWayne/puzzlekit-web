import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey, edgeKey, lineKey, tileKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { buildTraceStatsView, rebuildTraceStatsCache } from '../../domain/difficulty/traceStats'
import { semanticEquals } from '../../domain/ir/normalize'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import type { EdgeMark, LineMark, PuzzleIR } from '../../domain/ir/types'
import { buildPuzzleFromSteps } from '../../domain/rules/engine'
import {
  DEFAULT_SOLVE_CHUNK_SIZE,
  DEFAULT_MASYU_SAMPLE_URL,
  MAX_SOLVE_CHUNK_SIZE,
  REPLAY_CHECKPOINT_INTERVAL,
  sumRuleStepDurationMs,
  useSolverStore,
  type TerminalSolveReport,
} from './solverStore'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'

const markEdge = (puzzle: PuzzleIR, edge: string, mark: EdgeMark): void => {
  puzzle.edges[edge] = { ...puzzle.edges[edge], mark }
}

const markLine = (puzzle: PuzzleIR, line: string, mark: LineMark): void => {
  puzzle.lines[line] = { ...puzzle.lines[line], mark }
}

const createSolvedLoopPuzzle = (): PuzzleIR => {
  const puzzle = createSlitherPuzzle(1, 1)
  markEdge(puzzle, edgeKey([0, 0], [0, 1]), 'line')
  markEdge(puzzle, edgeKey([1, 0], [1, 1]), 'line')
  markEdge(puzzle, edgeKey([0, 0], [1, 0]), 'line')
  markEdge(puzzle, edgeKey([0, 1], [1, 1]), 'line')
  return puzzle
}

const createSolvedMasyuLoopPuzzle = (): PuzzleIR => {
  const puzzle = createMasyuPuzzle(4, 4)
  for (let col = 0; col < 3; col += 1) {
    markLine(puzzle, lineKey([0, col], [0, col + 1]), 'line')
    markLine(puzzle, lineKey([3, col], [3, col + 1]), 'line')
  }
  for (let row = 0; row < 3; row += 1) {
    markLine(puzzle, lineKey([row, 0], [row + 1, 0]), 'line')
    markLine(puzzle, lineKey([row, 3], [row + 1, 3]), 'line')
  }
  for (const [key, line] of Object.entries(puzzle.lines)) {
    if (line.mark === 'unknown') {
      markLine(puzzle, key, 'blank')
    }
  }
  puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'pearl', color: 'black' } }
  puzzle.cells[cellKey(0, 1)] = { clue: { kind: 'pearl', color: 'white' } }
  return puzzle
}

const fillAllMasyuTiles = (puzzle: PuzzleIR, fill: 'green' | 'yellow' = 'yellow'): void => {
  for (const key of Object.keys(puzzle.tiles)) {
    puzzle.tiles[key] = { ...puzzle.tiles[key], fill }
  }
}

const makeEdgeSteps = (puzzle: PuzzleIR, count: number): RuleStep[] =>
  Object.keys(puzzle.edges)
    .slice(0, count)
    .map((edge, index) => ({
      id: `step-${index + 1}`,
      ruleId: `test-rule-${index % 3}`,
      ruleName: `Test Rule ${index % 3}`,
      message: `step ${index + 1}`,
      diffs: [
        {
          kind: 'edge' as const,
          edgeKey: edge,
          from: 'unknown' as const,
          to: index % 2 === 0 ? ('line' as const) : ('blank' as const),
        },
      ],
      affectedCells: [],
      affectedEdges: [edge],
      affectedSectors: [],
      timestamp: Date.now() + index,
      durationMs: 1,
    }))

const mockTerminalReport: TerminalSolveReport = {
  status: 'stalled',
  stepCount: 0,
  totalDurationMs: 0,
  reasons: ['No line edges have been drawn.'],
  stats: {
    totalUnits: 4,
    lineUnits: 0,
    blankUnits: 0,
    unknownUnits: 4,
    decidedUnits: 0,
    decidedRatio: 0,
    unitLabel: 'Edges',
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
    expect(useSolverStore.getState().traceStatsCache.points).toHaveLength(2)
    expect(useSolverStore.getState().pointer).toBe(1)

    store.prevStep()
    expect(useSolverStore.getState().pointer).toBe(0)
    expect(useSolverStore.getState().steps.length).toBe(1)

    store.nextStep()
    expect(useSolverStore.getState().pointer).toBe(1)
    expect(useSolverStore.getState().steps.length).toBe(1)
    expect(useSolverStore.getState().traceStatsCache.points).toHaveLength(2)
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
      traceStatsCache: rebuildTraceStatsCache(initialPuzzle, steps),
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
      traceStatsCache: rebuildTraceStatsCache(initialPuzzle, steps),
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

  it('keeps trace stats cache when moving through existing replay states', () => {
    const initialPuzzle = createSlitherPuzzle(1, 1)
    const topEdge = edgeKey([0, 0], [0, 1])
    const step: RuleStep = {
      id: 'step-1',
      ruleId: 'test-rule',
      ruleName: 'Test Rule',
      message: 'test',
      diffs: [{ kind: 'edge', edgeKey: topEdge, from: 'unknown', to: 'line' }],
      affectedCells: [cellKey(0, 0)],
      affectedEdges: [topEdge],
      affectedSectors: [],
      timestamp: Date.now(),
      durationMs: 2,
    }
    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle,
      currentPuzzle: buildPuzzleFromSteps(initialPuzzle, [step], 1),
      steps: [step],
      traceStatsCache: rebuildTraceStatsCache(initialPuzzle, [step]),
      pointer: 1,
      isRunning: false,
    }))

    useSolverStore.getState().goToStep(0)

    expect(useSolverStore.getState().traceStatsCache.points).toHaveLength(2)
    expect(buildTraceStatsView(useSolverStore.getState().traceStatsCache, 0).current.edgeCoverageRatio).toBe(0)

    useSolverStore.getState().goToStep(1)

    expect(buildTraceStatsView(useSolverStore.getState().traceStatsCache, 1).current.edgeCoverageRatio).toBe(0.25)
  })

  it('jumps across a large replay trace and matches a full rebuild', () => {
    const initialPuzzle = createSlitherPuzzle(1, REPLAY_CHECKPOINT_INTERVAL * 3)
    const steps = makeEdgeSteps(initialPuzzle, REPLAY_CHECKPOINT_INTERVAL * 2 + 7)
    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle,
      currentPuzzle: buildPuzzleFromSteps(initialPuzzle, steps, steps.length),
      steps,
      traceStatsCache: rebuildTraceStatsCache(initialPuzzle, steps),
      pointer: steps.length,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      terminalReport: mockTerminalReport,
      isRunning: false,
    }))

    useSolverStore.getState().goToStep(REPLAY_CHECKPOINT_INTERVAL + 3)
    const middle = useSolverStore.getState()
    expect(semanticEquals(middle.currentPuzzle, buildPuzzleFromSteps(initialPuzzle, steps, middle.pointer))).toBe(true)
    expect(middle.pointer).toBe(REPLAY_CHECKPOINT_INTERVAL + 3)
    expect(middle.terminalReport).toBeNull()

    useSolverStore.getState().goToStep(steps.length)
    const end = useSolverStore.getState()
    expect(semanticEquals(end.currentPuzzle, buildPuzzleFromSteps(initialPuzzle, steps, steps.length))).toBe(true)
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

describe('solver puzzle loading', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
  })

  it('loadPuzzle clears replay state and source metadata', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().steps.length).toBeGreaterThan(0)
    const puzzle = createSlitherPuzzle(5, 7)
    useSolverStore.getState().loadPuzzle(puzzle, { pluginId: 'slitherlink' })
    const after = useSolverStore.getState()
    expect(after.steps.length).toBe(0)
    expect(after.traceStatsCache.points).toHaveLength(1)
    expect(after.pointer).toBe(0)
    expect(after.sourceUrl).toBe('')
    expect(after.currentPuzzle.rows).toBe(5)
    expect(after.currentPuzzle.cols).toBe(7)
  })

  it('loadPuzzle clones the incoming puzzle and resets terminal state', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().pointer).toBeGreaterThan(0)
    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    const puzzle = createSlitherPuzzle(4, 4)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 2 } }
    useSolverStore.getState().loadPuzzle(puzzle, {
      pluginId: 'slitherlink',
      sourceUrl: 'editor',
    })
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 3 } }
    const after = useSolverStore.getState()
    expect(after.pointer).toBe(0)
    expect(after.steps.length).toBe(0)
    expect(after.traceStatsCache.points).toHaveLength(1)
    expect(after.terminalReport).toBeNull()
    expect(after.sourceUrl).toBe('editor')
    expect(after.currentPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })
  })

  it('importFromUrl replaces a partial custom solve', () => {
    useSolverStore.getState().loadPuzzle(createSlitherPuzzle(4, 4), { pluginId: 'slitherlink' })
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().currentPuzzle.rows).toBe(4)
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    const after = useSolverStore.getState()
    expect(after.currentPuzzle.rows).toBe(3)
    expect(after.currentPuzzle.cols).toBe(3)
    expect(after.steps.length).toBe(0)
    expect(after.traceStatsCache.points).toHaveLength(1)
    expect(after.sourceUrl).toBe(SAMPLE_URL)
  })

  it('imports the default Masyu sample and produces line decisions', () => {
    useSolverStore.getState().importFromUrl(DEFAULT_MASYU_SAMPLE_URL, 'masyu')
    const loaded = useSolverStore.getState()

    expect(loaded.pluginId).toBe('masyu')
    expect(loaded.sourceUrl).toBe(DEFAULT_MASYU_SAMPLE_URL)
    expect(loaded.currentPuzzle.puzzleType).toBe('masyu')
    expect(loaded.currentPuzzle.rows).toBe(5)
    expect(loaded.currentPuzzle.cols).toBe(5)

    useSolverStore.getState().nextStep()
    const afterStep = useSolverStore.getState()
    expect(afterStep.steps[0]?.ruleName).toBe('White Circle Rule')
    expect(afterStep.highlightedLines.length).toBeGreaterThan(0)
    expect(afterStep.steps[0]?.diffs.some((diff) => diff.kind === 'line')).toBe(true)
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

  it('clears affected highlights when terminal report is solved', async () => {
    const solvedPuzzle = createSolvedLoopPuzzle()
    const highlightedEdge = edgeKey([0, 0], [0, 1])
    const highlightedCell = cellKey(0, 0)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: solvedPuzzle,
      currentPuzzle: solvedPuzzle,
      steps: [],
      pointer: 0,
      highlightedCells: [highlightedCell],
      highlightedColorCells: [highlightedCell],
      highlightedEdges: [highlightedEdge],
      terminalReport: null,
    }))
    await useSolverStore.getState().solveAll(100)
    expect(useSolverStore.getState().terminalReport?.status).toBe('solved')
    useSolverStore.setState((state) => ({
      ...state,
      highlightedCells: [highlightedCell],
      highlightedColorCells: [highlightedCell],
      highlightedEdges: [highlightedEdge],
      terminalReport: null,
    }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport?.status).toBe('solved')
    expect(useSolverStore.getState().highlightedCells).toEqual([])
    expect(useSolverStore.getState().highlightedColorCells).toEqual([])
    expect(useSolverStore.getState().highlightedEdges).toEqual([])
  })

  it('keeps affected highlights when terminal report is stalled', async () => {
    const stalledPuzzle = createSlitherPuzzle(1, 1)
    const highlightedEdge = edgeKey([0, 0], [0, 1])
    const highlightedCell = cellKey(0, 0)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: stalledPuzzle,
      currentPuzzle: stalledPuzzle,
      steps: [],
      pointer: 0,
      highlightedCells: [highlightedCell],
      highlightedColorCells: [highlightedCell],
      highlightedEdges: [highlightedEdge],
      terminalReport: null,
    }))
    await useSolverStore.getState().solveAll(100)
    expect(useSolverStore.getState().terminalReport?.status).toBe('stalled')
    useSolverStore.setState((state) => ({
      ...state,
      highlightedCells: [highlightedCell],
      highlightedColorCells: [highlightedCell],
      highlightedEdges: [highlightedEdge],
      terminalReport: null,
    }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport?.status).toBe('stalled')
    expect(useSolverStore.getState().highlightedCells).toEqual([highlightedCell])
    expect(useSolverStore.getState().highlightedColorCells).toEqual([highlightedCell])
    expect(useSolverStore.getState().highlightedEdges).toEqual([highlightedEdge])
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

  it('writes a Masyu terminal report when nextStep finds no available rule', () => {
    const puzzle = createSolvedMasyuLoopPuzzle()
    fillAllMasyuTiles(puzzle)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedLines: [],
      terminalReport: null,
    }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport).toMatchObject({
      status: 'solved',
      stepCount: 0,
      stats: {
        unitLabel: 'Lines',
      },
    })
  })

  it('clears affected line highlights when a Masyu terminal report is solved', () => {
    const puzzle = createSolvedMasyuLoopPuzzle()
    fillAllMasyuTiles(puzzle)
    const highlightedLine = lineKey([0, 0], [0, 1])
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedLines: [highlightedLine],
      terminalReport: null,
    }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport?.status).toBe('solved')
    expect(useSolverStore.getState().highlightedLines).toEqual([])
  })

  it('keeps affected line highlights when a Masyu terminal report is stalled', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    fillAllMasyuTiles(puzzle)
    const highlightedLine = lineKey([0, 0], [0, 1])
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedLines: [highlightedLine],
      terminalReport: null,
    }))

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().terminalReport?.status).toBe('stalled')
    expect(useSolverStore.getState().highlightedLines).toEqual([highlightedLine])
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

  it('clears terminal report when resetting, importing, or loading a puzzle', () => {
    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().resetTimeline()
    expect(useSolverStore.getState().terminalReport).toBeNull()

    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    expect(useSolverStore.getState().terminalReport).toBeNull()

    useSolverStore.setState((state) => ({ ...state, terminalReport: mockTerminalReport }))
    useSolverStore.getState().loadPuzzle(createSlitherPuzzle(5, 5), { pluginId: 'slitherlink' })
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

  it('replays tile fill diffs and tracks highlightedColorTiles', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const colorTile = tileKey(1, 1)
    const mockStep: RuleStep = {
      id: 'step-1',
      ruleId: 'masyu-tile-color-propagation',
      ruleName: 'Masyu Tile Color Propagation',
      message: 'test',
      diffs: [
        {
          kind: 'tile',
          tileKey: colorTile,
          fromFill: null,
          toFill: 'green',
        },
      ],
      affectedCells: [],
      affectedTiles: [colorTile],
      affectedEdges: [],
      affectedSectors: [],
      timestamp: Date.now(),
      durationMs: 7,
    }

    useSolverStore.setState((state) => ({
      ...state,
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [mockStep],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedColorTiles: [],
      highlightedEdges: [],
      highlightedLines: [],
    }))

    useSolverStore.getState().goToStep(1)

    expect(useSolverStore.getState().currentPuzzle.tiles[colorTile]?.fill).toBe('green')
    expect(useSolverStore.getState().highlightedColorTiles).toEqual([colorTile])

    useSolverStore.getState().goToStep(0)
    expect(useSolverStore.getState().currentPuzzle.tiles[colorTile]?.fill).toBeUndefined()
    expect(useSolverStore.getState().highlightedColorTiles).toEqual([])
  })
})
