import { useMemo, useState } from 'react'
import type { RuleStep } from '../../domain/rules/types'

type Props = {
  steps: RuleStep[]
}

export const ExplanationPanel = ({ steps }: Props) => {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const visibleEntries = useMemo(
    () =>
      (showAllSteps ? steps : steps.slice(-30))
        .map((step, index, arr) => ({
          step,
          sequence: steps.length - arr.length + index + 1,
        }))
        .reverse(),
    [showAllSteps, steps],
  )

  return (
    <section className="panel-card">
      <header className="panel-header explanation-panel-header">
        <h2>Reasoning Steps</h2>
        <div className="explanation-header-tools">
          <small>
            showing {visibleEntries.length} / {steps.length}
          </small>
          <button
            type="button"
            className="button-compact"
            data-active={showAllSteps}
            aria-pressed={showAllSteps}
            onClick={() => setShowAllSteps((current) => !current)}
          >
            Show all
          </button>
        </div>
      </header>
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
              <p className="step-meta">
                edge updates: {step.diffs.filter((diff) => diff.kind === 'edge').length}
                {step.affectedSectors.length > 0
                  ? `, sector updates: ${step.affectedSectors.length}`
                  : ''}
              </p>
            </li>
          ))
        )}
      </ol>
    </section>
  )
}
