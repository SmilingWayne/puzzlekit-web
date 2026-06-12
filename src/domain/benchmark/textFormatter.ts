import type { BenchmarkReport } from './types'

const formatDuration = (durationMs: number): string =>
  durationMs >= 1000
    ? `${(durationMs / 1000).toFixed(2)}s`
    : `${durationMs.toFixed(1)}ms`

const formatRuleRows = (
  report: BenchmarkReport,
  kind: 'duration' | 'misses',
): string[] => {
  const rules = Object.values(
    report.summary.telemetry?.ruleAttempts.rules ?? {},
  )
  const sorted = [...rules]
    .sort((left, right) =>
      kind === 'duration'
        ? right.totalDurationMs - left.totalDurationMs
        : right.missCount - left.missCount ||
          right.missDurationMs - left.missDurationMs,
    )
    .slice(0, 5)
  if (sorted.length === 0) return ['  (no rule-attempt telemetry)']
  return sorted.map(
    (rule) =>
      `  ${rule.ruleId}: ${formatDuration(rule.totalDurationMs)}, ${rule.hitCount}/${rule.attemptCount} hits, ${rule.missCount} misses`,
  )
}

export const formatBenchmarkReportText = (report: BenchmarkReport): string => {
  const { summary } = report
  const lines = [
    `${report.run.datasetId} (schema v${report.schemaVersion}, telemetry ${report.run.telemetry})`,
    `Status: ${summary.solved} solved, ${summary.stalled} stalled, ${summary.parseError} parse errors, ${summary.runtimeError} runtime errors, ${summary.stepCapped} step capped, ${summary.timeCapped} time capped`,
    `Total: ${summary.total} puzzles, ${formatDuration(summary.totalDurationMs)}`,
    '',
    'Puzzles:',
    ...report.items.map(
      (item) =>
        `  ${item.id}: ${item.status}, ${item.stepCount} steps, ${formatDuration(item.durationMs)}`,
    ),
  ]

  if (!summary.telemetry) return lines.join('\n')

  lines.push(
    '',
    'Most expensive rules:',
    ...formatRuleRows(report, 'duration'),
    '',
    'Most frequently missed rules:',
    ...formatRuleRows(report, 'misses'),
  )

  const strong = summary.telemetry.strongInference
  const totals = strong.summary.totals
  lines.push(
    '',
    `Strong inference (${strong.coverage.status} coverage): ${totals.attemptCount} attempts, ${totals.hitCount} hits, ${totals.missCount} misses, ${totals.timeoutCount} timeouts`,
    `  ${totals.probeCount} probes, ${totals.trialStepCount} trial steps, ${formatDuration(totals.probeDurationMs)} probe time`,
  )
  if (strong.coverage.unsupportedRules.length > 0) {
    lines.push(
      '  Telemetry not implemented:',
      ...strong.coverage.unsupportedRules.map(
        (rule) => `    ${rule.ruleId} (${rule.ruleName})`,
      ),
    )
  }

  return lines.join('\n')
}
