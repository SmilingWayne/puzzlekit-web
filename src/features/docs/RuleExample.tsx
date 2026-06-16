import { useEffect, useMemo, useState } from 'react'
import { applyRuleDiffs } from '../../domain/rules/engine'
import { CanvasBoard } from '../board/CanvasBoard'
import type { DisplaySettings } from '../solver/solverStore'
import type { RuleExampleCaseData, RuleExampleData } from './ruleExamples'

type View = 'before' | 'after'

const displaySettings: DisplaySettings = {
  showCoordinates: false,
  showCellColors: true,
  showEdgeCrosses: true,
  showSectorMarks: true,
  showVertices: true,
  showTiles: true,
  showLineCrosses: true,
  showHighlights: true,
  showGridLabels: false,
  showGrid: true,
}

const RuleExampleCase = ({
  exampleCase,
  view,
}: {
  exampleCase: RuleExampleCaseData
  view: View
}) => {
  const { id, title, puzzle, before = [], after, explanation } = exampleCase
  const beforePuzzle = useMemo(
    () => applyRuleDiffs(puzzle, before),
    [before, puzzle],
  )
  const afterPuzzle = useMemo(
    () => applyRuleDiffs(beforePuzzle, after),
    [after, beforePuzzle],
  )
  const changedEdges = useMemo(
    () =>
      view === 'after'
        ? after.flatMap((diff) => (diff.kind === 'edge' ? [diff.edgeKey] : []))
        : [],
    [after, view],
  )
  const changedLines = useMemo(
    () =>
      view === 'after'
        ? after.flatMap((diff) => (diff.kind === 'line' ? [diff.lineKey] : []))
        : [],
    [after, view],
  )

  return (
    <figure className="rule-example-case" data-view={view}>
      {title ? <h3>{title}</h3> : null}
      <div className="rule-example-board">
        <CanvasBoard
          puzzle={view === 'before' ? beforePuzzle : afterPuzzle}
          pluginId={puzzle.puzzleType}
          highlightedEdges={changedEdges}
          highlightedLines={changedLines}
          highlightedCells={[]}
          highlightedColorCells={[]}
          highlightedColorTiles={[]}
          displaySettings={displaySettings}
          onSetDisplayOption={() => undefined}
          variant="surface"
          ariaLabel={`Rule documentation example: ${title ?? id}`}
        />
      </div>
      <figcaption>{explanation}</figcaption>
    </figure>
  )
}

export const RuleExample = ({ cases }: RuleExampleData) => {
  const [view, setView] = useState<View>('before')
  const [isPlaying, setIsPlaying] = useState(false)

  const selectView = (nextView: View) => {
    setIsPlaying(false)
    setView(nextView)
  }

  useEffect(() => {
    if (!isPlaying) {
      return
    }
    const timer = window.setTimeout(() => {
      setView('after')
      setIsPlaying(false)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [isPlaying])

  return (
    <section className="rule-example" aria-label="Rule example">
      <div className="rule-example-toolbar">
        <div className="rule-example-tabs" aria-label="Rule example state">
          <button
            type="button"
            data-active={view === 'before'}
            onClick={() => selectView('before')}
          >
            Before
          </button>
          <button
            type="button"
            data-active={view === 'after'}
            onClick={() => selectView('after')}
          >
            After
          </button>
        </div>
        <button
          type="button"
          disabled={isPlaying}
          onClick={() => {
            setView('before')
            setIsPlaying(true)
          }}
        >
          {isPlaying ? 'Playing...' : 'Play deduction'}
        </button>
      </div>
      <div className="rule-example-cases">
        {cases.map((exampleCase) => (
          <RuleExampleCase
            key={exampleCase.id}
            exampleCase={exampleCase}
            view={view}
          />
        ))}
      </div>
    </section>
  )
}
