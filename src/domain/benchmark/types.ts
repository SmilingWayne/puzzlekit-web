import type {
  PuzzleStrongTelemetryConfig,
  StrongTelemetryRule,
} from '../plugins/types'
import type { CompletionReport } from '../rules/completion'
import type { RuleAttemptSummary } from '../rules/ruleAttemptSummaryCollector'
import type { StrongInferenceSummary } from '../rules/strongInferenceSummaryCollector'

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

export type BenchmarkTelemetryLevel = 'off' | 'summary'

export type StrongTelemetryCoverageStatus =
  | 'full'
  | 'partial'
  | 'none'
  | 'not-applicable'

export type StrongTelemetryCoverage = {
  status: StrongTelemetryCoverageStatus
  supportedRules: StrongTelemetryRule[]
  unsupportedRules: StrongTelemetryRule[]
}

export type BenchmarkStrongInferenceTelemetry = {
  coverage: StrongTelemetryCoverage
  summary: StrongInferenceSummary
}

export type BenchmarkTelemetrySummary = {
  ruleAttempts: RuleAttemptSummary
  strongInference: BenchmarkStrongInferenceTelemetry
}

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
  terminal: CompletionReport | null
  telemetry?: BenchmarkTelemetrySummary
  error?: string
}

export type BenchmarkRunConfig = {
  datasetId: string
  startedAt: string
  completedAt: string
  maxSteps: number
  timeoutMs: number
  ruleProfile: 'default'
  telemetry: BenchmarkTelemetryLevel
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
  telemetry?: BenchmarkTelemetrySummary
}

export type BenchmarkReport = {
  schemaVersion: 2
  run: BenchmarkRunConfig
  summary: BenchmarkSummary
  items: BenchmarkPuzzleResult[]
}

export type BenchmarkRunnerOptions = {
  maxSteps?: number
  timeoutMs?: number
  telemetry?: BenchmarkTelemetryLevel
}

export const getStrongTelemetryCoverage = (
  config: PuzzleStrongTelemetryConfig | undefined,
): StrongTelemetryCoverage => {
  const rules = config?.rules ?? []
  const supportedRules = rules.filter((rule) => rule.supported)
  const unsupportedRules = rules.filter((rule) => !rule.supported)
  const status: StrongTelemetryCoverageStatus =
    rules.length === 0
      ? 'not-applicable'
      : unsupportedRules.length === 0
        ? 'full'
        : supportedRules.length === 0
          ? 'none'
          : 'partial'

  return { status, supportedRules, unsupportedRules }
}
