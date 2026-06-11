import { Link } from 'react-router-dom'
import MasyuOverview from '../../../docs/content/masyu/overview.mdx'
import SlitherlinkOverview from '../../../docs/content/slitherlink/overview.mdx'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { getRuleDocPath, ruleDocEntries } from './ruleDocRegistry'

const familyOverviews = {
  masyu: MasyuOverview,
  slitherlink: SlitherlinkOverview,
}

export const DocsIndex = ({ puzzleId }: { puzzleId?: string }) => {
  const plugins = puzzleRegistry
    .all()
    .filter((plugin) => plugin.getRules().length > 0)
    .filter((plugin) => !puzzleId || plugin.id === puzzleId)

  return (
    <div className="docs-index">
      <section className="docs-intro panel-card">
        <h1>
          {puzzleId
            ? `${puzzleRegistry.get(puzzleId)?.displayName ?? puzzleId} Documentation`
            : 'Rule Documentation'}
        </h1>
        <p>
          Puzzle rules describe the goal. Solver techniques explain each
          deduction that PuzzleKit can make and replay.
        </p>
        {puzzleId && puzzleId in familyOverviews ? (
          <div className="docs-prose docs-family-overview">
            {(() => {
              const Overview =
                familyOverviews[puzzleId as keyof typeof familyOverviews]
              return <Overview />
            })()}
          </div>
        ) : null}
      </section>
      {plugins.map((plugin) => {
        const entries = ruleDocEntries.filter(
          (entry) => entry.puzzleId === plugin.id,
        )
        const categories = Array.from(
          new Set(entries.map((entry) => entry.category)),
        )
        return (
          <section className="panel-card docs-family" key={plugin.id}>
            <header>
              <div>
                <h2>{plugin.displayName}</h2>
                <p>
                  {
                    entries.filter((entry) => entry.status === 'documented')
                      .length
                  }{' '}
                  documented / {entries.length} registered techniques
                </p>
              </div>
              {!puzzleId ? (
                <Link to={`/docs/${plugin.id}`}>Open family</Link>
              ) : null}
            </header>
            {categories.map((category) => (
              <div className="docs-rule-group" key={category}>
                <h3>{category}</h3>
                <div className="docs-rule-list">
                  {entries
                    .filter((entry) => entry.category === category)
                    .map((entry) => (
                      <Link
                        key={entry.ruleId}
                        to={getRuleDocPath(entry.puzzleId, entry.ruleId)}
                      >
                        <span>{entry.title}</span>
                        <small>{entry.status}</small>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
