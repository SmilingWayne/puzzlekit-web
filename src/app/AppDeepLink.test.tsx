import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { createMasyuPuzzle } from '../domain/ir/masyu'
import {
  DEFAULT_SLITHERLINK_SAMPLE_URL,
  useSolverStore,
} from '../features/solver/solverStore'

const SLITHER_PAYLOAD =
  'slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo'
const MASYU_PAYLOAD = 'mashu/14/8/330000096960006ik00039a00010j0i0000220'

const renderApp = (entry: string, strict = false) => {
  const app = (
    <MemoryRouter initialEntries={[entry]}>
      <App />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{app}</StrictMode> : app)
}

describe('PuzzleKit deep links', () => {
  beforeEach(() => {
    useSolverStore.getState().loadDefaultPuzzle()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not change the current solver puzzle when p is absent', async () => {
    const puzzle = createMasyuPuzzle(4, 5)
    useSolverStore.getState().loadPuzzle(puzzle, { pluginId: 'masyu', sourceUrl: 'manual' })

    renderApp('/')

    await waitFor(() => expect(useSolverStore.getState().pluginId).toBe('masyu'))
    expect(useSolverStore.getState().currentPuzzle.rows).toBe(4)
    expect(useSolverStore.getState().currentPuzzle.cols).toBe(5)
    expect(useSolverStore.getState().sourceUrl).toBe('manual')
  })

  it.each([
    [SLITHER_PAYLOAD, 'slitherlink', 10, 10],
    [MASYU_PAYLOAD, 'masyu', 8, 14],
  ])('loads canonical payload %s into the solver', async (payload, pluginId, rows, cols) => {
    renderApp(`/?p=${encodeURIComponent(payload)}`, true)

    await waitFor(() => expect(useSolverStore.getState().pluginId).toBe(pluginId))
    const state = useSolverStore.getState()
    expect(state.currentPuzzle.rows).toBe(rows)
    expect(state.currentPuzzle.cols).toBe(cols)
    expect(state.sourceUrl).toBe(`https://puzz.link/p?${payload}`)
    expect(state.steps).toEqual([])
    expect(state.pointer).toBe(0)
    expect(screen.getByDisplayValue(`https://puzz.link/p?${payload}`)).toBeInTheDocument()
  })

  it('falls back to the default puzzle, reports the error, and still permits manual import', async () => {
    renderApp('/?p=slither%2F10%2F10%2Fdsew%3F')

    const dialog = await screen.findByRole('alertdialog', { name: /import failed/i })
    expect(dialog).toBeInTheDocument()
    expect(useSolverStore.getState().pluginId).toBe('slitherlink')
    expect(useSolverStore.getState().sourceUrl).toBe(DEFAULT_SLITHERLINK_SAMPLE_URL)
    expect(screen.getByText(/default puzzle has been loaded instead/i)).not.toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    const input = screen.getByPlaceholderText(/paste puzz\.link/i)
    fireEvent.change(input, { target: { value: 'https://puzz.link/p?slither/3/3/g0h' } })
    fireEvent.click(screen.getByRole('button', { name: /import url/i }))

    await waitFor(() => expect(useSolverStore.getState().currentPuzzle.rows).toBe(3))
    expect(useSolverStore.getState().sourceUrl).toBe('https://puzz.link/p?slither/3/3/g0h')
    expect(screen.queryByRole('alertdialog', { name: /import failed/i })).not.toBeInTheDocument()
  })

  it('ignores deep-link parameters outside the solver route', async () => {
    const puzzle = createMasyuPuzzle(4, 5)
    useSolverStore.getState().loadPuzzle(puzzle, { pluginId: 'masyu', sourceUrl: 'manual' })

    renderApp(`/editor?p=${encodeURIComponent(SLITHER_PAYLOAD)}`)

    await waitFor(() => expect(screen.getByRole('heading', { name: /puzzlekit editor/i })).toBeInTheDocument())
    expect(useSolverStore.getState().pluginId).toBe('masyu')
    expect(useSolverStore.getState().sourceUrl).toBe('manual')
  })
})
