import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey, edgeKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { createSlitherPuzzle } from '../../domain/ir/slither'
import { useSolverStore } from '../solver/solverStore'
import { useEditorStore } from './editorStore'

const SLITHER_SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'
const MASYU_SAMPLE_URL = 'https://puzz.link/p?mashu/5/5/001390360'

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
    useEditorStore.getState().importFromUrl(SLITHER_SAMPLE_URL)

    const after = useEditorStore.getState()
    expect(after.importError).toBeUndefined()
    expect(after.sourceUrl).toBe(SLITHER_SAMPLE_URL)
    expect(after.puzzle.rows).toBe(3)
    expect(after.puzzle.cols).toBe(3)
  })

  it('creates blank Masyu grids through the active puzzle type', () => {
    useEditorStore.getState().setPluginId('masyu')
    useEditorStore.getState().createBlankPuzzle(6, 7)

    const after = useEditorStore.getState()
    expect(after.pluginId).toBe('masyu')
    expect(after.puzzle.puzzleType).toBe('masyu')
    expect(after.puzzle.rows).toBe(6)
    expect(after.puzzle.cols).toBe(7)
    expect(Object.keys(after.puzzle.lines)).toHaveLength(6 * 6 + 5 * 7)
    expect(Object.keys(after.puzzle.tiles)).toHaveLength(7 * 8)
    expect(after.sourceUrl).toBe('')
    expect(after.importError).toBeUndefined()
  })

  it('mutates Masyu pearls without touching solver replay state', () => {
    useEditorStore.getState().loadEditorPuzzle(createMasyuPuzzle(5, 5))
    const solverPointer = useSolverStore.getState().pointer
    const cell = cellKey(0, 0)

    useEditorStore.getState().setMasyuCellPearl(cell, 'white')
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })

    useEditorStore.getState().setMasyuCellPearl(cell, 'black')
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })

    useEditorStore.getState().setMasyuCellPearl(cell, null)
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toBeUndefined()
    expect(useSolverStore.getState().pointer).toBe(solverPointer)
  })

  it('cycles Masyu cells from empty to white to black to empty', () => {
    useEditorStore.getState().loadEditorPuzzle(createMasyuPuzzle(5, 5))
    const cell = cellKey(1, 1)

    useEditorStore.getState().cycleMasyuCellPearl(cell)
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })

    useEditorStore.getState().cycleMasyuCellPearl(cell)
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })

    useEditorStore.getState().cycleMasyuCellPearl(cell)
    expect(useEditorStore.getState().puzzle.cells[cell]?.clue).toBeUndefined()
  })

  it('imports Masyu URLs through the active plugin parser', () => {
    useEditorStore.getState().setPluginId('masyu')
    useEditorStore.getState().importFromUrl(MASYU_SAMPLE_URL)

    const after = useEditorStore.getState()
    expect(after.importError).toBeUndefined()
    expect(after.sourceUrl).toBe(MASYU_SAMPLE_URL)
    expect(after.puzzle.puzzleType).toBe('masyu')
    expect(after.puzzle.rows).toBe(5)
    expect(after.puzzle.cols).toBe(5)
    expect(after.puzzle.cells[cellKey(4, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
  })
})
