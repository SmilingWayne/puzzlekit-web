import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cellKey } from '../../domain/ir/keys'
import { createMasyuPuzzle } from '../../domain/ir/masyu'
import { PuzzlePreviewBoard } from './PuzzlePreviewBoard'

describe('PuzzlePreviewBoard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('draws Masyu pearls in compact previews', () => {
    const puzzle = createMasyuPuzzle(25, 25)
    puzzle.cells[cellKey(2, 3)] = { clue: { kind: 'pearl', color: 'white' } }
    puzzle.cells[cellKey(10, 12)] = { clue: { kind: 'pearl', color: 'black' } }
    const arc = vi.fn()

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc,
    } as unknown as CanvasRenderingContext2D)

    render(
      <PuzzlePreviewBoard
        puzzle={puzzle}
        label="Masyu preview"
        width={136}
        height={136}
        padding={12}
        variant="compact"
      />,
    )

    expect(arc).toHaveBeenCalledTimes(2)
  })
})
