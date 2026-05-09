import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

const rightClickCanvas = (canvas: HTMLCanvasElement, x: number, y: number) => {
  fireEvent.mouseDown(canvas, { button: 2, buttons: 2, clientX: x, clientY: y })
  fireEvent.mouseUp(canvas, { button: 2, clientX: x, clientY: y })
}

const dragCanvas = (
  canvas: HTMLCanvasElement,
  points: Array<[number, number]>,
  button = 0,
) => {
  const [startX, startY] = points[0]
  fireEvent.mouseDown(canvas, { button, buttons: button === 2 ? 2 : 1, clientX: startX, clientY: startY })
  for (const [x, y] of points.slice(1)) {
    fireEvent.mouseMove(canvas, { button, buttons: button === 2 ? 2 : 1, clientX: x, clientY: y })
  }
  const [endX, endY] = points[points.length - 1]
  fireEvent.mouseUp(canvas, { button, clientX: endX, clientY: endY })
}

describe('EditorPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useEditorStore.getState().loadEditorPuzzle(createSlitherPuzzle(5, 5))
  })

  it('edits clues and edge marks with direct board input, then hands the puzzle to the solver', () => {
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
    expect(zoom).toHaveAttribute('min', '20')
    expect(zoom).toHaveAttribute('max', '200')
    expect(zoom).toHaveAttribute('step', '5')
    expect(canvas).toHaveClass('editor-board-canvas')

    clickCanvas(canvas, 74, 74)
    fireEvent.keyDown(canvas, { key: '2' })
    fireEvent.keyDown(canvas, { key: '3' })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })
    fireEvent.keyDown(canvas, { key: '?' })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: '?',
    })
    fireEvent.keyDown(canvas, { key: 'Backspace' })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toBeUndefined()
    fireEvent.keyDown(canvas, { key: '3' })

    dragCanvas(canvas, [
      [74, 48],
      [126, 48],
    ])
    const topEdge = edgeKey([0, 0], [0, 1])
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('line')

    dragCanvas(canvas, [
      [74, 48],
      [126, 48],
    ])
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('unknown')

    dragCanvas(canvas, [
      [74, 48],
      [126, 48],
    ])
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('line')

    dragCanvas(
      canvas,
      [
        [74, 48],
        [126, 48],
      ],
      2,
    )
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('blank')

    dragCanvas(
      canvas,
      [
        [48, 74],
        [48, 126],
      ],
      2,
    )
    const leftEdge = edgeKey([0, 0], [1, 0])
    expect(useEditorStore.getState().puzzle.edges[leftEdge]?.mark).toBe('blank')

    fireEvent.click(screen.getByRole('button', { name: /solve it/i }))

    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(useSolverStore.getState().initialPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 3,
    })
    expect(useSolverStore.getState().initialPuzzle.edges[leftEdge]?.mark).toBe('blank')
    expect(useSolverStore.getState().pointer).toBe(0)
  })

  it('changes each edge at most once during a single drag stroke', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const topEdge = edgeKey([0, 0], [0, 1])

    dragCanvas(canvas, [
      [74, 48],
      [96, 48],
      [74, 48],
      [126, 48],
    ])

    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('line')
  })

  it('marks crosses with a strict right-click edge target', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const topEdge = edgeKey([0, 0], [0, 1])

    rightClickCanvas(canvas, 74, 53)
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('unknown')

    rightClickCanvas(canvas, 74, 48)
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('blank')
  })

  it('does not draw edges from cell clicks or drags that start inside cells', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const topEdge = edgeKey([0, 0], [0, 1])
    const rightEdge = edgeKey([0, 1], [1, 1])

    clickCanvas(canvas, 74, 52)
    fireEvent.keyDown(canvas, { key: '1' })

    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 1,
    })
    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('unknown')

    dragCanvas(canvas, [
      [74, 74],
      [126, 48],
      [152, 48],
    ])

    expect(useEditorStore.getState().puzzle.edges[topEdge]?.mark).toBe('unknown')
    expect(useEditorStore.getState().puzzle.edges[rightEdge]?.mark).toBe('unknown')
  })

  it('follows U-shaped edge drags across horizontal and vertical edges', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const leftEdge = edgeKey([0, 0], [1, 0])
    const bottomEdge = edgeKey([1, 0], [1, 1])
    const rightEdge = edgeKey([0, 1], [1, 1])

    dragCanvas(canvas, [
      [48, 74],
      [48, 100],
      [74, 100],
      [100, 100],
      [100, 74],
    ])

    expect(useEditorStore.getState().puzzle.edges[leftEdge]?.mark).toBe('line')
    expect(useEditorStore.getState().puzzle.edges[bottomEdge]?.mark).toBe('line')
    expect(useEditorStore.getState().puzzle.edges[rightEdge]?.mark).toBe('line')
  })

  it('keeps vertical drags from falling back to crossed horizontal edges', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const firstVertical = edgeKey([0, 1], [1, 1])
    const secondVertical = edgeKey([1, 1], [2, 1])
    const crossedHorizontal = edgeKey([1, 0], [1, 1])

    dragCanvas(canvas, [
      [100, 74],
      [100, 126],
    ])

    expect(useEditorStore.getState().puzzle.edges[firstVertical]?.mark).toBe('line')
    expect(useEditorStore.getState().puzzle.edges[secondVertical]?.mark).toBe('line')
    expect(useEditorStore.getState().puzzle.edges[crossedHorizontal]?.mark).toBe('unknown')
  })

  it('opens the preset library and filters presets by search and tag', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))

    const dialog = screen.getByRole('dialog', { name: /load preset/i })
    expect(dialog.querySelector('.preset-grid-scroll')).not.toBeNull()
    expect(within(dialog).getByText(/default slitherlink 1/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /default/i })).toBeInTheDocument()
    expect(within(dialog).getAllByLabelText(/preset preview/i).length).toBeGreaterThan(0)

    fireEvent.click(within(dialog).getByRole('button', { name: /puzz\.link/i }))
    expect(within(dialog).getByText(/default slitherlink 2/i)).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/search presets/i), {
      // Unique fragment from default-slitherlink-2 sourceUrl (search is substring match over URL/name/etc.)
      target: { value: '82232382' },
    })
    expect(within(dialog).getByText(/default slitherlink 2/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/default slitherlink 1/i)).not.toBeInTheDocument()
  })

  it('uses the shared workspace grid columns on the editor page', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    expect(document.querySelector('.workspace-grid.editor-workspace-grid')).not.toBeNull()
  })

  it('loads a preset into the editor from the preset library', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))
    const card = screen.getByText(/default slitherlink 1/i).closest('article')
    expect(card).not.toBeNull()
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /to edit/i }))

    expect(screen.queryByRole('dialog', { name: /load preset/i })).not.toBeInTheDocument()
    expect(useEditorStore.getState().selectedPresetId).toBe('default-slitherlink-1')
    expect(useEditorStore.getState().puzzle.rows).toBe(10)
    expect(useEditorStore.getState().puzzle.cols).toBe(10)
  })

  it('loads a preset into the solver from the preset library', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))
    const card = screen.getByText(/default slitherlink 1/i).closest('article')
    expect(card).not.toBeNull()
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /to solve/i }))

    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(useSolverStore.getState().initialPuzzle.rows).toBe(10)
    expect(useSolverStore.getState().initialPuzzle.cols).toBe(10)
  })

  it('opens preset URLs in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))
    const card = screen.getByText(/default slitherlink 1/i).closest('article')
    expect(card).not.toBeNull()
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'URL' }))

    expect(open).toHaveBeenCalledWith(
      'https://puzz.link/p?slither/10/10/gdk8dh2ah738cgd60djagbdgcj25bdg817ah0dh8dk5',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('closes the preset library with close controls and Escape', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))
    fireEvent.click(screen.getByRole('button', { name: /close preset library/i }))
    expect(screen.queryByRole('dialog', { name: /load preset/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /load preset/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /load preset/i })).not.toBeInTheDocument()
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

    clickCanvas(canvas, 111, 111)
    fireEvent.keyDown(canvas, { key: '2' })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })

    dragCanvas(canvas, [
      [111, 72],
      [189, 72],
    ])
    expect(useEditorStore.getState().puzzle.edges[edgeKey([0, 0], [0, 1])]?.mark).toBe('line')
  })

  it('draws row and column labels around the editor grid', () => {
    const fillText = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        ({
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
        }) as unknown as CanvasRenderingContext2D,
    )

    useEditorStore.getState().loadEditorPuzzle(createSlitherPuzzle(3, 4))

    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const labels = fillText.mock.calls.map(([text]) => text)
    expect(labels).toContain('R1')
    expect(labels).toContain('R3')
    expect(labels).toContain('C1')
    expect(labels).toContain('C4')
  })
})
