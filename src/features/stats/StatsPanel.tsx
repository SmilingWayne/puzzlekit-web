import { useMemo } from 'react'
import {
  buildRuleTraceStats,
  buildTraceChartStats,
  type TraceChartPoint,
} from '../../domain/difficulty/traceStats'
import type { PuzzleIR } from '../../domain/ir/types'
import type { RuleStep } from '../../domain/rules/types'

type Props = {
  initialPuzzle: PuzzleIR
  steps: RuleStep[]
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

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value))

const makePath = (
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): string => {
  if (values.length === 0) {
    return ''
  }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const xFor = (index: number): number =>
    padding.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * plotWidth)
  const yFor = (value: number): number => padding.top + (1 - clampRatio(value)) * plotHeight
  return values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`).join(' ')
}

const TraceLineChart = ({
  title,
  description,
  series,
  currentIndex,
}: {
  title: string
  description: string
  series: ChartSeries[]
  currentIndex: number
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
  const yFor = (value: number): number => padding.top + (1 - clampRatio(value)) * plotHeight

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
          100%
        </text>
        <text x={14} y={height - padding.bottom + 4} className="chart-axis-label">
          0%
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
            d={makePath(item.values, width, height, padding)}
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
            {item.label} {formatPercent(item.values[clampedIndex] ?? 0)}
          </span>
        ))}
      </div>
    </section>
  )
}

const getBoardProgressSeries = (points: TraceChartPoint[]): ChartSeries[] => [
  {
    label: 'Progress',
    color: '#0891b2',
    values: points.map((point) => point.boardProgressRatio),
  },
]

const getCoverageSeries = (points: TraceChartPoint[]): ChartSeries[] => [
  {
    label: 'Edge',
    color: '#2563eb',
    values: points.map((point) => point.edgeCoverageRatio),
  },
  {
    label: 'Cell',
    color: '#16a34a',
    values: points.map((point) => point.cellCoverageRatio),
  },
  {
    label: 'Vertex',
    color: '#d97706',
    values: points.map((point) => point.vertexCoverageRatio),
  },
]

export const StatsPanel = ({ initialPuzzle, steps, pointer, isRunning, onGoToStep }: Props) => {
  const stats = useMemo(() => buildRuleTraceStats(steps, pointer), [pointer, steps])
  const chartStats = useMemo(
    () => buildTraceChartStats(initialPuzzle, steps, pointer),
    [initialPuzzle, pointer, steps],
  )

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
          <span>Step {chartStats.pointer} of {chartStats.totalSteps}</span>
        </div>
        <input
          id="live-stats-timeline"
          className="timeline-slider stats-timeline-slider"
          type="range"
          min={0}
          max={steps.length}
          value={stats.pointer}
          disabled={isRunning || steps.length === 0}
          aria-valuetext={`Step ${stats.pointer} of ${steps.length}`}
          onChange={(event) => onGoToStep(Number(event.target.value))}
        />
      </div>

      <div className="stats-chart-grid">
        <TraceLineChart
          title="Board Progress"
          description="Decided edges over the whole board"
          series={getBoardProgressSeries(chartStats.points)}
          currentIndex={chartStats.pointer}
        />
        <TraceLineChart
          title="Inference Coverage"
          description="State coverage by inferred element type"
          series={getCoverageSeries(chartStats.points)}
          currentIndex={chartStats.pointer}
        />
      </div>

      <div className="rule-usage-panel">
        <div className="rule-usage-header">
          <h3>Rule Usage</h3>
          <span>{stats.rules.length} rules in generated trace</span>
        </div>
        {stats.rules.length === 0 ? (
          <p className="rule-usage-empty">No generated steps yet.</p>
        ) : (
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
        )}
      </div>
    </section>
  )
}
