import { useMemo, useState } from 'react'
import type { RuleStep } from '../../domain/rules/types'

type Props = {
  steps: RuleStep[]
}

export const ExplanationPanel = ({ steps }: Props) => {
  const [displayMode, setDisplayMode] = useState<'all' | 'latest30'>('all')
  const visibleEntries = useMemo(
    () =>
      (displayMode === 'latest30' ? steps.slice(-30) : steps)
        .map((step, index, arr) => ({
          step,
          sequence: steps.length - arr.length + index + 1,
        }))
        .reverse(),
    [displayMode, steps],
  )

  return (
    <section className="panel-card">
      <header className="panel-header">
        <h2>Reasoning Steps</h2>
        <small>
          showing {visibleEntries.length} / {steps.length}
        </small>
      </header>
      <div className="toggle-row">
        <button
          data-active={displayMode === 'latest30'}
          onClick={() => setDisplayMode('latest30')}
        >
          Recent 30
        </button>
        <button data-active={displayMode === 'all'} onClick={() => setDisplayMode('all')}>
          Show All
        </button>
      </div>
      <ol className="steps-list">
        {visibleEntries.length === 0 ? (
          <li className="step-item muted">No steps yet. Click "Next Step".</li>
        ) : (
          visibleEntries.map(({ step, sequence }, index) => (
            <li
              key={step.id}
              className={`step-item ${index === 0 ? 'active' : ''}`}
              data-active={index === 0}
            >
              <p className="step-title">
                {sequence}. {step.ruleName}
              </p>
              <p className="step-message">{step.message}</p>
              <p className="step-meta">edge updates: {step.diffs.length}</p>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
