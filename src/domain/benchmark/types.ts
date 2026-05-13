import type { SlitherCompletionReport } from '../rules/slither/completion'

export type BenchmarkDatasetItem = {
  id: string
  puzzleType: string
  sourceUrl: string
  width: number
  height: number
  tags: string[]
  source?: string
}

export type BenchmarkDatasetManifest = {
  schemaVersion: 1
  id: string
  title: string
  puzzleType: string
  items: BenchmarkDatasetItem[]
}

export type BenchmarkPuzzleStatus =
  | 'solved'
  | 'stalled'
  | 'parse-error'
  | 'runtime-error'
  | 'step-capped'
  | 'time-capped'

export type BenchmarkPuzzleResult = {
  id: string
  puzzleType: string
  sourceUrl: string
  width: number
  height: number
  status: BenchmarkPuzzleStatus
  stepCount: number
  durationMs: number
  ruleUsage: Record<string, number>
  ruleSteps: Record<string, number[]>
  terminal: SlitherCompletionReport | null
  steps: []
  error?: string
}

export type BenchmarkRunConfig = {
  datasetId: string
  startedAt: string
  completedAt: string
  maxSteps: number
  timeoutMs: number
  ruleProfile: 'default'
}

export type BenchmarkSummary = {
  total: number
  solved: number
  stalled: number
  parseError: number
  runtimeError: number
  stepCapped: number
  timeCapped: number
  totalDurationMs: number
  ruleUsage: Record<string, number>
}

export type BenchmarkReport = {
  schemaVersion: 1
  run: BenchmarkRunConfig
  summary: BenchmarkSummary
  items: BenchmarkPuzzleResult[]
}

export type BenchmarkRunnerOptions = {
  maxSteps?: number
  timeoutMs?: number
}
