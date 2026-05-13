import { describe, expect, it } from 'vitest'
import { validateBenchmarkManifest } from './manifest'

describe('benchmark manifest', () => {
  it('validates a tiny two-item manifest', () => {
    const manifest = validateBenchmarkManifest({
      schemaVersion: 1,
      id: 'tiny-slitherlink',
      title: 'Tiny Slitherlink',
      puzzleType: 'slitherlink',
      items: [
        {
          id: 'slitherlink-3x3-0001',
          puzzleType: 'slitherlink',
          sourceUrl: 'https://puzz.link/p?slither/3/3/g0h',
          width: 3,
          height: 3,
          tags: ['auto-imported'],
        },
        {
          id: 'slitherlink-3x3-0002',
          puzzleType: 'slitherlink',
          sourceUrl: 'https://puzz.link/p?slither/3/3/i0',
          width: 3,
          height: 3,
          tags: ['auto-imported'],
        },
      ],
    })

    expect(manifest.items).toHaveLength(2)
    expect(manifest.items[0].puzzleType).toBe('slitherlink')
  })
})
