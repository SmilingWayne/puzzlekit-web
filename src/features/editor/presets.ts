import type { PuzzleKind, PuzzleIR } from '../../domain/ir/types'

export type PuzzlePreset = {
  id: string
  name: string
  puzzleType: PuzzleKind
  rows: number
  cols: number
  tags: string[]
  description?: string
  sourceUrl?: string
  puzzle?: PuzzleIR
}

export const puzzlePresets: PuzzlePreset[] = [
  {
    id: 'slitherlink-small-starter',
    name: 'Starter Loop',
    puzzleType: 'slitherlink',
    rows: 3,
    cols: 3,
    tags: ['small', 'starter', 'puzz.link'],
    description: 'A compact Slitherlink sample for checking import and replay.',
    sourceUrl: 'https://puzz.link/p?slither/3/3/g0h',
  },
  {
    id: 'slitherlink-guide-sample',
    name: 'Guide Sample',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 18,
    tags: ['large', 'guide', 'puzz.link'],
    description: 'The larger sample used by the current solver workspace.',
    sourceUrl:
      'https://puzz.link/p?slither/18/10/c82chcdgcbgd63c173ah6aibi81b71cdjcdcb123ddbcbjb37d16didi8dh161c36cdgcagdbh28bb',
  },
  {
    id: 'slitherlink-balanced-5x5',
    name: 'Balanced 5x5',
    puzzleType: 'slitherlink',
    rows: 5,
    cols: 5,
    tags: ['medium', 'practice', 'puzz.link'],
    description: 'A mid-size board for quick experimentation with editor handoff.',
    sourceUrl: 'https://puzz.link/p?slither/5/5/3a2b1c0d2e3',
  },
]
