import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey, edgeKey } from '../../domain/ir/keys'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import { useEditorStore } from './editorStore'

const SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'

describe('editor store', () => {
  beforeEach(() => {
    useEditorStore.getState().loadEditorPuzzle(createSlitherPuzzle(5, 5))
  })

  it('mutates Slitherlink clues and edges without touching solver replay state', () => {
    const cell = cellKey(0, 0)
    const edge = edgeKey([0, 0], [0, 1])

    useEditorStore.getState().setSlitherCellClue(cell, 2)
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })

    useEditorStore.getState().setSlitherEdgeMark(edge, 'line')
    expect(useEditorStore.getState().puzzle.edges[edge]?.mark).toBe('line')

    useEditorStore.getState().setSlitherCellClue(cell, null)
    useEditorStore.getState().setSlitherEdgeMark(edge, 'unknown')

    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toBeUndefined()
    expect(useEditorStore.getState().puzzle.edges[edge]?.mark).toBe('unknown')
  })

  it('imports URLs through the active plugin parser', () => {
    useEditorStore.getState().importFromUrl(SAMPLE_URL)

    const after = useEditorStore.getState()
    expect(after.importError).toBeUndefined()
    expect(after.sourceUrl).toBe(SAMPLE_URL)
    expect(after.puzzle.rows).toBe(3)
    expect(after.puzzle.cols).toBe(3)
  })

})
