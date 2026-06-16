import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DocsPage } from './DocsPage'

const renderDocs = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/docs/*" element={<DocsPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('DocsPage', () => {
  afterEach(cleanup)

  it('renders the generated puzzle-family documentation index', () => {
    renderDocs('/docs')

    expect(
      screen.getByRole('heading', { name: 'Rule Documentation' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Masyu' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Slitherlink' }),
    ).toBeInTheDocument()
    const nav = screen.getByRole('navigation', {
      name: /workspace navigation/i,
    })
    expect(within(nav).getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('renders a documented rule and its read-only example', () => {
    renderDocs('/docs/masyu/rules/white-pearl-rule')

    expect(
      screen.getByRole('heading', { name: 'White Pearl Rule', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('documented')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Play deduction' }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Rule documentation example: horizontal-exit'),
    ).toBeInTheDocument()
  })
})
