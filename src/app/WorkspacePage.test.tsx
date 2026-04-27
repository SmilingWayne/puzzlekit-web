import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByText(/logical solver workspace/i)).toBeInTheDocument()
    expect(screen.getByText(/input & controls/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reasoning steps/i })).toBeInTheDocument()
    expect(screen.getByText(/live stats/i)).toBeInTheDocument()
  })

  it('shows terminal report, disables solve buttons, and keeps them disabled after close', () => {
    const puzzle = createSolvedLoopPuzzle()
    useSolverStore.setState((state) => ({
      ...state,
      pluginId: 'slitherlink',
      initialPuzzle: puzzle,
      currentPuzzle: puzzle,
      steps: [],
      pointer: 0,
      terminalReport: null,
    }))

    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: /solve to end/i }))

    expect(screen.getByRole('dialog', { name: /solved/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /solve to end/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next step/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /solve to end/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /reset replay/i }))

    expect(screen.getByRole('button', { name: /next step/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /solve to end/i })).not.toBeDisabled()
  })
})
