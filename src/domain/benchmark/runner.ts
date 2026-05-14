import type { PuzzleIR } from '../ir/types'
import { puzzleRegistry } from '../plugins/registry'
import { runNextRule } from '../rules/engine'
import { analyzeSlitherCompletion } from '../rules/slither/completion'
import { addRuleUsage } from '../difficulty/traceStats'
import type {
  BenchmarkDatasetItem,
  BenchmarkDatasetManifest,
  BenchmarkPuzzleResult,
  BenchmarkPuzzleStatus,
  BenchmarkReport,
  BenchmarkRunnerOptions,
  BenchmarkSummary,
} from './types'

const DEFAULT_MAX_STEPS = 2000
const DEFAULT_TIMEOUT_MS = 60_000

const normalizeLimit = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.floor(value))
}

const getSlitherTerminal = (puzzleType: string, puzzle: PuzzleIR) =>
  puzzleType === 'slitherlink' ? analyzeSlitherCompletion(puzzle) : null

const getStatusCountKey = (
  status: BenchmarkPuzzleStatus,
): keyof Omit<BenchmarkSummary, 'total' | 'totalDurationMs' | 'ruleUsage'> => {
  if (status === 'parse-error') return 'parseError'
  if (status === 'runtime-error') return 'runtimeError'
  if (status === 'step-capped') return 'stepCapped'
  if (status === 'time-capped') return 'timeCapped'
  return status
}

export const runBenchmarkItem = (
  item: BenchmarkDatasetItem,
  options: Required<BenchmarkRunnerOptions>,
): BenchmarkPuzzleResult => {
  const startedAt = performance.now()
  const ruleUsage: Record<string, number> = {}
  const ruleSteps: Record<string, number[]> = {}
  let stepCount = 0
  const finish = (
    status: BenchmarkPuzzleStatus,
    terminal: BenchmarkPuzzleResult['terminal'],
    error?: string,
  ): BenchmarkPuzzleResult => ({
    id: item.id,
    puzzleType: item.puzzleType,
    sourceUrl: item.sourceUrl,
    width: item.width,
    height: item.height,
    status,
    stepCount,
    durationMs: Math.max(0, performance.now() - startedAt),
    ruleUsage,
    ruleSteps,
    terminal,
    steps: [],
    ...(error ? { error } : {}),
  })

  const plugin = puzzleRegistry.get(item.puzzleType)
  if (!plugin) {
    return finish('parse-error', null, `Plugin "${item.puzzleType}" not found.`)
  }

  let puzzle: PuzzleIR
  try {
    puzzle = plugin.parse(item.sourceUrl)
  } catch (error) {
    return finish(
      'parse-error',
      null,
      error instanceof Error ? error.message : String(error),
    )
  }

  const rules = plugin.getRules()
  while (true) {
    if (performance.now() - startedAt >= options.timeoutMs) {
      return finish('time-capped', getSlitherTerminal(item.puzzleType, puzzle))
    }

    if (stepCount >= options.maxSteps) {
      const terminal = getSlitherTerminal(item.puzzleType, puzzle)
      return finish(
        terminal?.status === 'solved' ? 'solved' : 'step-capped',
        terminal,
      )
    }

    let result: ReturnType<typeof runNextRule>
    try {
      result = runNextRule(puzzle, rules, stepCount + 1)
    } catch (error) {
      return finish(
        'runtime-error',
        getSlitherTerminal(item.puzzleType, puzzle),
        error instanceof Error ? error.message : String(error),
      )
    }

    if (!result.step) {
      const terminal = getSlitherTerminal(item.puzzleType, puzzle)
      return finish(terminal?.status ?? 'stalled', terminal)
    }

    puzzle = result.nextPuzzle
    stepCount += 1
    addRuleUsage(ruleUsage, ruleSteps, result.step, stepCount)
  }
}

export const runBenchmarkManifest = (
  manifest: BenchmarkDatasetManifest,
  options: BenchmarkRunnerOptions = {},
): BenchmarkReport => {
  const maxSteps = normalizeLimit(options.maxSteps, DEFAULT_MAX_STEPS)
  const timeoutMs = normalizeLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS)
  const startedAt = new Date().toISOString()
  const items = manifest.items.map((item) =>
    runBenchmarkItem(item, { maxSteps, timeoutMs }),
  )
  const summary: BenchmarkSummary = {
    total: items.length,
    solved: 0,
    stalled: 0,
    parseError: 0,
    runtimeError: 0,
    stepCapped: 0,
    timeCapped: 0,
    totalDurationMs: 0,
    ruleUsage: {},
  }

  for (const item of items) {
    summary[getStatusCountKey(item.status)] += 1
    summary.totalDurationMs += item.durationMs
    for (const [ruleId, count] of Object.entries(item.ruleUsage)) {
      summary.ruleUsage[ruleId] = (summary.ruleUsage[ruleId] ?? 0) + count
    }
  }

  return {
    schemaVersion: 1,
    run: {
      datasetId: manifest.id,
      startedAt,
      completedAt: new Date().toISOString(),
      maxSteps,
      timeoutMs,
      ruleProfile: 'default',
    },
    summary,
    items,
  }
}
