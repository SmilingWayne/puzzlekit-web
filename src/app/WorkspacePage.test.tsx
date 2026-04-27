import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { edgeKey } from '../domain/ir/keys'
import { createSlitherPuzzle } from '../domain/ir/slither'
import type { EdgeMark, PuzzleIR } from '../domain/ir/types'
import { useSolverStore } from '../features/solver/solverStore'
import { WorkspacePage } from './WorkspacePage'

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
  })

  it('renders workspace key sections', () => {
    renderWorkspace()
    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(screen.getByText(/input & controls/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reasoning steps/i })).toBeInTheDocument()
    expect(screen.getByText(/live stats/i)).toBeInTheDocument()
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

    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: /solve next 100 steps/i }))

    expect(screen.getByRole('dialog', { name: /solving to end/i })).toBeInTheDocument()
    expect(screen.getByText(/step 0 \/ 100/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /solving to end/i })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('dialog', { name: /solved/i })).toBeInTheDocument()
    expect(screen.getByText(/total time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /solve next 100 steps/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /solve next 100 steps/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /reset replay/i }))

    expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /solve next 100 steps/i })).not.toBeDisabled()
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
})
