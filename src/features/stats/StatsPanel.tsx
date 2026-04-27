import type { DifficultySnapshot } from '../../domain/difficulty/types'
import type { RuleStep } from '../../domain/rules/types'

type Props = {
  steps: RuleStep[]
  difficulty: DifficultySnapshot
}

export const StatsPanel = ({ steps, difficulty }: Props) => {
  const totalChanges = steps.reduce(
    (sum, step) => sum + step.diffs.filter((diff) => diff.kind === 'edge').length,
    0,
  )
  return (
    <section className="panel-card stats">
      <header className="panel-header">
        <h2>Live Stats</h2>
      </header>
      <div className="stats-grid">
        <div>
          <span>Total Steps</span>
          <strong>{steps.length}</strong>
        </div>
        <div>
          <span>Total Modifications</span>
          <strong>{totalChanges}</strong>
        </div>
        <div>
          <span>Unique Techniques</span>
          <strong>{difficulty.uniqueRules}</strong>
        </div>
        <div>
          <span>Difficulty Score (draft)</span>
          <strong>{difficulty.totalSteps + difficulty.totalEdgeChanges}</strong>
        </div>
      </div>
      <details>
        <summary>Rule Usage</summary>
        <ul className="rule-usage">
          {Object.entries(difficulty.ruleUsage).length === 0 ? (
            <li>None yet</li>
          ) : (
            Object.entries(difficulty.ruleUsage).map(([rule, count]) => (
              <li key={rule}>
                {rule}: {count}
              </li>
            ))
          )}
        </ul>
      </details>
    </section>
  )
}
