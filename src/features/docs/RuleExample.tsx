import { useEffect, useMemo, useState } from 'react'
import type { PuzzleIR } from '../../domain/ir/types'
import { applyRuleDiffs } from '../../domain/rules/engine'
import type { RuleDiff } from '../../domain/rules/types'
import { CanvasBoard } from '../board/CanvasBoard'
import type { DisplaySettings } from '../solver/solverStore'

type Props = {
  puzzle: PuzzleIR
  before?: RuleDiff[]
  after: RuleDiff[]
  explanation?: string
}

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

export const RuleExample = ({
  puzzle,
  before = [],
  after,
  explanation,
}: Props) => {
  const [view, setView] = useState<'before' | 'after'>('before')
  const [isPlaying, setIsPlaying] = useState(false)
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
    <figure className="rule-example">
      <div className="rule-example-toolbar">
        <div className="rule-example-tabs" aria-label="Rule example state">
          <button
            type="button"
            data-active={view === 'before'}
            onClick={() => setView('before')}
          >
            Before
          </button>
          <button
            type="button"
            data-active={view === 'after'}
            onClick={() => setView('after')}
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
        ariaLabel="Rule documentation example"
      />
      {explanation ? <figcaption>{explanation}</figcaption> : null}
    </figure>
  )
}
