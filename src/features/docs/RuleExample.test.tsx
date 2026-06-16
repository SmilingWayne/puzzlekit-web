import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import { RuleExample } from './RuleExample'
import type { RuleExampleCaseData } from './ruleExamples'

const createCase = (id: string, title?: string): RuleExampleCaseData => ({
  id,
  title,
  puzzle: createSlitherPuzzle(2, 2),
  after: [],
  explanation: `${id} explanation`,
})

describe('RuleExample', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders one case with one shared toolbar', () => {
    const { container } = render(<RuleExample cases={[createCase('single')]} />)

    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Before' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'After' })).toHaveLength(1)
    expect(
      screen.getAllByRole('button', { name: 'Play deduction' }),
    ).toHaveLength(1)
  })

  it('synchronizes multiple uniquely labelled cases', () => {
    const { container } = render(
      <RuleExample
        cases={[
          createCase('first', 'First branch'),
          createCase('second', 'Second branch'),
        ]}
      />,
    )

    expect(container.querySelectorAll('canvas')).toHaveLength(2)
    expect(
      screen.getByLabelText('Rule documentation example: First branch'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Rule documentation example: Second branch'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'After' }))
    expect(
      container.querySelectorAll('.rule-example-case[data-view="after"]'),
    ).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Before' }))
    expect(
      container.querySelectorAll('.rule-example-case[data-view="before"]'),
    ).toHaveLength(2)
  })

  it('plays every case and manual selection cancels playback', () => {
    vi.useFakeTimers()
    const { container } = render(
      <RuleExample cases={[createCase('first'), createCase('second')]} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play deduction' }))
    expect(screen.getByRole('button', { name: 'Playing...' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Before' }))
    expect(screen.getByRole('button', { name: 'Play deduction' })).toBeEnabled()
    expect(
      container.querySelectorAll('.rule-example-case[data-view="before"]'),
    ).toHaveLength(2)

    act(() => vi.advanceTimersByTime(700))
    expect(
      container.querySelectorAll('.rule-example-case[data-view="before"]'),
    ).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Play deduction' }))
    act(() => vi.advanceTimersByTime(700))
    expect(
      container.querySelectorAll('.rule-example-case[data-view="after"]'),
    ).toHaveLength(2)
  })
})
