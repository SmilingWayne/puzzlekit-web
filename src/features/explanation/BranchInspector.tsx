import { useEffect, useMemo, useState } from 'react'
import { applyRuleDiffs } from '../../domain/rules/engine'
import type { InferenceBranch, InferenceDetails } from '../../domain/rules/types'
import { CanvasBoard } from '../board/CanvasBoard'
import type { DisplaySettings } from '../solver/solverStore'

type Props = {
  details: InferenceDetails
  onClose: () => void
}

const inspectorDisplaySettings: DisplaySettings = {
  showGridLabels: true,
  showHighlights: true,
  showCellColors: true,
  showEdgeCrosses: true,
  showSectorMarks: true,
  showVertices: true,
  showCoordinates: false,
}

const buildBranchPuzzle = (details: InferenceDetails, branch: InferenceBranch, pointer: number) => {
  let puzzle = details.basePuzzle
  if (pointer >= 1) {
    puzzle = applyRuleDiffs(puzzle, branch.assumptionDiffs)
  }
  for (let index = 0; index < pointer - 1; index += 1) {
    puzzle = applyRuleDiffs(puzzle, branch.traceSteps[index].diffs)
  }
  return puzzle
}

export const BranchInspector = ({ details, onClose }: Props) => {
  const [branchId, setBranchId] = useState(details.defaultBranchId)
  const [pointer, setPointer] = useState(0)
  const branch = details.branches.find((item) => item.id === branchId) ?? details.branches[0]
  const maxPointer = branch.traceSteps.length + 1
  const puzzle = useMemo(
    () => buildBranchPuzzle(details, branch, pointer),
    [branch, details, pointer],
  )
  const activeTraceStep = pointer >= 2 ? branch.traceSteps[pointer - 2] : undefined
  const showContradiction = pointer === maxPointer && branch.status === 'contradiction'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const selectBranch = (nextBranchId: string) => {
    setBranchId(nextBranchId)
    setPointer(0)
  }

  const stageText =
    pointer === 0
      ? 'Base puzzle before the inference'
      : pointer === 1
        ? 'Apply the branch assumption'
        : activeTraceStep?.message ?? 'Branch result'

  return (
    <div className="branch-inspector-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="branch-inspector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="branch-inspector-title"
      >
        <header className="branch-inspector-header">
          <div>
            <h2 id="branch-inspector-title">Branch Inspector</h2>
            <p>
              {details.conclusion === 'opposite-branch'
                ? 'One branch contradicts the puzzle, forcing the alternative.'
                : 'Both branches imply the same consequence.'}
            </p>
          </div>
          <button type="button" className="button-compact" onClick={onClose} aria-label="Close branch inspector">
            Close
          </button>
        </header>

        <div className="branch-inspector-tabs" role="tablist" aria-label="Inference branches">
          {details.branches.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={item.id === branch.id}
              data-active={item.id === branch.id}
              key={item.id}
              onClick={() => selectBranch(item.id)}
            >
              {item.label} <span>{item.status}</span>
            </button>
          ))}
        </div>

        <div className="branch-inspector-layout">
          <div className="branch-inspector-board">
            <CanvasBoard
              puzzle={puzzle}
              pluginId="slitherlink"
              highlightedCells={activeTraceStep?.affectedCells ?? []}
              highlightedColorCells={activeTraceStep?.diffs.flatMap((diff) => diff.kind === 'cell' ? [diff.cellKey] : []) ?? []}
              highlightedEdges={activeTraceStep?.affectedEdges ?? []}
              displaySettings={inspectorDisplaySettings}
              onSetDisplayOption={() => {}}
              variant="surface"
              assumptionDiffs={pointer >= 1 ? branch.assumptionDiffs : []}
              contradictionFocus={showContradiction ? branch.contradiction : undefined}
              ariaLabel="Slitherlink branch inspector canvas"
            />
          </div>

          <aside className="branch-inspector-details">
            <div className="branch-inspector-status">
              <span>Branch result</span>
              <strong data-status={branch.status}>{branch.status}</strong>
            </div>
            {branch.contradiction ? (
              <p className="branch-inspector-contradiction">{branch.contradiction.message}</p>
            ) : (
              <p className="branch-inspector-muted">No contradiction was found within the probe budget.</p>
            )}
            <div className="branch-inspector-legend" aria-label="Branch inspector legend">
              <span><i data-kind="assumption" /> assumption</span>
              <span><i data-kind="step" /> current trial step</span>
              <span><i data-kind="contradiction" /> contradiction focus</span>
            </div>
          </aside>
        </div>

        <footer className="branch-inspector-controls">
          <div>
            <strong>{pointer === 0 ? 'Base puzzle' : pointer === 1 ? 'Assumption' : activeTraceStep?.ruleName}</strong>
            <p>{stageText}</p>
          </div>
          <div className="branch-inspector-navigation">
            <button type="button" className="button-compact" disabled={pointer === 0} onClick={() => setPointer((value) => value - 1)}>
              Previous
            </button>
            <label>
              <span className="sr-only">Branch replay step</span>
              <input
                aria-label="Branch replay step"
                type="range"
                min={0}
                max={maxPointer}
                value={pointer}
                onChange={(event) => setPointer(Number(event.target.value))}
              />
            </label>
            <output>{pointer} / {maxPointer}</output>
            <button type="button" className="button-compact" disabled={pointer === maxPointer} onClick={() => setPointer((value) => value + 1)}>
              Next
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
