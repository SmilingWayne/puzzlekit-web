import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { createSlitherPuzzle } from '../domain/ir/slither'
import { useEditorStore } from '../features/editor/editorStore'
import { useSolverStore } from '../features/solver/solverStore'

const SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'

const renderDataset = () =>
  render(
    <MemoryRouter initialEntries={['/dataset']}>
      <App />
    </MemoryRouter>,
  )

const getCard = (name: string): HTMLElement => {
  const heading = screen.getByRole('heading', { name })
  const card = heading.closest('article')
  if (!card) {
    throw new Error(`Dataset card "${name}" not found.`)
  }
  return card
}

describe('DatasetPage', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    useEditorStore.getState().loadEditorPuzzle(createSlitherPuzzle(5, 5))
  })

  it('renders dataset navigation, controls, and public manifest cards', () => {
    renderDataset()

    const nav = screen.getByRole('navigation', { name: /workspace navigation/i })
    expect(screen.getByRole('heading', { name: /puzzlekit dataset/i })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /dataset/i })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: /solver/i })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: /editor/i })).toHaveAttribute('href', '/editor')
    expect(screen.getByRole('heading', { name: /dataset controls/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'slitherlink-10x10-0001' })).toBeInTheDocument()
    expect(screen.getByLabelText(/slitherlink-10x10-0001 dataset preview/i)).toHaveClass(
      'dataset-preview-canvas',
    )
    expect(screen.getByText(/showing 56 \/ 56 puzzles/i)).toBeInTheDocument()
  })

  it('filters by search text, size, and tag', () => {
    renderDataset()

    fireEvent.change(screen.getByPlaceholderText(/name, tag, size, type, or url/i), {
      target: { value: 'slitherlink-6x6-0001' },
    })

    expect(screen.getByRole('heading', { name: 'slitherlink-6x6-0001' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'slitherlink-10x10-0001' })).not.toBeInTheDocument()
    expect(screen.getByText(/showing 1 \/ 56 puzzles/i)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/name, tag, size, type, or url/i), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText(/^size$/i), { target: { value: '6 x 6' } })

    expect(screen.getByRole('heading', { name: 'slitherlink-6x6-0001' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'slitherlink-6x6-0002' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'slitherlink-10x10-0001' })).not.toBeInTheDocument()
    expect(screen.getByText(/showing 2 \/ 56 puzzles/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /auto-imported/i }))
    expect(screen.getByRole('button', { name: /auto-imported/i })).toHaveAttribute(
      'data-active',
      'true',
    )
    expect(screen.getByText(/showing 2 \/ 56 puzzles/i)).toBeInTheDocument()
  })

  it('renders compact action links for each dataset puzzle', () => {
    renderDataset()

    const card = getCard('slitherlink-10x10-0001')
    const sourceLink = within(card).getByRole('link', { name: 'URL' })

    expect(sourceLink).toHaveAttribute(
      'href',
      'https://puzz.link/p?slither/10/10/372d23djdh738adl72882dj18538ald838dhaj21d272c',
    )
    expect(sourceLink).toHaveAttribute('target', '_blank')
    expect(sourceLink).toHaveAttribute('rel', 'noreferrer')
    expect(within(card).getByRole('link', { name: 'Solver' })).toHaveAttribute('href', '/')
    expect(within(card).getByRole('link', { name: 'Editor' })).toHaveAttribute('href', '/editor')
  })

  it('loads a dataset puzzle into the solver', () => {
    renderDataset()

    fireEvent.click(within(getCard('slitherlink-6x6-0001')).getByRole('link', { name: 'Solver' }))

    expect(screen.getByRole('heading', { name: /puzzlekit web/i })).toBeInTheDocument()
    expect(useSolverStore.getState().pluginId).toBe('slitherlink')
    expect(useSolverStore.getState().initialPuzzle.rows).toBe(6)
    expect(useSolverStore.getState().initialPuzzle.cols).toBe(6)
    expect(useSolverStore.getState().sourceUrl).toBe(
      'https://puzz.link/p?slither/6/6/1bg688cgc121186dgbg2b',
    )
    expect(useSolverStore.getState().pointer).toBe(0)
  })

  it('loads a dataset puzzle into the editor', () => {
    renderDataset()

    fireEvent.click(within(getCard('slitherlink-10x10-0001')).getByRole('link', { name: 'Editor' }))

    expect(screen.getByRole('heading', { name: /puzzlekit editor/i })).toBeInTheDocument()
    expect(useEditorStore.getState().pluginId).toBe('slitherlink')
    expect(useEditorStore.getState().puzzle.rows).toBe(10)
    expect(useEditorStore.getState().puzzle.cols).toBe(10)
    expect(useEditorStore.getState().sourceUrl).toBe(
      'https://puzz.link/p?slither/10/10/372d23djdh738adl72882dj18538ald838dhaj21d272c',
    )
    expect(useEditorStore.getState().selectedPresetId).toBeNull()
  })
})
