import type { PuzzleIR } from '../ir/types'
import { puzzleRegistry } from '../plugins/registry'
import { analyzePuzzleCompletion } from '../rules/completion'
import { composeSolverObservers } from '../rules/composeSolverObservers'
import { runNextRule } from '../rules/engine'
import { createRuleAttemptSummaryCollector } from '../rules/ruleAttemptSummaryCollector'
import { createStrongInferenceSummaryCollector } from '../rules/strongInferenceSummaryCollector'
import {
  aggregateRuleUsage,
  aggregateTelemetrySummaries,
  ruleUsageFromAttempts,
} from './aggregation'
import type {
  BenchmarkDatasetItem,
  BenchmarkDatasetManifest,
  BenchmarkPuzzleResult,
  BenchmarkPuzzleStatus,
  BenchmarkReport,
  BenchmarkRunnerOptions,
  BenchmarkSummary,
  BenchmarkTelemetryLevel,
} from './types'
import { getStrongTelemetryCoverage } from './types'

const DEFAULT_MAX_STEPS = 2000
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_TELEMETRY: BenchmarkTelemetryLevel = 'summary'

const normalizeLimit = (
  value: number | undefined,
  fallback: number,
): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.floor(value))
}

const getTerminal = (puzzleType: string, puzzle: PuzzleIR) =>
  analyzePuzzleCompletion(puzzleType, puzzle)

const getStatusCountKey = (
  status: BenchmarkPuzzleStatus,
): keyof Omit<
  BenchmarkSummary,
  'total' | 'totalDurationMs' | 'ruleUsage' | 'telemetry'
> => {
  if (status === 'parse-error') return 'parseError'
  if (status === 'runtime-error') return 'runtimeError'
  if (status === 'step-capped') return 'stepCapped'
  if (status === 'time-capped') return 'timeCapped'
  return status
}

export const runBenchmarkItem = (
  item: BenchmarkDatasetItem,
  options: BenchmarkRunnerOptions = {},
): BenchmarkPuzzleResult => {
  const maxSteps = normalizeLimit(options.maxSteps, DEFAULT_MAX_STEPS)
  const timeoutMs = normalizeLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS)
  const telemetry = options.telemetry ?? DEFAULT_TELEMETRY
  const startedAt = performance.now()
  const plugin = puzzleRegistry.get(item.puzzleType)
  const ruleAttemptCollector =
    telemetry === 'summary' ? createRuleAttemptSummaryCollector() : undefined
  const strongInferenceCollector =
    telemetry === 'summary'
      ? createStrongInferenceSummaryCollector()
      : undefined
  const observer =
    telemetry === 'summary'
      ? composeSolverObservers([
          ruleAttemptCollector?.observer,
          strongInferenceCollector?.observer,
        ])
      : undefined
  const offRuleUsage: Record<string, number> = {}
  let stepCount = 0

  const finish = (
    status: BenchmarkPuzzleStatus,
    terminal: BenchmarkPuzzleResult['terminal'],
    error?: string,
  ): BenchmarkPuzzleResult => {
    const ruleAttempts = ruleAttemptCollector?.getSummary()
    const telemetry =
      ruleAttempts && strongInferenceCollector
        ? {
            ruleAttempts,
            strongInference: {
              coverage: getStrongTelemetryCoverage(plugin?.strongTelemetry),
              summary: strongInferenceCollector.getSummary(),
            },
          }
        : undefined
    return {
      id: item.id,
      puzzleType: item.puzzleType,
      sourceUrl: item.sourceUrl,
      width: item.width,
      height: item.height,
      status,
      stepCount,
      durationMs: Math.max(0, performance.now() - startedAt),
      ruleUsage: ruleAttempts
        ? ruleUsageFromAttempts(ruleAttempts)
        : offRuleUsage,
      terminal,
      ...(telemetry ? { telemetry } : {}),
      ...(error ? { error } : {}),
    }
  }

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
    if (performance.now() - startedAt >= timeoutMs) {
      return finish('time-capped', getTerminal(item.puzzleType, puzzle))
    }

    if (stepCount >= maxSteps) {
      const terminal = getTerminal(item.puzzleType, puzzle)
      return finish(
        terminal?.status === 'solved' ? 'solved' : 'step-capped',
        terminal,
      )
    }

    let result: ReturnType<typeof runNextRule>
    try {
      result = runNextRule(puzzle, rules, stepCount + 1, { observer })
    } catch (error) {
      return finish(
        'runtime-error',
        getTerminal(item.puzzleType, puzzle),
        error instanceof Error ? error.message : String(error),
      )
    }

    if (!result.step) {
      const terminal = getTerminal(item.puzzleType, puzzle)
      return finish(terminal?.status ?? 'stalled', terminal)
    }

    puzzle = result.nextPuzzle
    stepCount += 1
    if (telemetry === 'off') {
      offRuleUsage[result.step.ruleId] =
        (offRuleUsage[result.step.ruleId] ?? 0) + 1
    }
  }
}

export const runBenchmarkManifest = (
  manifest: BenchmarkDatasetManifest,
  options: BenchmarkRunnerOptions = {},
): BenchmarkReport => {
  const maxSteps = normalizeLimit(options.maxSteps, DEFAULT_MAX_STEPS)
  const timeoutMs = normalizeLimit(options.timeoutMs, DEFAULT_TIMEOUT_MS)
  const telemetry = options.telemetry ?? DEFAULT_TELEMETRY
  const startedAt = new Date().toISOString()
  const items = manifest.items.map((item) =>
    runBenchmarkItem(item, { maxSteps, timeoutMs, telemetry }),
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
    ruleUsage: aggregateRuleUsage(items.map((item) => item.ruleUsage)),
    ...(telemetry === 'summary'
      ? {
          telemetry: aggregateTelemetrySummaries(
            items.flatMap((item) => (item.telemetry ? [item.telemetry] : [])),
          ),
        }
      : {}),
  }

  for (const item of items) {
    summary[getStatusCountKey(item.status)] += 1
    summary.totalDurationMs += item.durationMs
  }

  return {
    schemaVersion: 2,
    run: {
      datasetId: manifest.id,
      startedAt,
      completedAt: new Date().toISOString(),
      maxSteps,
      timeoutMs,
      ruleProfile: 'default',
      telemetry,
    },
    summary,
    items,
  }
}
