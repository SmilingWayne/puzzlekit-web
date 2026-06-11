import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RuleStep } from '../../domain/rules/types'
import { getRuleDocPath } from '../docs/ruleDocRegistry'
import { BranchInspector } from './BranchInspector'

type Props = {
  pluginId: string
  steps: RuleStep[]
}

const buildStepMeta = (step: RuleStep): string => {
  const edgeUpdates = step.diffs.filter((diff) => diff.kind === 'edge').length
  const lineUpdates = step.diffs.filter((diff) => diff.kind === 'line' && diff.to === 'line').length
  const lineCrosses = step.diffs.filter((diff) => diff.kind === 'line' && diff.to === 'blank').length
  const sectorUpdates = step.affectedSectors.length
  const parts = [
    edgeUpdates > 0 ? `edge updates: ${edgeUpdates}` : null,
    lineUpdates > 0 ? `line updates: ${lineUpdates}` : null,
    lineCrosses > 0 ? `line crosses: ${lineCrosses}` : null,
    sectorUpdates > 0 ? `sector updates: ${sectorUpdates}` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(', ') : 'edge updates: 0'
}

export const ExplanationPanel = ({ pluginId, steps }: Props) => {
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [inspectedStep, setInspectedStep] = useState<RuleStep | null>(null)
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
                {sequence}.{' '}
                <Link
                  className="step-rule-link"
                  to={getRuleDocPath(pluginId, step.ruleId)}
                  title={`Read about ${step.ruleName}`}
                >
                  {step.ruleName}
                </Link>
              </p>
              <p className="step-message">
                {step.inferenceDetails ? (
                  <>
                    <button
                      type="button"
                      className="step-details-link"
                      onClick={() => setInspectedStep(step)}
                    >
                      [View details]
                    </button>{' '}
                  </>
                ) : null}
                {step.message}
              </p>
              <p className="step-meta">{buildStepMeta(step)}</p>
            </li>
          ))
        )}
      </ol>
      {inspectedStep?.inferenceDetails ? (
        <BranchInspector
          details={inspectedStep.inferenceDetails}
          onClose={() => setInspectedStep(null)}
        />
      ) : null}
    </section>
  )
}
