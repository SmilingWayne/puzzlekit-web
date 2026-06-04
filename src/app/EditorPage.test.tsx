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

  it('updates slitherlink puzzle stats as editor clues change', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const canvas = screen.getByLabelText(/slitherlink editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)

    fireEvent.focus(screen.getByRole('button', { name: /show puzzle stats/i }))
    expect(within(screen.getByRole('tooltip')).getByText('Numbered cells 0 / 25 (0.0%)')).toBeInTheDocument()

    clickCanvas(canvas, 74, 74)
    fireEvent.keyDown(canvas, { key: '3' })

    expect(within(screen.getByRole('tooltip')).getByText('Numbered cells 1 / 25 (4.0%)')).toBeInTheDocument()
    expect(within(screen.getByRole('tooltip')).getByText('Clue 3')).toBeInTheDocument()
    expect(within(screen.getByRole('tooltip')).getByText('100.0%')).toBeInTheDocument()
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

  it('opens slitherlink rules from the editor puzzle type row', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /show slitherlink rules/i }))

    const dialog = screen.getByRole('dialog', { name: /slitherlink rules/i })
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(within(dialog).getByText(/draw lines along the edges/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/the loop cannot branch off or cross itself/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/a number indicates the amount of edges/i)).toBeInTheDocument()
    expect(within(dialog).queryByText(/in puzzlekit/i)).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/before example canvas/i)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/after example canvas/i)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /close slitherlink rules/i }))
    expect(screen.queryByRole('dialog', { name: /slitherlink rules/i })).not.toBeInTheDocument()
  })

  it('uses the shared workspace grid columns on the editor page', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    const nav = screen.getByRole('navigation', { name: /workspace navigation/i })
    expect(document.querySelector('.workspace-grid.editor-workspace-grid')).not.toBeNull()
    expect(within(nav).getByRole('link', { name: /editor/i })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'href',
      'https://github.com/SmilingWayne/puzzlekit-web',
    )
    expect(within(nav).getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'target',
      '_blank',
    )
    expect(within(nav).getByRole('link', { name: /open puzzlekit web on github/i })).toHaveAttribute(
      'rel',
      'noreferrer',
    )
    expect(screen.queryByRole('button', { name: /load preset/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import url/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /solve it/i })).toBeInTheDocument()
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

  it('enables Masyu in the editor puzzle type selector while keeping Nonogram planned', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('option', { name: 'Masyu' })).toBeEnabled()
    expect(screen.getByRole('option', { name: /nonogram \(planned\)/i })).toBeDisabled()
  })

  it('switches to Masyu with rules, legend, stats, and the Masyu editor canvas', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'masyu' } })

    expect(screen.getByLabelText(/masyu editor canvas/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/slitherlink editor canvas/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show masyu rules/i }))
    const rules = screen.getByRole('dialog', { name: /masyu rules/i })
    expect(within(rules).getByText(/draw lines through orthogonally adjacent cells/i)).toBeInTheDocument()
    fireEvent.click(within(rules).getByRole('button', { name: /close masyu rules/i }))

    fireEvent.click(screen.getByRole('button', { name: /show masyu legend/i }))
    const legend = screen.getByRole('dialog', { name: /masyu legend/i })
    expect(within(legend).getByText(/white and black pearls/i)).toBeInTheDocument()
    fireEvent.click(within(legend).getByRole('button', { name: /close masyu legend/i }))

    fireEvent.focus(screen.getByRole('button', { name: /show puzzle stats/i }))
    expect(within(screen.getByRole('tooltip')).getByText('Pearls 0 / 25 (0.0%)')).toBeInTheDocument()
  })

  it('creates a blank Masyu grid with the current size controls', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'masyu' } })
    fireEvent.change(screen.getByLabelText(/rows/i), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText(/cols/i), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /new grid/i }))

    const puzzle = useEditorStore.getState().puzzle
    expect(puzzle.puzzleType).toBe('masyu')
    expect(puzzle.rows).toBe(6)
    expect(puzzle.cols).toBe(7)
    expect(Object.keys(puzzle.lines)).toHaveLength(6 * 6 + 5 * 7)
    expect(Object.keys(puzzle.tiles)).toHaveLength(7 * 8)
  })

  it('cycles Masyu pearls with no active tool', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'masyu' } })
    const canvas = screen.getByLabelText(/masyu editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    const firstCell = cellKey(0, 0)

    clickCanvas(canvas, 74, 74)
    expect(useEditorStore.getState().puzzle.cells[firstCell]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })

    clickCanvas(canvas, 74, 74)
    expect(useEditorStore.getState().puzzle.cells[firstCell]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })

    clickCanvas(canvas, 74, 74)
    expect(useEditorStore.getState().puzzle.cells[firstCell]?.clue).toBeUndefined()
  })

  it('uses mutually exclusive Masyu pearl tools to paint, overwrite, and erase same-color pearls', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'masyu' } })
    const blackTool = screen.getByRole('button', { name: /set black pearl/i })
    const whiteTool = screen.getByRole('button', { name: /set white pearl/i })
    const canvas = screen.getByLabelText(/masyu editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)

    fireEvent.click(blackTool)
    expect(blackTool).toHaveAttribute('aria-pressed', 'true')
    expect(whiteTool).toHaveAttribute('aria-pressed', 'false')

    dragCanvas(canvas, [
      [74, 74],
      [126, 74],
      [178, 74],
    ])
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 1)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })

    dragCanvas(canvas, [
      [74, 74],
      [126, 74],
      [74, 74],
      [178, 74],
    ])
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 0)]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 1)]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.cells[cellKey(0, 2)]?.clue).toBeUndefined()

    fireEvent.click(whiteTool)
    expect(blackTool).toHaveAttribute('aria-pressed', 'false')
    expect(whiteTool).toHaveAttribute('aria-pressed', 'true')

    dragCanvas(canvas, [
      [74, 126],
      [126, 126],
    ])
    fireEvent.click(blackTool)

    dragCanvas(canvas, [
      [74, 126],
      [126, 126],
      [178, 126],
    ])
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 1)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })

    fireEvent.click(whiteTool)
    expect(blackTool).toHaveAttribute('aria-pressed', 'false')
    expect(whiteTool).toHaveAttribute('aria-pressed', 'true')

    dragCanvas(canvas, [
      [74, 126],
      [126, 126],
      [178, 126],
      [230, 126],
    ])

    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 1)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 3)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })

    dragCanvas(canvas, [
      [74, 126],
      [126, 126],
      [74, 126],
      [178, 126],
      [230, 126],
    ])

    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 0)]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 1)]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 2)]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.cells[cellKey(1, 3)]?.clue).toBeUndefined()

    fireEvent.click(whiteTool)
    expect(whiteTool).toHaveAttribute('aria-pressed', 'false')
  })

  it('hands the edited Masyu puzzle to the solver', () => {
    render(
      <MemoryRouter initialEntries={['/editor']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'masyu' } })
    const canvas = screen.getByLabelText(/masyu editor canvas/i) as HTMLCanvasElement
    mockCanvasRect(canvas)
    clickCanvas(canvas, 74, 74)

    fireEvent.click(screen.getByRole('button', { name: /solve it/i }))

    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(useSolverStore.getState().pluginId).toBe('masyu')
    expect(useSolverStore.getState().initialPuzzle.puzzleType).toBe('masyu')
    expect(useSolverStore.getState().initialPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(useSolverStore.getState().pointer).toBe(0)
  })
})
