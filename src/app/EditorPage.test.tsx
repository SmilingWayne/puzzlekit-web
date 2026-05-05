import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { cellKey, edgeKey } from '../domain/ir/keys'
import { createSlitherPuzzle } from '../domain/ir/slither'
import { useEditorStore } from '../features/editor/editorStore'
import { useSolverStore } from '../features/solver/solverStore'

const mockCanvasRect = (canvas: HTMLCanvasElement) => {
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: canvas.width,
      bottom: canvas.height,
      width: canvas.width,
      height: canvas.height,
      toJSON: () => ({}),
    }),
  })
}

const clickCanvas = (canvas: HTMLCanvasElement, x: number, y: number) => {
  fireEvent.mouseDown(canvas, { clientX: x, clientY: y })
  fireEvent.mouseUp(canvas, { clientX: x, clientY: y })
}

describe('EditorPage', () => {
  afterEach(() => {
    cleanup()
    useEditorStore.getState().loadEditorPuzzle(createSlitherPuzzle(5, 5))
  })

  it('edits clues and edge marks, then hands the puzzle to the solver', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    clickCanvas(canvas, 75, 75)
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })

    fireEvent.click(screen.getByRole('button', { name: /^line$/i }))
    clickCanvas(canvas, 75, 48)
    const topEdge = edgeKey([0, 0], [0, 1])
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('line')

    fireEvent.click(screen.getByRole('button', { name: /^cross$/i }))
    clickCanvas(canvas, 48, 75)
    const leftEdge = edgeKey([0, 0], [1, 0])
    expect(useEditorStore.getState().puzzle.edges[leftEdge]?.mark).toBe('blank')

    fireEvent.click(screen.getByRole('button', { name: /^eraser$/i }))
    clickCanvas(canvas, 75, 48)
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('unknown')

    fireEvent.click(screen.getByRole('button', { name: /solve it/i }))

    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(useSolverStore.getState().initialPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })
    expect(useSolverStore.getState().initialPuzzle.edges[leftEdge]?.mark).toBe('blank')
    expect(useSolverStore.getState().pointer).toBe(0)
  })

  it('loads a preset and exposes preset metadata', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /starter loop/i }))

    expect(screen.getByText(/small/i)).toBeInTheDocument()
    expect(useEditorStore.getState().selectedPresetId).toBe('slitherlink-small-starter')
    expect(useEditorStore.getState().puzzle.rows).toBe(3)
    expect(useEditorStore.getState().puzzle.cols).toBe(3)
  })
})
