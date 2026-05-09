import type { PuzzleKind, PuzzleIR } from '../../domain/ir/types'

export type PuzzlePreset = {
  id: string
  name: string
  puzzleType: PuzzleKind
  rows: number
  cols: number
  tags: string[]
  description?: string
  previewImageUrl?: string
  sourceUrl?: string
  puzzle?: PuzzleIR
}

export const puzzlePresets: PuzzlePreset[] = [
  {
    id: 'default-slitherlink-1',
    name: 'Default Slitherlink 1',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 10,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x10 Slitherlink preset.',
    sourceUrl: 'https://puzz.link/p?slither/10/10/gdk8dh2ah738cgd60djagbdgcj25bdg817ah0dh8dk5',
  },
  {
    id: 'default-slitherlink-2',
    name: 'Default Slitherlink 2',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 10,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x10 Slitherlink preset.',
    sourceUrl: 'https://puzz.link/p?slither/10/10/q202108060clccgb62202118a5chd2ccib2075262agbd7d',
  },
  {
    id: 'default-slitherlink-3',
    name: 'Default Slitherlink 3',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 10,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x10 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/10/10/gb7d23c31bd2bh2c721b32776787027a37cgbj1126cbj22333c332',
  },
]
