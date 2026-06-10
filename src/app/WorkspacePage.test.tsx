import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { cellKey, edgeKey, lineKey, tileKey } from '../domain/ir/keys'
import { createMasyuPuzzle } from '../domain/ir/masyu'
import { createSlitherPuzzle } from '../domain/ir/slither'
import type { EdgeMark, PuzzleIR } from '../domain/ir/types'
import { rebuildTraceStatsCache } from '../domain/difficulty/traceStats'
import {
  DEFAULT_MASYU_SAMPLE_URL,
  DEFAULT_SLITHERLINK_SAMPLE_URL,
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

const resetSlitherDisplayDefaults = (): void => {
  const store = useSolverStore.getState()
  store.setDisplayOption('showCoordinates', false)
  store.setDisplayOption('showCellColors', true)
  store.setDisplayOption('showEdgeCrosses', true)
  store.setDisplayOption('showSectorMarks', true)
  store.setDisplayOption('showVertices', true)
  store.setDisplayOption('showHighlights', true)
  store.setDisplayOption('showGridLabels', true)
}

describe('WorkspacePage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    useSolverStore.getState().setSolveChunkSize(DEFAULT_SOLVE_CHUNK_SIZE)
    resetSlitherDisplayDefaults()
  })

  it('renders workspace key sections', () => {
    renderWorkspace()
    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editor/i })).toHaveAttribute('href', '/editor')
    expect(screen.getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'href',
      'https://github.com/SmilingWayne/puzzlekit-web',
    )
    expect(screen.getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(screen.getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'rel',
      'noreferrer',
    )
    expect(screen.getByText(/input & controls/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reasoning steps/i })).toBeInTheDocument()
    expect(screen.getByText(/live stats/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/solver board scroll area/i)).toHaveClass('board-scroll-shell')
    expect(screen.getByRole('link', { name: /^puzz\.link$/i })).toHaveAttribute(
      'href',
      'https://puzz.link/list.html',
    )
    expect(screen.getByRole('link', { name: /^pzplus$/i })).toHaveAttribute(
      'href',
      'https://pzplus.tck.mn/list.html',
    )
    expect(screen.getByRole('link', { name: /^pzv$/i })).toHaveAttribute('href', 'http://pzv.jp/')
    expect(screen.getByRole('link', { name: /^penpa\+$/i })).toHaveAttribute(
      'href',
      'https://swaroopg92.github.io/penpa-edit/',
    )
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
      expect(state.currentPuzzle.rows).toBe(10)
      expect(state.currentPuzzle.cols).toBe(18)
    })
    expect(screen.getByDisplayValue(DEFAULT_MASYU_SAMPLE_URL)).toBeInTheDocument()
  })

  it('reloads the default Slitherlink sample when switching back from Masyu', async () => {
    renderWorkspace()

    fireEvent.change(screen.getByDisplayValue('Slitherlink'), { target: { value: 'masyu' } })
    await waitFor(() => expect(useSolverStore.getState().pluginId).toBe('masyu'))

    fireEvent.change(screen.getByDisplayValue('Masyu'), { target: { value: 'slitherlink' } })

    await waitFor(() => {
      const state = useSolverStore.getState()
      expect(state.pluginId).toBe('slitherlink')
      expect(state.sourceUrl).toBe(DEFAULT_SLITHERLINK_SAMPLE_URL)
      expect(state.currentPuzzle.puzzleType).toBe('slitherlink')
      expect(state.currentPuzzle.rows).toBe(10)
      expect(state.currentPuzzle.cols).toBe(18)
    })
    expect(screen.getByDisplayValue(DEFAULT_SLITHERLINK_SAMPLE_URL)).toBeInTheDocument()
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

  it('keeps rules and legend popovers exclusive in the puzzle type row', () => {
    renderWorkspace()

    const rulesButton = screen.getByRole('button', { name: /show slitherlink rules/i })
    const legendButton = screen.getByRole('button', { name: /show slitherlink legend/i })

    fireEvent.click(rulesButton)
    expect(screen.getByRole('dialog', { name: /slitherlink rules/i })).toBeInTheDocument()
    expect(rulesButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(legendButton)
    expect(screen.queryByRole('dialog', { name: /slitherlink rules/i })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /slitherlink legend/i })).toBeInTheDocument()
    expect(rulesButton).toHaveAttribute('aria-expanded', 'false')
    expect(legendButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(rulesButton)
    expect(screen.queryByRole('dialog', { name: /slitherlink legend/i })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /slitherlink rules/i })).toBeInTheDocument()
    expect(rulesButton).toHaveAttribute('aria-expanded', 'true')
    expect(legendButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(rulesButton)
    expect(screen.queryByRole('dialog', { name: /slitherlink rules/i })).not.toBeInTheDocument()
    expect(rulesButton).toHaveAttribute('aria-expanded', 'false')
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
    expect(within(liveStats).getByText(/inference coverage/i)).toBeInTheDocument()
    expect(within(liveStats).getByText(/cumulative solve time/i)).toBeInTheDocument()

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
        chainDurationMs: 5,
        ruleApplyMs: 2,
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
        chainDurationMs: 8,
        ruleApplyMs: 3,
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
    const coverageChart = within(liveStats).getByLabelText(/^inference coverage$/i)
    const durationChart = within(liveStats).getByLabelText(/^cumulative solve time$/i)
    expect(within(coverageChart).getByText(/edge decisions 28\.6%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell colors 50\.0%/i)).toBeInTheDocument()
    expect(within(durationChart).getByText(/full step 13\.0 ms \(\+8\.0 ms this step\)/i)).toBeInTheDocument()
    expect(within(durationChart).getByText(/matched rule 5\.0 ms \(\+3\.0 ms this step\)/i)).toBeInTheDocument()
    expect(coverageChart.querySelectorAll('path[data-interpolation="linear"]')).toHaveLength(4)
    expect(durationChart.querySelectorAll('path[data-interpolation="step-after"]')).toHaveLength(2)
    expect(durationChart.querySelector('path[data-interpolation="step-after"]')?.getAttribute('d')?.match(/ L /g)).toHaveLength(4)

    fireEvent.change(screen.getByLabelText(/trace timeline/i), { target: { value: '1' } })

    expect(within(coverageChart).getByText(/edge decisions 14\.3%/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell colors 0\.0%/i)).toBeInTheDocument()
    expect(within(durationChart).getByText(/full step 5\.0 ms \(\+5\.0 ms this step\)/i)).toBeInTheDocument()
    expect(within(durationChart).getByText(/matched rule 2\.0 ms \(\+2\.0 ms this step\)/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/trace timeline/i), { target: { value: '0' } })

    expect(within(durationChart).getByText(/full step 0\.0 ms \(\+0\.0 ms this step\)/i)).toBeInTheDocument()
    expect(within(durationChart).getByText(/matched rule 0\.0 ms \(\+0\.0 ms this step\)/i)).toBeInTheDocument()
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

    expect(within(liveStats).queryByLabelText(/^board progress$/i)).not.toBeInTheDocument()
    const coverageChart = within(liveStats).getByLabelText(/^inference coverage$/i)
    expect(within(coverageChart).getByText(/edge decisions/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/cell colors/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/vertex candidates/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/sector constraints/i)).toBeInTheDocument()
    expect(within(liveStats).getByLabelText(/^cumulative solve time$/i)).toBeInTheDocument()
  })

  it('shows Masyu-specific live stats coverage', () => {
    const puzzle = createMasyuPuzzle(2, 2)
    const line = lineKey([0, 0], [0, 1])
    const tile = tileKey(0, 0)
    const steps: RuleStep[] = [{
      id: 'step-1',
      ruleId: 'masyu-stats',
      ruleName: 'Masyu Stats',
      message: 'update line and tile',
      diffs: [
        { kind: 'line', lineKey: line, from: 'unknown', to: 'line' },
        { kind: 'tile', tileKey: tile, fromFill: null, toFill: 'green' },
      ],
      affectedCells: [],
      affectedEdges: [],
      affectedLines: [line],
      affectedTiles: [tile],
      affectedSectors: [],
      timestamp: Date.now(),
      durationMs: 4,
    }]
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps,
      traceStatsCache: rebuildTraceStatsCache(puzzle, steps),
      pointer: 1,
    }))

    renderWorkspace()

    const coverageChart = within(screen.getByLabelText(/live stats/i)).getByLabelText(/^inference coverage$/i)
    expect(within(coverageChart).getByText(/line decisions/i)).toBeInTheDocument()
    expect(within(coverageChart).getByText(/tile colors/i)).toBeInTheDocument()
    expect(within(coverageChart).queryByText(/edge decisions/i)).not.toBeInTheDocument()
    expect(within(coverageChart).queryByText(/vertex candidates/i)).not.toBeInTheDocument()
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

  it('shows Slitherlink display options in the board display popover', () => {
    renderWorkspace()

    expect(screen.queryByLabelText(/show vertex numbering overlay/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink display options/i }))
    const displayDialog = screen.getByRole('dialog', { name: /display/i })

    const coordinatesToggle = within(displayDialog).getByLabelText(/show coordinates/i)
    expect(coordinatesToggle).not.toBeChecked()
    expect(within(displayDialog).getByLabelText(/show cell colors/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show edge crosses/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show sector marks/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show vertices/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show highlights/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show grid labels/i)).toBeChecked()
    expect(within(displayDialog).queryByLabelText(/show tiles/i)).not.toBeInTheDocument()
    expect(within(displayDialog).queryByLabelText(/show line crosses/i)).not.toBeInTheDocument()

    fireEvent.click(coordinatesToggle)

    expect(coordinatesToggle).toBeChecked()
    expect(useSolverStore.getState().displaySettings.showCoordinates).toBe(true)
    expect(screen.queryByRole('button', { name: /custom grid/i })).not.toBeInTheDocument()
  })

  it('shows Masyu display options without Slitherlink-only controls', async () => {
    renderWorkspace()

    fireEvent.change(screen.getByDisplayValue('Slitherlink'), { target: { value: 'masyu' } })

    await waitFor(() => expect(useSolverStore.getState().pluginId).toBe('masyu'))
    fireEvent.click(screen.getByRole('button', { name: /show masyu display options/i }))
    const displayDialog = screen.getByRole('dialog', { name: /display/i })

    const tilesToggle = within(displayDialog).getByLabelText(/show tiles/i)
    expect(tilesToggle).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show line crosses/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show highlights/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/show grid labels/i)).toBeChecked()
    expect(within(displayDialog).getByLabelText(/^show grid$/i)).toBeChecked()
    expect(within(displayDialog).queryByLabelText(/show cell colors/i)).not.toBeInTheDocument()
    expect(within(displayDialog).queryByLabelText(/show edge crosses/i)).not.toBeInTheDocument()
    expect(within(displayDialog).queryByLabelText(/show sector marks/i)).not.toBeInTheDocument()
    expect(within(displayDialog).queryByLabelText(/show vertices/i)).not.toBeInTheDocument()

    fireEvent.click(tilesToggle)

    expect(tilesToggle).not.toBeChecked()
    expect(useSolverStore.getState().displaySettings.showTiles).toBe(false)
  })

  it('applies plugin defaults while preserving shared display choices across puzzle types', async () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink display options/i }))
    fireEvent.click(screen.getByLabelText(/show highlights/i))
    expect(useSolverStore.getState().displaySettings.showHighlights).toBe(false)

    fireEvent.change(screen.getByDisplayValue('Slitherlink'), { target: { value: 'masyu' } })

    await waitFor(() => {
      const state = useSolverStore.getState()
      expect(state.pluginId).toBe('masyu')
      expect(state.displaySettings.showTiles).toBe(true)
      expect(state.displaySettings.showLineCrosses).toBe(true)
      expect(state.displaySettings.showHighlights).toBe(false)
      expect(state.displaySettings.showCoordinates).toBeUndefined()
    })
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

  it('draws Masyu tile colors on the solver board', () => {
    const fillRect = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {
        clearRect: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        fillRect,
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        strokeRect: () => {},
        fillText: () => {},
        arc: () => {},
        fill: () => {},
        setLineDash: () => {},
      } as unknown as CanvasRenderingContext2D,
    )
    const puzzle = createMasyuPuzzle(2, 2)
    puzzle.tiles[tileKey(1, 1)] = { fill: 'green' }
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'masyu',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      highlightedEdges: [],
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedColorTiles: [],
      solveProgress: null,
      terminalReport: null,
    }))

    renderWorkspace()

    expect(fillRect).toHaveBeenCalledWith(74, 74, 52, 52)
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

  it('opens and navigates the Slitherlink strong inference branch inspector', () => {
    const url =
      'https://puzz.link/p?slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo'
    const store = useSolverStore.getState()
    store.importFromUrl(url, 'slitherlink')
    store.nextStep()
    store.nextStep()
    store.nextStep()

    renderWorkspace()

    const reasoningPanel = screen.getByRole('heading', { name: /reasoning steps/i }).closest('section')
    if (!reasoningPanel) {
      throw new Error('Expected reasoning panel')
    }
    const strongInferenceMessage = within(reasoningPanel).getByText(/Strong inference: edge V\(1, 2\)-V\(1, 3\)/i)
    expect(strongInferenceMessage.firstChild).toHaveTextContent('[View details]')
    expect(within(reasoningPanel).getAllByRole('button', { name: /view details/i })).toHaveLength(1)
    expect(within(reasoningPanel).queryByText(/\[View details\].*Apply Vertex Flow/i)).not.toBeInTheDocument()
    fireEvent.click(within(reasoningPanel).getByRole('button', { name: /view details/i }))

    const dialog = screen.getByRole('dialog', { name: /branch inspector/i })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(/vertex-degree contradiction at V\(5, 3\)/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Branch replay step', { exact: true })).toHaveAttribute('max', '10')
    expect(within(dialog).getByLabelText(/slitherlink branch inspector canvas/i)).toBeInTheDocument()
    const stageDetails = within(dialog).getByLabelText('Current branch replay step', { exact: true })
    expect(within(stageDetails).getByText('Base puzzle', { exact: true })).toBeInTheDocument()
    const inspectorFooter = dialog.querySelector('.branch-inspector-controls')
    expect(inspectorFooter).not.toBeNull()
    expect(inspectorFooter).not.toHaveTextContent(/base puzzle before the inference/i)

    fireEvent.click(within(dialog).getByRole('button', { name: /next/i }))
    expect(within(stageDetails).getByText(/apply the branch assumption/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('tab', { name: /branch b unresolved/i }))
    expect(within(dialog).getByLabelText('Branch replay step', { exact: true })).toHaveAttribute('max', '3')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /branch inspector/i })).not.toBeInTheDocument()
  })

  it('opens and navigates a Masyu strong inference branch inspector', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const assumed = lineKey([1, 0], [1, 1])
    const downstream = lineKey([1, 1], [1, 2])
    const forced = lineKey([0, 1], [1, 1])
    const steps: RuleStep[] = [
      {
        id: 'step-1',
        ruleId: 'masyu-empty-cell-strong-inference',
        ruleName: 'Empty Cell Strong Inference',
        message: 'The assumption contradicts the puzzle, so the alternative is forced.',
        diffs: [{ kind: 'line', lineKey: forced, from: 'unknown', to: 'line' }],
        affectedCells: [cellKey(1, 1)],
        affectedEdges: [],
        affectedLines: [forced],
        affectedSectors: [],
        timestamp: Date.now(),
        durationMs: 1,
        inferenceDetails: {
          kind: 'masyu-strong',
          conclusion: 'opposite-branch',
          basePuzzle: puzzle,
          defaultBranchId: 'assumption',
          branches: [
            {
              id: 'assumption',
              label: 'Assume the east continuation',
              role: 'trial',
              initialDiffs: [
                { kind: 'line', lineKey: assumed, from: 'unknown', to: 'line' },
              ],
              status: 'contradiction',
              traceSteps: [
                {
                  ruleId: 'test-downstream',
                  ruleName: 'Test Downstream',
                  message: 'Extend the trial line.',
                  diffs: [
                    { kind: 'line', lineKey: downstream, from: 'unknown', to: 'line' },
                  ],
                  affectedCells: [cellKey(1, 1)],
                  affectedEdges: [],
                  affectedLines: [downstream],
                  affectedSectors: [],
                },
              ],
              contradiction: {
                kind: 'cell-degree',
                message: 'cell-degree contradiction at C(2, 2)',
                cells: [cellKey(1, 1)],
              },
            },
            {
              id: 'conclusion',
              label: 'Forced conclusion',
              role: 'forced-conclusion',
              initialDiffs: [
                { kind: 'line', lineKey: forced, from: 'unknown', to: 'line' },
              ],
              status: 'forced',
              traceSteps: [],
            },
          ],
        },
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
    const reasoningPanel = screen.getByRole('heading', { name: /reasoning steps/i }).closest('section')
    if (!reasoningPanel) {
      throw new Error('Expected reasoning panel')
    }
    fireEvent.click(within(reasoningPanel).getByRole('button', { name: /view details/i }))

    const dialog = screen.getByRole('dialog', { name: /branch inspector/i })
    expect(within(dialog).getByLabelText(/masyu branch inspector canvas/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/cell-degree contradiction at C\(2, 2\)/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Branch replay step', { exact: true })).toHaveAttribute('max', '2')

    fireEvent.click(within(dialog).getByRole('button', { name: /next/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /next/i }))
    expect(within(dialog).getByText('Test Downstream', { exact: true })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('tab', { name: /forced conclusion forced/i }))
    expect(within(dialog).getByText(/forced because the trial assumption contradicts/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Branch replay step', { exact: true })).toHaveAttribute('max', '1')
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
