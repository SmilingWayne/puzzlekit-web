import type { PuzzleIR } from '../ir/types'
import { analyzeMasyuCompletion } from './masyu/completion'
import { analyzeSlitherCompletion } from './slither/completion'

export type CompletionStatus = 'solved' | 'stalled'

export type CompletionStats = {
  totalUnits: number
  lineUnits: number
  blankUnits: number
  unknownUnits: number
  decidedUnits: number
  decidedRatio: number
  unitLabel: string
  [key: string]: number | string
}

export type CompletionReport = {
  status: CompletionStatus
  stats: CompletionStats
  reasons: string[]
}

export const analyzePuzzleCompletion = (
  pluginId: string,
  puzzle: PuzzleIR,
): CompletionReport | null => {
  if (pluginId === 'slitherlink') {
    return analyzeSlitherCompletion(puzzle)
  }
  if (pluginId === 'masyu') {
    return analyzeMasyuCompletion(puzzle)
  }
  return null
}
