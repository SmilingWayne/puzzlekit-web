import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { DocsIndex } from '../features/docs/DocsIndex'
import { RuleDocPage } from '../features/docs/RuleDocPage'
import { getRuleDocEntry } from '../features/docs/ruleDocRegistry'
import { WorkspaceHeader } from './WorkspaceHeader'
import './workspace.css'

const PuzzleDocsRoute = () => {
  const { puzzleId } = useParams()
  return puzzleId ? (
    <DocsIndex puzzleId={puzzleId} />
  ) : (
    <Navigate replace to="/docs" />
  )
}

const RuleDocsRoute = () => {
  const { puzzleId, ruleId } = useParams()
  const entry =
    puzzleId && ruleId ? getRuleDocEntry(puzzleId, ruleId) : undefined
  return entry ? <RuleDocPage entry={entry} /> : <Navigate replace to="/docs" />
}

export const DocsPage = () => (
  <main className="workspace docs-workspace">
    <section className="workspace-grid docs-header-grid">
      <div className="left-column">
        <WorkspaceHeader
          title="PuzzleKit Docs"
          description="Learn the puzzle rules and inspect every solver technique."
          activePage="docs"
        />
      </div>
    </section>
    <Routes>
      <Route index element={<DocsIndex />} />
      <Route path=":puzzleId" element={<PuzzleDocsRoute />} />
      <Route path=":puzzleId/rules/:ruleId" element={<RuleDocsRoute />} />
      <Route path="*" element={<Navigate replace to="/docs" />} />
    </Routes>
  </main>
)
