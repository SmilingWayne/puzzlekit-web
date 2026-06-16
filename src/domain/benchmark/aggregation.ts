import type {
  RuleAttemptRuleSummary,
  RuleAttemptSummary,
} from '../rules/ruleAttemptSummaryCollector'
import type {
  StrongInferenceRuleSummary,
  StrongInferenceSummary,
  StrongInferenceTotals,
} from '../rules/strongInferenceSummaryCollector'
import type {
  BenchmarkStrongInferenceTelemetry,
  BenchmarkTelemetrySummary,
  StrongTelemetryCoverage,
} from './types'

const addRecordCounts = (
  target: Record<string, number>,
  source: Record<string, number>,
): void => {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value
  }
}

export const aggregateRuleUsage = (
  records: Array<Record<string, number>>,
): Record<string, number> => {
  const result: Record<string, number> = {}
  for (const record of records) addRecordCounts(result, record)
  return result
}

export const ruleUsageFromAttempts = (
  summary: RuleAttemptSummary,
): Record<string, number> =>
  Object.fromEntries(
    Object.values(summary.rules)
      .filter((rule) => rule.hitCount > 0)
      .map((rule) => [rule.ruleId, rule.hitCount]),
  )

export const aggregateRuleAttemptSummaries = (
  summaries: RuleAttemptSummary[],
): RuleAttemptSummary => {
  const mutable = new Map<
    string,
    Omit<RuleAttemptRuleSummary, 'hitRate' | 'averageDurationMs'>
  >()
  let totalAttemptCount = 0
  for (const summary of summaries) {
    totalAttemptCount += summary.totalAttemptCount
    for (const rule of Object.values(summary.rules)) {
      const target = mutable.get(rule.ruleId) ?? {
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        attemptCount: 0,
        hitCount: 0,
        missCount: 0,
        totalDurationMs: 0,
        hitDurationMs: 0,
        missDurationMs: 0,
        producedDiffCount: 0,
      }
      target.attemptCount += rule.attemptCount
      target.hitCount += rule.hitCount
      target.missCount += rule.missCount
      target.totalDurationMs += rule.totalDurationMs
      target.hitDurationMs += rule.hitDurationMs
      target.missDurationMs += rule.missDurationMs
      target.producedDiffCount += rule.producedDiffCount
      mutable.set(rule.ruleId, target)
    }
  }
  return {
    totalAttemptCount,
    rules: Object.fromEntries(
      Array.from(mutable, ([ruleId, rule]) => [
        ruleId,
        {
          ...rule,
          hitRate:
            rule.attemptCount === 0 ? 0 : rule.hitCount / rule.attemptCount,
          averageDurationMs:
            rule.attemptCount === 0
              ? 0
              : rule.totalDurationMs / rule.attemptCount,
        },
      ]),
    ),
    finalNoHitScan: null,
  }
}

const emptyStrongTotals = (): Omit<StrongInferenceTotals, 'hitRate'> => ({
  attemptCount: 0,
  hitCount: 0,
  missCount: 0,
  timeoutCount: 0,
  candidateCount: 0,
  probeCount: 0,
  trialStepCount: 0,
  probeDurationMs: 0,
  producedDiffCount: 0,
})

const addStrongTotals = (
  target: Omit<StrongInferenceTotals, 'hitRate'>,
  source: StrongInferenceTotals,
): void => {
  target.attemptCount += source.attemptCount
  target.hitCount += source.hitCount
  target.missCount += source.missCount
  target.timeoutCount += source.timeoutCount
  target.candidateCount += source.candidateCount
  target.probeCount += source.probeCount
  target.trialStepCount += source.trialStepCount
  target.probeDurationMs += source.probeDurationMs
  target.producedDiffCount += source.producedDiffCount
}

const snapshotStrongTotals = (
  totals: Omit<StrongInferenceTotals, 'hitRate'>,
): StrongInferenceTotals => ({
  ...totals,
  hitRate:
    totals.attemptCount === 0 ? 0 : totals.hitCount / totals.attemptCount,
})

export const aggregateStrongInferenceSummaries = (
  summaries: StrongInferenceSummary[],
): StrongInferenceSummary => {
  const totals = emptyStrongTotals()
  const rules = new Map<string, Omit<StrongInferenceRuleSummary, 'hitRate'>>()
  for (const summary of summaries) {
    addStrongTotals(totals, summary.totals)
    for (const rule of summary.rules) {
      const target = rules.get(rule.ruleId) ?? {
        ...emptyStrongTotals(),
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
      }
      addStrongTotals(target, rule)
      rules.set(rule.ruleId, target)
    }
  }
  return {
    totals: snapshotStrongTotals(totals),
    rules: Array.from(rules.values(), (rule) => ({
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      ...snapshotStrongTotals(rule),
    })),
  }
}

export const aggregateStrongCoverage = (
  coverages: StrongTelemetryCoverage[],
): StrongTelemetryCoverage => {
  const rules = new Map<
    string,
    StrongTelemetryCoverage['supportedRules'][number]
  >()
  for (const coverage of coverages) {
    for (const rule of [
      ...coverage.supportedRules,
      ...coverage.unsupportedRules,
    ]) {
      const existing = rules.get(rule.ruleId)
      rules.set(rule.ruleId, {
        ...rule,
        supported: Boolean(existing?.supported || rule.supported),
      })
    }
  }
  const supportedRules = Array.from(rules.values()).filter(
    (rule) => rule.supported,
  )
  const unsupportedRules = Array.from(rules.values()).filter(
    (rule) => !rule.supported,
  )
  const status =
    rules.size === 0
      ? 'not-applicable'
      : unsupportedRules.length === 0
        ? 'full'
        : supportedRules.length === 0
          ? 'none'
          : 'partial'
  return { status, supportedRules, unsupportedRules }
}

export const aggregateTelemetrySummaries = (
  summaries: BenchmarkTelemetrySummary[],
): BenchmarkTelemetrySummary => ({
  ruleAttempts: aggregateRuleAttemptSummaries(
    summaries.map((summary) => summary.ruleAttempts),
  ),
  strongInference: {
    coverage: aggregateStrongCoverage(
      summaries.map((summary) => summary.strongInference.coverage),
    ),
    summary: aggregateStrongInferenceSummaries(
      summaries.map((summary) => summary.strongInference.summary),
    ),
  } satisfies BenchmarkStrongInferenceTelemetry,
})
