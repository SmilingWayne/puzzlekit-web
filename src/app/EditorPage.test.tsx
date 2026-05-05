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

    expect(screen.getByLabelText(/editor board scroll area/i)).toHaveClass('board-scroll-shell')
    const zoom = screen.getByLabelText(/board zoom/i)
    expect(zoom).toHaveValue('100')
    expect(zoom).toHaveAttribute('min', '10')
    expect(zoom).toHaveAttribute('max', '200')
    expect(canvas).toHaveClass('editor-board-canvas')

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    clickCanvas(canvas, 80, 80)
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })

    fireEvent.click(screen.getByRole('button', { name: /^line$/i }))
    clickCanvas(canvas, 80, 48)
    const topEdge = edgeKey([0, 0], [0, 1])
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('line')

    fireEvent.click(screen.getByRole('button', { name: /^cross$/i }))
    clickCanvas(canvas, 48, 80)
    const leftEdge = edgeKey([0, 0], [1, 0])
    expect(useEditorStore.getState().puzzle.edges[leftEdge]?.mark).toBe('blank')

    fireEvent.click(screen.getByRole('button', { name: /^eraser$/i }))
    clickCanvas(canvas, 80, 48)
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

  it('keeps wheel scrolling separate from editor board zoom', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    const zoom = screen.getByLabelText(/board zoom/i)

    expect(fireEvent.wheel(canvas, { deltaY: -120 })).toBe(true)
    expect(zoom).toHaveValue('100')
  })

  it('zooms the editor board with the slider while preserving hit targets', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    const zoom = screen.getByLabelText(/board zoom/i)

    fireEvent.change(zoom, { target: { value: '150' } })
    expect(zoom).toHaveValue('150')
    mockCanvasRect(canvas)

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    clickCanvas(canvas, 120, 120)
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })

    fireEvent.click(screen.getByRole('button', { name: /^line$/i }))
    clickCanvas(canvas, 120, 72)
    expect(useEditorStore.getState().puzzle.edges[edgeKey([0, 0], [0, 1])]?.mark).toBe('line')
  })
})
