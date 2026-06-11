import { describe, expect, it } from 'vitest'
import { validateBenchmarkManifest } from '../../domain/benchmark'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { publicDatasetManifests } from './publicDatasets'

describe('public datasets', () => {
  it('provides a valid, categorized, and parseable Masyu manifest', () => {
    const manifest = publicDatasetManifests.find(
      (candidate) => candidate.id === 'masyu',
    )

    expect(manifest).toBeDefined()
    const validated = validateBenchmarkManifest(manifest)
    expect(validated.puzzleType).toBe('masyu')
    expect(validated.title).toBe('Masyu Dataset')
    expect(validated.items).toHaveLength(55)
    expect(new Set(validated.items.map((item) => item.id)).size).toBe(55)

    const existingItems = validated.items.slice(0, 37)
    const newItems = validated.items.slice(37)
    expect(existingItems.every((item) => item.tags.includes('hard'))).toBe(true)
    expect(newItems.every((item) => item.tags.includes('easy'))).toBe(true)
    expect(newItems.every((item) => item.source === 'example.txt')).toBe(true)
    expect(newItems.map((item) => item.id)).toEqual([
      'masyu-15x21-0005',
      'masyu-10x10-0006',
      'masyu-10x10-0007',
      'masyu-10x10-0008',
      'masyu-10x10-0009',
      'masyu-10x10-0010',
      'masyu-25x40-0011',
      'masyu-25x40-0012',
      'masyu-39x49-0013',
      'masyu-10x18-0014',
      'masyu-12x14-0015',
      'masyu-10x10-0016',
      'masyu-10x10-0017',
      'masyu-20x29-0018',
      'masyu-13x18-0019',
      'masyu-40x40-0020',
      'masyu-30x30-0021',
      'masyu-15x10-0022',
    ])

    const plugin = puzzleRegistry.get('masyu')
    expect(plugin).toBeDefined()
    for (const item of validated.items) {
      const area = item.width * item.height
      const sizeTag = area < 150 ? 'Small' : area < 500 ? 'Medium' : 'Large'
      const difficultyTag = item.tags.includes('hard') ? 'hard' : 'easy'

      expect(item.puzzleType).toBe('masyu')
      expect(item.tags).toEqual([difficultyTag, sizeTag])
      expect(item.id).toMatch(/^masyu-\d+x\d+-\d+$/)
      if (difficultyTag === 'hard') {
        expect(item.source).toBe(
          item.width === 25
            ? 'https://zh.puzzle-masyu.com/?size=18'
            : 'https://zh.puzzle-masyu.com/?size=12',
        )
      }

      const puzzle = plugin!.parse(item.sourceUrl)
      expect(puzzle.puzzleType).toBe('masyu')
      expect(puzzle.cols).toBe(item.width)
      expect(puzzle.rows).toBe(item.height)
    }
  })
})
