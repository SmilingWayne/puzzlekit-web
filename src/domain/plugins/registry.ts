import { masyuPlugin } from './masyuPlugin'
import { nonogramPlugin } from './nonogramPlugin'
import { slitherPlugin } from './slitherPlugin'
import type { PuzzlePlugin } from './types'

const plugins: PuzzlePlugin[] = [slitherPlugin, masyuPlugin, nonogramPlugin]

export const puzzleRegistry = {
  all: () => plugins,
  get: (id: string) => plugins.find((plugin) => plugin.id === id),
}
