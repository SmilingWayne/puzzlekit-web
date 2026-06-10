import { Link } from 'react-router-dom'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { RuleExample } from './RuleExample'
import type { RuleDocEntry } from './ruleDocRegistry'

export const RuleDocPage = ({ entry }: { entry: RuleDocEntry }) => {
  const plugin = puzzleRegistry.get(entry.puzzleId)
  const Content = entry.content

  return (
    <article className="docs-article">
      <nav className="docs-breadcrumbs" aria-label="Documentation breadcrumbs">
        <Link to="/docs">Docs</Link>
        <span>/</span>
        <Link to={`/docs/${entry.puzzleId}`}>
          {plugin?.displayName ?? entry.puzzleId}
        </Link>
        <span>/</span>
        <span>{entry.title}</span>
      </nav>
      <header className="docs-article-header">
        <span className={`docs-status docs-status-${entry.status}`}>
          {entry.status}
        </span>
        <p>{entry.category}</p>
        <h1>{entry.title}</h1>
        <p>{entry.summary}</p>
        <code>{entry.ruleId}</code>
      </header>
      <div className="docs-prose">
        <Content />
      </div>
      {entry.example ? <RuleExample {...entry.example} /> : null}
    </article>
  )
}
