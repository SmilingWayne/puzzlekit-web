import { puzzleRegistry } from '../plugins/registry'
import type { RuleAttemptRuleSummary } from '../rules/ruleAttemptSummaryCollector'
import type { StrongInferenceRuleSummary } from '../rules/strongInferenceSummaryCollector'
import type { BenchmarkPuzzleResult, BenchmarkReport } from './types'

type TsvValue = string | number | boolean | null | undefined
type TsvRow = Record<string, TsvValue>

export type BenchmarkTsvTables = {
  puzzles: string
  ruleAttempts?: string
  strongInference?: string
}

const PUZZLE_HEADERS = [
  'dataset_id',
  'run_started_at',
  'puzzle_id',
  'puzzle_type',
  'source_url',
  'width',
  'height',
  'status',
  'solved',
  'step_count',
  'duration_ms',
  'terminal_status',
  'terminal_decided_ratio',
  'terminal_unknown_units',
  'error',
  'telemetry_level',
  'total_rule_attempts',
  'total_rule_hits',
  'total_rule_misses',
  'total_rule_duration_ms',
  'final_no_hit_scan_attempts',
  'final_no_hit_scan_duration_ms',
  'strong_coverage',
  'strong_attempts',
  'strong_hits',
  'strong_misses',
  'strong_timeouts',
  'strong_candidates',
  'strong_probes',
  'strong_trial_steps',
  'strong_probe_duration_ms',
  'strong_produced_diffs',
] as const

const RULE_ATTEMPT_HEADERS = [
  'dataset_id',
  'puzzle_id',
  'puzzle_type',
  'puzzle_status',
  'rule_id',
  'rule_name',
  'attempted',
  'attempt_count',
  'hit_count',
  'miss_count',
  'hit_rate',
  'total_duration_ms',
  'hit_duration_ms',
  'miss_duration_ms',
  'average_duration_ms',
  'produced_diff_count',
] as const

const STRONG_INFERENCE_HEADERS = [
  'dataset_id',
  'puzzle_id',
  'puzzle_type',
  'puzzle_status',
  'coverage_status',
  'rule_id',
  'rule_name',
  'telemetry_supported',
  'attempted',
  'attempt_count',
  'hit_count',
  'miss_count',
  'timeout_count',
  'hit_rate',
  'candidate_count',
  'probe_count',
  'trial_step_count',
  'probe_duration_ms',
  'produced_diff_count',
] as const

const serializeTsvValue = (value: TsvValue): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return String(Number(value.toFixed(6)))
  }
  return String(value).replaceAll('\t', ' ').replaceAll(/\r?\n/g, ' ')
}

export const serializeTsv = (
  headers: readonly string[],
  rows: TsvRow[],
): string =>
  [
    headers.join('\t'),
    ...rows.map((row) =>
      headers.map((header) => serializeTsvValue(row[header])).join('\t'),
    ),
  ].join('\n') + '\n'

const sumRuleMetric = (
  item: BenchmarkPuzzleResult,
  metric: keyof Pick<
    RuleAttemptRuleSummary,
    'hitCount' | 'missCount' | 'totalDurationMs'
  >,
): number | undefined => {
  if (!item.telemetry) return undefined
  return Object.values(item.telemetry.ruleAttempts.rules).reduce(
    (total, rule) => total + rule[metric],
    0,
  )
}

const buildPuzzleRow = (
  report: BenchmarkReport,
  item: BenchmarkPuzzleResult,
): TsvRow => {
  const strong = item.telemetry?.strongInference
  const strongTotals = strong?.summary.totals
  const finalScan = item.telemetry?.ruleAttempts.finalNoHitScan
  return {
    dataset_id: report.run.datasetId,
    run_started_at: report.run.startedAt,
    puzzle_id: item.id,
    puzzle_type: item.puzzleType,
    source_url: item.sourceUrl,
    width: item.width,
    height: item.height,
    status: item.status,
    solved: item.status === 'solved',
    step_count: item.stepCount,
    duration_ms: item.durationMs,
    terminal_status: item.terminal?.status,
    terminal_decided_ratio: item.terminal?.stats.decidedRatio,
    terminal_unknown_units: item.terminal?.stats.unknownUnits,
    error: item.error,
    telemetry_level: report.run.telemetry,
    total_rule_attempts: item.telemetry?.ruleAttempts.totalAttemptCount,
    total_rule_hits: sumRuleMetric(item, 'hitCount'),
    total_rule_misses: sumRuleMetric(item, 'missCount'),
    total_rule_duration_ms: sumRuleMetric(item, 'totalDurationMs'),
    final_no_hit_scan_attempts: finalScan?.attemptCount,
    final_no_hit_scan_duration_ms: finalScan?.totalDurationMs,
    strong_coverage: strong?.coverage.status,
    strong_attempts: strongTotals?.attemptCount,
    strong_hits: strongTotals?.hitCount,
    strong_misses: strongTotals?.missCount,
    strong_timeouts: strongTotals?.timeoutCount,
    strong_candidates: strongTotals?.candidateCount,
    strong_probes: strongTotals?.probeCount,
    strong_trial_steps: strongTotals?.trialStepCount,
    strong_probe_duration_ms: strongTotals?.probeDurationMs,
    strong_produced_diffs: strongTotals?.producedDiffCount,
  }
}

const emptyRuleSummary = (
  ruleId: string,
  ruleName: string,
): RuleAttemptRuleSummary => ({
  ruleId,
  ruleName,
  attemptCount: 0,
  hitCount: 0,
  missCount: 0,
  hitRate: 0,
  totalDurationMs: 0,
  hitDurationMs: 0,
  missDurationMs: 0,
  averageDurationMs: 0,
  producedDiffCount: 0,
})

const buildRuleAttemptRows = (
  report: BenchmarkReport,
  item: BenchmarkPuzzleResult,
): TsvRow[] => {
  if (!item.telemetry) return []
  const pluginRules = puzzleRegistry.get(item.puzzleType)?.getRules() ?? []
  const observedRules = item.telemetry.ruleAttempts.rules
  const ruleOrder = new Map(pluginRules.map((rule, index) => [rule.id, index]))
  const rules = new Map(
    pluginRules.map((rule) => [
      rule.id,
      observedRules[rule.id] ?? emptyRuleSummary(rule.id, rule.name),
    ]),
  )
  for (const rule of Object.values(observedRules)) {
    if (!rules.has(rule.ruleId)) rules.set(rule.ruleId, rule)
  }

  return Array.from(rules.values())
    .sort(
      (left, right) =>
        (ruleOrder.get(left.ruleId) ?? Number.MAX_SAFE_INTEGER) -
          (ruleOrder.get(right.ruleId) ?? Number.MAX_SAFE_INTEGER) ||
        left.ruleId.localeCompare(right.ruleId),
    )
    .map((rule) => ({
      dataset_id: report.run.datasetId,
      puzzle_id: item.id,
      puzzle_type: item.puzzleType,
      puzzle_status: item.status,
      rule_id: rule.ruleId,
      rule_name: rule.ruleName,
      attempted: rule.attemptCount > 0,
      attempt_count: rule.attemptCount,
      hit_count: rule.hitCount,
      miss_count: rule.missCount,
      hit_rate: rule.hitRate,
      total_duration_ms: rule.totalDurationMs,
      hit_duration_ms: rule.hitDurationMs,
      miss_duration_ms: rule.missDurationMs,
      average_duration_ms: rule.averageDurationMs,
      produced_diff_count: rule.producedDiffCount,
    }))
}

const buildStrongInferenceRows = (
  report: BenchmarkReport,
  item: BenchmarkPuzzleResult,
): TsvRow[] => {
  const strong = item.telemetry?.strongInference
  if (!strong) return []
  const observed = new Map(
    strong.summary.rules.map((rule) => [rule.ruleId, rule]),
  )
  const declaredRules = [
    ...strong.coverage.supportedRules,
    ...strong.coverage.unsupportedRules,
  ]
  return declaredRules.map((declared) => {
    const rule: StrongInferenceRuleSummary | undefined = observed.get(
      declared.ruleId,
    )
    const supported = declared.supported
    return {
      dataset_id: report.run.datasetId,
      puzzle_id: item.id,
      puzzle_type: item.puzzleType,
      puzzle_status: item.status,
      coverage_status: strong.coverage.status,
      rule_id: declared.ruleId,
      rule_name: declared.ruleName,
      telemetry_supported: supported,
      attempted: supported ? (rule?.attemptCount ?? 0) > 0 : undefined,
      attempt_count: supported ? (rule?.attemptCount ?? 0) : undefined,
      hit_count: supported ? (rule?.hitCount ?? 0) : undefined,
      miss_count: supported ? (rule?.missCount ?? 0) : undefined,
      timeout_count: supported ? (rule?.timeoutCount ?? 0) : undefined,
      hit_rate: supported ? (rule?.hitRate ?? 0) : undefined,
      candidate_count: supported ? (rule?.candidateCount ?? 0) : undefined,
      probe_count: supported ? (rule?.probeCount ?? 0) : undefined,
      trial_step_count: supported ? (rule?.trialStepCount ?? 0) : undefined,
      probe_duration_ms: supported ? (rule?.probeDurationMs ?? 0) : undefined,
      produced_diff_count: supported
        ? (rule?.producedDiffCount ?? 0)
        : undefined,
    }
  })
}

export const formatBenchmarkReportTsv = (
  report: BenchmarkReport,
): BenchmarkTsvTables => {
  const puzzles = serializeTsv(
    PUZZLE_HEADERS,
    report.items.map((item) => buildPuzzleRow(report, item)),
  )
  if (report.run.telemetry === 'off') return { puzzles }

  return {
    puzzles,
    ruleAttempts: serializeTsv(
      RULE_ATTEMPT_HEADERS,
      report.items.flatMap((item) => buildRuleAttemptRows(report, item)),
    ),
    strongInference: serializeTsv(
      STRONG_INFERENCE_HEADERS,
      report.items.flatMap((item) => buildStrongInferenceRows(report, item)),
    ),
  }
}
