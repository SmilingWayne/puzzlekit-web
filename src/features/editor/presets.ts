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
    sourceUrl: 'https://puzz.link/p?slither/10/10/82232382dg2dg27bh73201222121cbhchdhc22222222237ch72cg1bg383222283',
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
      'https://puzz.link/p?slither/10/10/l338111166b111611b111611bhd1111222cdh227222c227222c772222733dj',
  },
  {
    id: 'default-slitherlink-4',
    name: 'Default Slitherlink 4',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 18,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x18 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/18/10/c82chcdgcbgd63c173ah6aibi81b71cdjcdcb123ddbcbjb37d16didi8dh161c36cdgcagdbh28bb',
  },
  {
    id: 'large-slitherlink-5',
    name: 'Large Slitherlink 5',
    puzzleType: 'slitherlink',
    rows: 45,
    cols: 31,
    tags: ['default', 'puzz.link'],
    description: 'Default 45x31 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/45/31/h33cg8dgbdgba6cddgadk30bk6djc21dgdddg328dk31di21ag7bgbcgcb8ddg6dg10ci32ck5bjd22dg23ddj8ck23di02bg8cgd7cddgdcg6cg22di13cjb02cgddbg22ccj8dk3388bgbdgcc6cadgcdg8cgck8dja32bgbddg22dcj01ai12dg6bgdcgcc6cb17bg13di11bk7cjc11bgahaj6dk12ai31cg8cgdchbagcdg6bg21ci31ck6aibcag22bdj7dk02bi10ddgcb7ccdgbag8bg13di8bjb22dgcdcg13dbj8ai20dg7dgcdgbd7bdcgd31ai21dk7djd22dgcddi6dk21ci21cg7cgccgdbhcdg8dg33di30ck7bjbhdg21bdj5ck21ci02ag81ca6bdcgcdg5cg23bi23djc12cgcdag22cbj8ckdg5dgccgdd7cdbgdcg8620bk7cjd21bgbddg22cbj20di23dg8cgcagdd7cag6cg21ci02ak8cjd11dg31ddj7dk12ai02ag8agd6ddagcdg6dg20ci31dk722dgcdag21cdj7dk30bkbagcd8bdagbcg8bg20b',
  },
  {
    id: 'Medium-slitherlink-6',
    name: 'Medium Slitherlink 6',
    puzzleType: 'slitherlink',
    rows: 15,
    cols: 25,
    tags: ['default', 'puzz.link'],
    description: 'Default 15x25 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/25/15/gdgbhbgdhagbg31d0c03c3b32bcibcidbi0aiccibdic33d2d03c1d22dgcgchcgbhdg8bicciadi0dabcacba1cidcibbi7bgbhdgdhbgcg11b1d23b1b23dcidcibdi0aidcidcib02a3c33d1d23dgbgbhagbhagc',
  },
  {
    id: 'Medium-slitherlink-7',
    name: 'Medium Slitherlink 7',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 18,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x18 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/18/10/g1cg2bg31817c6d5bgc1c6b7dgb63abicdbj2ah261c263dh3cjadcib17cbg6b8d1cbg6d7d61612cg3cg1c',
  },
  {
    id: 'default-slitherlink-8',
    name: 'Default Slitherlink 8',
    puzzleType: 'slitherlink',
    rows: 10,
    cols: 18,
    tags: ['default', 'puzz.link'],
    description: 'Default 10x18 Slitherlink preset.',
    sourceUrl:
      'https://puzz.link/p?slither/18/10/a27138bbg1cm6dj75733bi3ap5chdg677b8ah8d578dgbh6dp3di20678dj8bm0cgc62361bb',
  },
]
