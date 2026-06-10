import { useMemo, useState } from 'react'
import {
  buildTraceStatsView,
  type TraceStatsCache,
} from '../../domain/difficulty/traceStats'
import { puzzleRegistry } from '../../domain/plugins/registry'

type Props = {
  pluginId: string
  traceStatsCache: TraceStatsCache
  pointer: number
  isRunning: boolean
  onGoToStep: (targetPointer: number) => void
}

type ChartSeries = {
  label: string
  color: string
  values: number[]
}

const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`

const formatDuration = (durationMs: number): string => {
  if (durationMs < 1000) {
    return `${durationMs.toFixed(1)} ms`
  }
  return `${(durationMs / 1000).toFixed(2)} s`
}

const formatStepList = (stepNumbers: number[]): string => {
  if (stepNumbers.length === 0) {
    return '-'
  }
  if (stepNumbers.length <= 8) {
    return stepNumbers.join(', ')
  }
  return `${stepNumbers.slice(0, 8).join(', ')} +${stepNumbers.length - 8}`
}

const formatStepSummary = (stepNumbers: number[]): string => {
  if (stepNumbers.length === 0) {
    return 'No active steps'
  }
  const first = stepNumbers[0]
  const last = stepNumbers[stepNumbers.length - 1]
  return first === last
    ? `Step ${first}`
    : `${stepNumbers.length} hits, steps ${first}-${last}`
}

const clampValue = (value: number, maxValue: number): number =>
  Math.min(maxValue, Math.max(0, value))

const MAX_RENDERED_POINTS = 400

const sampleChartValues = (values: number[]): Array<{ index: number; value: number }> => {
  if (values.length <= MAX_RENDERED_POINTS) {
    return values.map((value, index) => ({ index, value }))
  }
  const lastIndex = values.length - 1
  const sampled = Array.from({ length: MAX_RENDERED_POINTS }, (_, index) => {
    const sourceIndex = Math.round((index / (MAX_RENDERED_POINTS - 1)) * lastIndex)
    return { index: sourceIndex, value: values[sourceIndex] }
  })
  return sampled.filter((item, index, arr) => index === 0 || item.index !== arr[index - 1].index)
}

const makePath = (
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): string => {
  if (values.length === 0) {
    return ''
  }
  const sampled = sampleChartValues(values)
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const xFor = (index: number): number =>
    padding.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * plotWidth)
  const yFor = (value: number): number =>
    padding.top + (1 - clampValue(value, maxValue) / maxValue) * plotHeight
  return sampled
    .map(({ index, value }, sampledIndex) => `${sampledIndex === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`)
    .join(' ')
}

const TraceLineChart = ({
  title,
  description,
  series,
  currentIndex,
  maxValue,
  formatValue,
}: {
  title: string
  description: string
  series: ChartSeries[]
  currentIndex: number
  maxValue: number
  formatValue: (value: number) => string
}) => {
  const width = 360
  const height = 190
  const padding = { top: 18, right: 18, bottom: 30, left: 36 }
  const maxLength = Math.max(1, ...series.map((item) => item.values.length))
  const clampedIndex = Math.min(maxLength - 1, Math.max(0, currentIndex))
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const xFor = (index: number): number =>
    padding.left + (maxLength <= 1 ? 0 : (index / (maxLength - 1)) * plotWidth)
  const safeMaxValue = Math.max(1, maxValue)
  const yFor = (value: number): number =>
    padding.top + (1 - clampValue(value, safeMaxValue) / safeMaxValue) * plotHeight

  return (
    <section className="trace-chart-card" aria-label={title}>
      <div className="trace-chart-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>Step {clampedIndex}</span>
      </div>
      <svg className="trace-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} line chart`}>
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="chart-axis" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="chart-axis" />
        <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} className="chart-grid-line" />
        <line x1={padding.left} y1={padding.top + plotHeight / 2} x2={width - padding.right} y2={padding.top + plotHeight / 2} className="chart-grid-line" />
        <text x={4} y={padding.top + 4} className="chart-axis-label">
          {formatValue(maxValue)}
        </text>
        <text x={14} y={height - padding.bottom + 4} className="chart-axis-label">
          {formatValue(0)}
        </text>
        <text x={padding.left} y={height - 8} className="chart-axis-label">
          0
        </text>
        <text x={width - padding.right} y={height - 8} textAnchor="end" className="chart-axis-label">
          {Math.max(0, maxLength - 1)}
        </text>
        {series.map((item) => (
          <path
            key={item.label}
            d={makePath(item.values, safeMaxValue, width, height, padding)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <line
          x1={xFor(clampedIndex)}
          y1={padding.top}
          x2={xFor(clampedIndex)}
          y2={height - padding.bottom}
          className="chart-current-line"
        />
        {series.map((item) => {
          const value = item.values[clampedIndex] ?? 0
          return (
            <circle
              key={`${item.label}-marker`}
              cx={xFor(clampedIndex)}
              cy={yFor(value)}
              r="4"
              fill={item.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
          )
        })}
      </svg>
      <div className="trace-chart-legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ backgroundColor: item.color }} />
            {item.label} {formatValue(item.values[clampedIndex] ?? 0)}
          </span>
        ))}
      </div>
    </section>
  )
}

const MAX_RULE_BARS = 8

const RuleUsageBars = ({ rules }: { rules: ReturnType<typeof buildTraceStatsView>['rules'] }) => {
  const activeRules = useMemo(
    () =>
      rules
        .filter((rule) => rule.count > 0)
        .sort((a, b) => b.count - a.count || b.durationMs - a.durationMs || a.ruleName.localeCompare(b.ruleName))
        .slice(0, MAX_RULE_BARS),
    [rules],
  )
  const maxCount = Math.max(1, ...activeRules.map((rule) => rule.count))

  if (activeRules.length === 0) {
    return <p className="rule-usage-empty">No rules have fired in the active prefix.</p>
  }

  return (
    <div className="rule-usage-bars" role="list" aria-label="Top rule usage">
      {activeRules.map((rule) => {
        const width = `${Math.max(4, (rule.count / maxCount) * 100)}%`
        return (
          <div className="rule-usage-bar-row" role="listitem" key={rule.ruleId}>
            <div className="rule-usage-bar-meta">
              <span className="rule-name">{rule.ruleName}</span>
              <span className="rule-step-summary">{formatStepSummary(rule.steps)}</span>
            </div>
            <div className="rule-usage-bar-track" aria-hidden="true">
              <span style={{ width }} />
            </div>
            <div className="rule-usage-bar-values">
              <strong>{rule.count}</strong>
              <span>{formatPercent(rule.percent)}</span>
              <span>{formatDuration(rule.durationMs)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const StatsPanel = ({ pluginId, traceStatsCache, pointer, isRunning, onGoToStep }: Props) => {
  const stats = useMemo(() => buildTraceStatsView(traceStatsCache, pointer), [pointer, traceStatsCache])
  const [showRuleDetails, setShowRuleDetails] = useState(false)
  const liveStats = puzzleRegistry.get(pluginId)?.liveStats
  const coverageSeries = useMemo(
    () =>
      (liveStats?.coverageSeries ?? []).map((series) => ({
        label: series.label,
        color: series.color,
        values: traceStatsCache.points.map((point) => point.coverageRatios[series.source]),
      })),
    [liveStats, traceStatsCache],
  )
  const durationSeries = useMemo<ChartSeries[]>(
    () => [
      {
        label: 'Full Step',
        color: '#dc2626',
        values: traceStatsCache.points.map((point) => point.stepDurationMs),
      },
      {
        label: 'Matched Rule',
        color: '#0891b2',
        values: traceStatsCache.points.map((point) => point.ruleApplyMs),
      },
    ],
    [traceStatsCache],
  )
  const maxDurationMs = Math.max(1, ...durationSeries.flatMap((series) => series.values))

  return (
    <section className="panel-card stats" aria-label="Live Stats">
      <header className="panel-header">
        <h2>Live Stats</h2>
      </header>
      <div className="stats-summary-grid">
        <div>
          <span>Current Step</span>
          <strong>
            {stats.pointer} / {stats.totalSteps}
          </strong>
        </div>
        <div>
          <span>Total Rule Time</span>
          <strong>{formatDuration(stats.totalDurationMs)}</strong>
        </div>
        <div>
          <span>Unique Rules Applied</span>
          <strong>{stats.uniqueRulesUsed}</strong>
        </div>
      </div>

      <div className="stats-timeline-row">
        <div className="timeline-header">
          <label htmlFor="live-stats-timeline">Trace Timeline</label>
          <span>Step {stats.pointer} of {stats.totalSteps}</span>
        </div>
        <input
          id="live-stats-timeline"
          className="timeline-slider stats-timeline-slider"
          type="range"
          min={0}
          max={stats.totalSteps}
          value={stats.pointer}
          disabled={isRunning || stats.totalSteps === 0}
          aria-valuetext={`Step ${stats.pointer} of ${stats.totalSteps}`}
          onChange={(event) => onGoToStep(Number(event.target.value))}
        />
      </div>

      <div className="stats-chart-grid">
        <TraceLineChart
          title={liveStats?.coverageTitle ?? 'Inference Coverage'}
          description={liveStats?.coverageDescription ?? 'State coverage by inferred element type'}
          series={coverageSeries}
          currentIndex={stats.pointer}
          maxValue={1}
          formatValue={formatPercent}
        />
        <TraceLineChart
          title="Step Duration"
          description="Full rule-chain time and matched rule apply time"
          series={durationSeries}
          currentIndex={stats.pointer}
          maxValue={maxDurationMs}
          formatValue={formatDuration}
        />
      </div>

      <div className="rule-usage-panel">
        <div className="rule-usage-header">
          <h3>Rule Usage</h3>
          <div className="rule-usage-actions">
            <span>{stats.rules.length} rules in generated trace</span>
            <button
              type="button"
              className="button-compact"
              aria-expanded={showRuleDetails}
              onClick={() => setShowRuleDetails((value) => !value)}
            >
              {showRuleDetails ? 'Hide Details' : 'View Details'}
            </button>
          </div>
        </div>
        {stats.rules.length === 0 ? (
          <p className="rule-usage-empty">No generated steps yet.</p>
        ) : (
          <>
            <RuleUsageBars rules={stats.rules} />
            {showRuleDetails ? (
              <div className="rule-usage-table-wrap">
                <table className="rule-usage-table">
                  <thead>
                    <tr>
                      <th scope="col">Rule</th>
                      <th scope="col">Count</th>
                      <th scope="col">Share</th>
                      <th scope="col">Time</th>
                      <th scope="col">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.rules.map((rule) => (
                      <tr key={rule.ruleId}>
                        <td>
                          <span className="rule-name">{rule.ruleName}</span>
                          <span className="rule-id">{rule.ruleId}</span>
                        </td>
                        <td>{rule.count}</td>
                        <td>{formatPercent(rule.percent)}</td>
                        <td>{formatDuration(rule.durationMs)}</td>
                        <td className="rule-step-list">{formatStepList(rule.steps)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
