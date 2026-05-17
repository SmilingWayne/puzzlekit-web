import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { cellKey, edgeKey, lineKey } from '../domain/ir/keys'
import { createMasyuPuzzle } from '../domain/ir/masyu'
import { createSlitherPuzzle } from '../domain/ir/slither'
import type { EdgeMark, PuzzleIR } from '../domain/ir/types'
import { rebuildTraceStatsCache } from '../domain/difficulty/traceStats'
import {
  DEFAULT_MASYU_SAMPLE_URL,
  DEFAULT_SOLVE_CHUNK_SIZE,
  useSolverStore,
} from '../features/solver/solverStore'
import { WorkspacePage } from './WorkspacePage'
import type { RuleStep } from '../domain/rules/types'

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

const renderWorkspace = () =>
  render(
    <BrowserRouter>
      <WorkspacePage />
    </BrowserRouter>,
  )

describe('WorkspacePage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    useSolverStore.getState().setSolveChunkSize(DEFAULT_SOLVE_CHUNK_SIZE)
  })

  it('renders workspace key sections', () => {
    renderWorkspace()
    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editor/i })).toHaveAttribute('href', '/editor')
    expect(screen.getByText(/input & controls/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reasoning steps/i })).toBeInTheDocument()
    expect(screen.getByText(/live stats/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/solver board scroll area/i)).toHaveClass('board-scroll-shell')
    const zoom = screen.getByLabelText(/board zoom/i)
    expect(zoom).toHaveValue('100')
    expect(zoom).toHaveAttribute('min', '20')
    expect(zoom).toHaveAttribute('max', '200')
    expect(zoom).toHaveAttribute('step', '5')
    expect(screen.getByRole('button', { name: /show all/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const boardTools = document.querySelector('.board-header-tools')
    expect(boardTools?.children[0]?.tagName).toBe('SMALL')
    expect(boardTools?.children[1]).toHaveClass('board-zoom-control')
    const typeControls = document.querySelector('.type-row-controls')
    expect(typeControls?.children[1]?.querySelector('[aria-label="Show Slitherlink rules"]')).not.toBeNull()
    expect(typeControls?.children[2]?.querySelector('[aria-label="Show Slitherlink legend"]')).not.toBeNull()
  })

  it('loads the default Masyu sample when selecting Masyu', async () => {
    renderWorkspace()

    fireEvent.change(screen.getByDisplayValue('Slitherlink'), { target: { value: 'masyu' } })

    await waitFor(() => {
      const state = useSolverStore.getState()
      expect(state.pluginId).toBe('masyu')
      expect(state.sourceUrl).toBe(DEFAULT_MASYU_SAMPLE_URL)
      expect(state.currentPuzzle.puzzleType).toBe('masyu')
      expect(state.currentPuzzle.rows).toBe(5)
      expect(state.currentPuzzle.cols).toBe(5)
    })
    expect(screen.getByDisplayValue(DEFAULT_MASYU_SAMPLE_URL)).toBeInTheDocument()
  })

  it('opens slitherlink board legend from the puzzle type row', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink legend/i }))

    const legendDialog = screen.getByRole('dialog', { name: /slitherlink legend/i })
    expect(legendDialog).toBeInTheDocument()
    expect(legendDialog).toHaveClass('board-legend-panel')
    expect(legendDialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText('Only One')).toBeInTheDocument()
    expect(screen.getByText('NOT ONE')).toBeInTheDocument()
    expect(screen.getByText('NOT ZERO')).toBeInTheDocument()
    expect(screen.getByText('NOT TWO')).toBeInTheDocument()
    expect(screen.getByText('YELLOW')).toBeInTheDocument()
    expect(screen.getByText('GREEN')).toBeInTheDocument()
    expect(screen.getByText(/ONLY have ONE connected/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot have exactly one connected/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot have ZERO connected/i)).toBeInTheDocument()
    expect(screen.getByText(/cannot both be connected/i)).toBeInTheDocument()
    expect(screen.getByText(/outside the final loop/i)).toBeInTheDocument()
    expect(screen.getByText(/inside the final loop/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/legend canvas/i)).toHaveLength(6)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /slitherlink legend/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink legend/i }))
    fireEvent.click(screen.getByRole('button', { name: /close slitherlink legend/i }))
    expect(screen.queryByRole('dialog', { name: /slitherlink legend/i })).not.toBeInTheDocument()
  })

  it('shows import errors in a closeable dialog with expandable details', () => {
    renderWorkspace()

    fireEvent.change(screen.getByPlaceholderText(/paste puzz\.link/i), {
      target: { value: 'https://example.com/p?slither/3/3/g0h' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import url/i }))

    const importDialog = screen.getByRole('alertdialog', { name: /import failed/i })
    expect(importDialog).toBeInTheDocument()
    expect(importDialog).toHaveAttribute('aria-modal', 'true')
    expect(importDialog.parentElement).toHaveClass('import-error-overlay')
    expect(screen.getByText(/could not be imported/i)).toBeInTheDocument()

    const detailsText = screen.getByText(/unsupported slitherlink url/i)
    expect(detailsText).not.toBeVisible()

    fireEvent.click(screen.getByText(/show error details/i))
    expect(detailsText).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('alertdialog', { name: /import failed/i })).not.toBeInTheDocument()
  })

  it('opens export controls as a closeable popout', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /export/i }))

    const exportDialog = screen.getByRole('dialog', { name: /export puzzle/i })
    expect(exportDialog).toBeInTheDocument()
    expect(exportDialog).toHaveClass('export-panel')
    expect(exportDialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByRole('button', { name: /^close export$/i })).toHaveAttribute(
      'data-active',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /^close export$/i }))
    expect(screen.queryByRole('dialog', { name: /export puzzle/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByRole('button', { name: /close export panel/i }))
    expect(screen.queryByRole('dialog', { name: /export puzzle/i })).not.toBeInTheDocument()
  })

  it('opens slitherlink rules as a closeable puzzle info popout', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink rules/i }))

    const infoDialog = screen.getByRole('dialog', { name: /slitherlink rules/i })
    expect(infoDialog).toBeInTheDocument()
    expect(infoDialog).toHaveClass('puzzle-info-panel')
    expect(infoDialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText(/draw lines along the edges/i)).toBeInTheDocument()
    expect(screen.getByText(/the loop cannot branch off or cross itself/i)).toBeInTheDocument()
    expect(screen.getByText(/a number indicates the amount of edges/i)).toBeInTheDocument()
    expect(screen.queryByText(/in puzzlekit/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/before example canvas/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/after example canvas/i)).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /slitherlink rules/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink rules/i }))
    fireEvent.click(screen.getByRole('button', { name: /close slitherlink rules/i }))
    expect(screen.queryByRole('dialog', { name: /slitherlink rules/i })).not.toBeInTheDocument()
  })

  it('shows slitherlink puzzle stats from the solver board title', () => {
    const puzzle = createSlitherPuzzle(10, 10)
    puzzle.cells[cellKey(0, 0)] = { clue: { kind: 'number', value: 0 } }
    puzzle.cells[cellKey(0, 1)] = { clue: { kind: 'number', value: 1 } }
    puzzle.cells[cellKey(0, 2)] = { clue: { kind: 'number', value: 1 } }
    puzzle.cells[cellKey(0, 3)] = { clue: { kind: 'number', value: 2 } }
    puzzle.cells[cellKey(0, 4)] = { clue: { kind: 'number', value: 3 } }
    puzzle.cells[cellKey(0, 5)] = { clue: { kind: 'number', value: '?' } }
    useSolverStore.getState().loadPuzzle(puzzle, { pluginId: 'slitherlink' })

    renderWorkspace()

    const boardTools = document.querySelector('.board-header-tools')
    expect(boardTools?.children[0]?.tagName).toBe('SMALL')
    expect(boardTools?.children[1]).toHaveClass('board-zoom-control')

    fireEvent.focus(screen.getByRole('button', { name: /show puzzle stats/i }))

    const statsTooltip = screen.getByRole('tooltip')
    expect(within(statsTooltip).getByText('Numbered Cells')).toBeInTheDocument()
    expect(within(statsTooltip).getByText('Numbered cells 5 / 100 (5.0%)')).toBeInTheDocument()
    expect(within(statsTooltip).getByText('Clue 0')).toBeInTheDocument()
    expect(within(statsTooltip).getByText('Clue 1')).toBeInTheDocument()
    expect(within(statsTooltip).getByText('40.0%')).toBeInTheDocument()
  })

  it('shows solve progress, then terminal report, and keeps solve buttons disabled after close', async () => {
    const puzzle = createSolvedLoopPuzzle()
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      solveProgress: null,
      terminalReport: null,
    }))
    useSolverStore.getState().setSolveChunkSize(100)

    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: /next 100 steps/i }))

    expect(screen.getByRole('dialog', { name: /solving to end/i })).toBeInTheDocument()
    expect(screen.getByText(/step 0 \/ 100/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /solving to end/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('dialog', { name: /solved/i })).toBeInTheDocument()
    expect(screen.getByText(/total time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next 100 steps/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next 100 steps/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /reset replay/i }))
    expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /next 100 steps/i })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /next 100 steps/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /solving to end/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /reset replay/i }))

    expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /next 100 steps/i })).not.toBeDisabled()
  })

  it('updates solve chunk controls and uses the chosen progress total', async () => {
    const puzzle = createSolvedLoopPuzzle()
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      solveProgress: null,
      terminalReport: null,
    }))

    renderWorkspace()

    expect(screen.getByRole('button', { name: /next 50 steps/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/step chunk/i), { target: { value: '25' } })
    expect(screen.getByRole('button', { name: /next 25 steps/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next 25 steps/i }))
    expect(screen.getByRole('dialog', { name: /solving to end/i })).toBeInTheDocument()
    expect(screen.getByText(/step 0 \/ 25/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /solving to end/i })).not.toBeInTheDocument()
    })
  })

  it('uses the replay timeline to jump to an existing step', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    expect(screen.getByText(/showing 2 \/ 2/i)).toBeInTheDocument()

    const timeline = screen.getByLabelText(/replay timeline/i)
    fireEvent.change(timeline, { target: { value: '1' } })

    expect(screen.getByText(/showing 1 \/ 1/i)).toBeInTheDocument()
    expect(timeline).toHaveValue('1')
    expect(screen.getByText(/step 1 \/ 2/i)).toBeInTheDocument()
  })

  it('uses the live stats timeline to jump through the generated trace', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    const statsTimeline = screen.getByLabelText(/trace timeline/i)
    const liveStats = screen.getByLabelText(/live stats/i)
    expect(statsTimeline).toHaveValue('2')
    expect(within(liveStats).getByText(/board progress/i)).toBeInTheDocument()
    expect(within(liveStats).getByText(/inference coverage/i)).toBeInTheDocument()

    fireEvent.change(statsTimeline, { target: { value: '1' } })

    expect(statsTimeline).toHaveValue('1')
    expect(screen.getByLabelText(/replay timeline/i)).toHaveValue('1')
    expect(screen.getByText(/showing 1 \/ 1/i)).toBeInTheDocument()
  })

  it('updates live stats chart legends as steps are generated and replayed', () => {
    const firstEdge = edgeKey([0, 0], [0, 1])
    const secondEdge = edgeKey([0, 1], [0, 2])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'rule-a',
        ruleName: 'Rule A',
        message: 'first',
        diffs: [{ kind: 'edge', edgeKey: firstEdge, from: 'unknown', to: 'line' }],
        affectedCells: [],
        affectedEdges: [firstEdge],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
      {
        id: 'step-2',
        ruleId: 'rule-b',
        ruleName: 'Rule B',
        message: 'second',
        diffs: [
          { kind: 'edge', edgeKey: secondEdge, from: 'unknown', to: 'blank' },
          { kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' },
        ],
        affectedCells: [cellKey(0, 0)],
        affectedEdges: [secondEdge],
        affectedSectors: [],
        timestamp: Date.now() + 1,
        durationMs: 1,
      },
    ]
    const puzzle = createSlitherPuzzle(1, 2)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps,
      traceStatsCache: rebuildTraceStatsCache(puzzle, steps),
      pointer: 2,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      solveProgress: null,
      terminalReport: null,
      isRunning: false,
    }))

    renderWorkspace()

    const liveStats = screen.getByLabelText(/live stats/i)
    const progressChart = within(liveStats).getByLabelText(/^board progress$/i)
    const coverageChart = within(liveStats).getByLabelText(/^inference coverage$/i)
    expect(within(progressChart).getByText(/progress 28\.6%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/edge 28\.6%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell 50\.0%/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/trace timeline/i), { target: { value: '1' } })

    expect(within(progressChart).getByText(/progress 14\.3%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/edge 14\.3%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell 0\.0%/i)).toBeInTheDocument()
  })

  it('shows the optimized live stats summary and charts', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    const liveStats = screen.getByLabelText(/live stats/i)
    expect(within(liveStats).getByText(/current step/i)).toBeInTheDocument()
    expect(within(liveStats).getByText(/unique rules applied/i)).toBeInTheDocument()
    expect(within(liveStats).getByText(/total rule time/i)).toBeInTheDocument()
    expect(within(liveStats).queryByText(/total diffs/i)).not.toBeInTheDocument()
    expect(within(liveStats).queryByText(/rule applications/i)).not.toBeInTheDocument()
    expect(within(liveStats).queryByText(/trace progress/i)).not.toBeInTheDocument()

    expect(within(liveStats).getByLabelText(/^board progress$/i)).toBeInTheDocument()
    const coverageChart = within(liveStats).getByLabelText(/^inference coverage$/i)
    expect(within(coverageChart).getByText(/edge/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/vertex/i)).toBeInTheDocument()
    expect(within(coverageChart).queryByText(/sector/i)).not.toBeInTheDocument()
  })

  it('keeps future trace rules visible in live stats while browsing an earlier prefix', () => {
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'rule-a',
        ruleName: 'Rule A',
        message: 'first',
        diffs: [{ kind: 'edge', edgeKey: edgeKey([0, 0], [0, 1]), from: 'unknown', to: 'line' }],
        affectedCells: [],
        affectedEdges: [edgeKey([0, 0], [0, 1])],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 2,
      },
      {
        id: 'step-2',
        ruleId: 'rule-b',
        ruleName: 'Rule B',
        message: 'second',
        diffs: [{ kind: 'cell', cellKey: cellKey(0, 0), fromFill: null, toFill: 'green' }],
        affectedCells: [cellKey(0, 0)],
        affectedEdges: [],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 3,
      },
    ]
    const puzzle = createSlitherPuzzle(1, 1)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps,
      traceStatsCache: rebuildTraceStatsCache(puzzle, steps),
      pointer: 1,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      solveProgress: null,
      terminalReport: null,
      isRunning: false,
    }))

    renderWorkspace()

    const liveStats = screen.getByLabelText(/live stats/i)
    expect(within(liveStats).getByText('Rule A')).toBeInTheDocument()
    expect(within(liveStats).queryByText('Rule B')).not.toBeInTheDocument()

    fireEvent.click(within(liveStats).getByRole('button', { name: /view details/i }))

    expect(within(liveStats).getByText('Rule B')).toBeInTheDocument()
    const ruleBRow = within(liveStats).getByText('Rule B').closest('tr')
    expect(ruleBRow).not.toBeNull()
    expect(within(ruleBRow as HTMLElement).getAllByText('0')).toHaveLength(1)
    expect(within(ruleBRow as HTMLElement).getByText('-')).toBeInTheDocument()
  })

  it('shows a disabled live stats timeline before steps are generated', () => {
    renderWorkspace()

    const statsTimeline = screen.getByLabelText(/trace timeline/i)
    expect(statsTimeline).toBeDisabled()
    expect(screen.getByText(/no generated steps yet/i)).toBeInTheDocument()
  })

  it('rewinds by the configured step chunk and clamps at the start', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    expect(screen.getByText(/showing 3 \/ 3/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/step chunk/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /^prev 2 steps$/i }))

    expect(screen.getByText(/showing 1 \/ 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/replay timeline/i)).toHaveValue('1')

    fireEvent.click(screen.getByRole('button', { name: /^prev 2 steps$/i }))

    expect(screen.getByText(/showing 0 \/ 0/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/replay timeline/i)).toHaveValue('0')
  })

  it('keeps vertex numbering as a solver-only display toggle', () => {
    renderWorkspace()

    const vertexToggle = screen.getByLabelText(/show vertex numbering overlay/i)
    expect(vertexToggle).toBeInTheDocument()
    fireEvent.click(vertexToggle)

    expect(vertexToggle).toBeChecked()
    expect(screen.queryByRole('button', { name: /custom grid/i })).not.toBeInTheDocument()
  })

  it('does not expose clue editing on the solver board', () => {
    renderWorkspace()

    const before = useSolverStore.getState().initialPuzzle.cells[cellKey(0, 0)]?.clue
    fireEvent.keyDown(screen.getByText(/puzzle board/i), { key: '3' })

    expect(screen.queryByText(/click without dragging selects a cell/i)).not.toBeInTheDocument()
    expect(useSolverStore.getState().initialPuzzle.cells[cellKey(0, 0)]?.clue).toBe(before)
  })

  it('keeps wheel scrolling separate from solver board zoom', () => {
    renderWorkspace()

    const canvas = screen.getByLabelText(/slitherlink solver canvas/i)
    const zoom = screen.getByLabelText(/board zoom/i)

    expect(fireEvent.wheel(canvas, { deltaY: -120 })).toBe(true)
    expect(zoom).toHaveValue('100')
  })

  it('zooms the solver board with the slider', () => {
    renderWorkspace()

    const canvas = screen.getByLabelText(/slitherlink solver canvas/i)
    const zoom = screen.getByLabelText(/board zoom/i)

    fireEvent.change(zoom, { target: { value: '150' } })

    expect(zoom).toHaveValue('150')
    expect(canvas).toHaveStyle({ width: '378px', height: '378px' })
  })

  it('draws row and column labels around the solver grid', () => {
    const fillText = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        strokeRect: () => {},
        fillText,
        arc: () => {},
        fill: () => {},
        setLineDash: () => {},
      } as unknown as CanvasRenderingContext2D,
    )
    const puzzle = createSlitherPuzzle(2, 4)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedEdges: [],
      highlightedCells: [],
      highlightedColorCells: [],
      solveProgress: null,
      terminalReport: null,
    }))

    renderWorkspace()

    const labels = fillText.mock.calls.map(([text]) => text)
    expect(labels).toContain('R1')
    expect(labels).toContain('R2')
    expect(labels).toContain('C1')
    expect(labels).toContain('C4')
  })

  it('toggles reasoning steps between recent 30 and all entries from the header', () => {
    const steps: RuleStep[] = Array.from({ length: 35 }, (_, index) => ({
      id: `step-${index + 1}`,
      ruleId: 'test-rule',
      ruleName: 'Test Rule',
      message: `step ${index + 1}`,
      diffs: [],
      affectedCells: [],
      affectedEdges: [],
      affectedSectors: [],
      timestamp: Date.now() + index,
      durationMs: 1,
    }))
    useSolverStore.setState((state) => ({
      ...state,
      steps,
      traceStatsCache: rebuildTraceStatsCache(state.initialPuzzle, steps),
      pointer: steps.length,
      terminalReport: null,
    }))

    renderWorkspace()

    expect(screen.getByText(/showing 30 \/ 35/i)).toBeInTheDocument()
    expect(screen.getByText(/^35\. test rule$/i)).toBeInTheDocument()
    expect(screen.queryByText(/^5\. test rule$/i)).not.toBeInTheDocument()

    const showAll = screen.getByRole('button', { name: /show all/i })
    fireEvent.click(showAll)

    expect(showAll).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/showing 35 \/ 35/i)).toBeInTheDocument()
    expect(screen.getByText(/^1\. test rule$/i)).toBeInTheDocument()
  })

  it('summarizes Slitherlink edge updates in reasoning steps', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    const edge = edgeKey([0, 0], [0, 1])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'edge-rule',
        ruleName: 'Edge Rule',
        message: 'draw edge',
        diffs: [{ kind: 'edge', edgeKey: edge, from: 'unknown', to: 'line' }],
        affectedCells: [],
        affectedEdges: [edge],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
    ]
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps,
      traceStatsCache: rebuildTraceStatsCache(puzzle, steps),
      pointer: 1,
      terminalReport: null,
    }))

    renderWorkspace()

    expect(screen.getByText('edge updates: 1')).toBeInTheDocument()
  })

  it('summarizes Masyu line updates and line crosses in reasoning steps', () => {
    const puzzle = createMasyuPuzzle(2, 3)
    const line = lineKey([0, 0], [0, 1])
    const cross = lineKey([0, 1], [0, 2])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'line-rule',
        ruleName: 'Line Rule',
        message: 'line and cross',
        diffs: [
          { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
          { kind: 'line', lineKey: cross, from: 'unknown', to: 'blank' },
        ],
        affectedCells: [],
        affectedEdges: [],
        affectedLines: [line, cross],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
      },
    ]
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps,
      traceStatsCache: rebuildTraceStatsCache(puzzle, steps),
      pointer: 1,
      terminalReport: null,
    }))

    renderWorkspace()

    expect(screen.getByText('line updates: 1, line crosses: 1')).toBeInTheDocument()
  })

  it('keeps replay and puzzle I/O controls in the intended compact order', () => {
    renderWorkspace()

    const previousButton = screen.getByRole('button', { name: /prev step/i })
    const nextButton = screen.getByRole('button', { name: /next step/i })
    expect(
      previousButton.compareDocumentPosition(nextButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const previousChunkButton = screen.getByRole('button', { name: /prev 50 steps/i })
    const timeline = screen.getByLabelText(/replay timeline/i)
    expect(
      nextButton.compareDocumentPosition(previousChunkButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      previousChunkButton.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const importButton = screen.getByRole('button', { name: /import url/i })
    const resetButton = screen.getByRole('button', { name: /reset replay/i })
    const exportButton = screen.getByRole('button', { name: /export/i })
    expect(importButton.closest('.control-group')).toBe(resetButton.closest('.control-group'))
    expect(importButton.closest('.control-group')).toBe(exportButton.closest('.control-group'))
  })

  it('shows stalled decided edge count and coverage in one stat', () => {
    const puzzle = createSlitherPuzzle(1, 1)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      solveProgress: null,
      terminalReport: {
        status: 'stalled',
        stepCount: 0,
        totalDurationMs: 1234,
        reasons: ['No line edges have been drawn.'],
        stats: {
          totalUnits: 4,
          lineUnits: 1,
          blankUnits: 1,
          unknownUnits: 2,
          decidedUnits: 2,
          decidedRatio: 0.5,
          unitLabel: 'Edges',
          totalEdges: 4,
          lineEdges: 1,
          blankEdges: 1,
          unknownEdges: 2,
          decidedEdges: 2,
          decidedEdgeRatio: 0.5,
        },
      },
    }))

    renderWorkspace()

    expect(screen.getByRole('dialog', { name: /no further progress/i })).toBeInTheDocument()
    expect(screen.getByText('2 / 4, 50.0%')).toBeInTheDocument()
    expect(screen.getByText('1.23 s')).toBeInTheDocument()
    expect(screen.queryByText(/^Coverage$/i)).not.toBeInTheDocument()
  })

  it('shows Masyu stalled decided line count and coverage in one stat', () => {
    const puzzle = createMasyuPuzzle(1, 2)
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      solveProgress: null,
      terminalReport: {
        status: 'stalled',
        stepCount: 0,
        totalDurationMs: 500,
        reasons: ['No line segments have been drawn.'],
        stats: {
          totalUnits: 1,
          lineUnits: 0,
          blankUnits: 0,
          unknownUnits: 1,
          decidedUnits: 0,
          decidedRatio: 0,
          unitLabel: 'Lines',
        },
      },
    }))

    renderWorkspace()

    expect(screen.getByText(/^Decided Lines$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Unknown Lines$/i)).toBeInTheDocument()
    expect(screen.getByText('0 / 1, 0.0%')).toBeInTheDocument()
  })
})
