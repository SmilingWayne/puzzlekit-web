import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { WorkspacePage } from './WorkspacePage'

describe('WorkspacePage', () => {
  it('renders workspace key sections', () => {
    render(
      <BrowserRouter>
        <WorkspacePage />
      </BrowserRouter>,
    )
    expect(screen.getByText(/logical solver workspace/i)).toBeInTheDocument()
    expect(screen.getByText(/input & controls/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reasoning steps/i })).toBeInTheDocument()
    expect(screen.getByText(/live stats/i)).toBeInTheDocument()
  })
})
