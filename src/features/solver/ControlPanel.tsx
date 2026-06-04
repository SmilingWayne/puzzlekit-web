import { useEffect, useMemo, useState } from 'react'
import {
  exportPuzzle,
  exporters,
  isPuzzleUrlExportFormat,
  tryEncodePuzzleUrl,
} from '../../domain/exporters'
import type { ExportFormat } from '../../domain/exporters/types'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { BoardLegendButton } from '../board/BoardLegendButton'
import { PuzzleInfoButton } from '../puzzleInfo/PuzzleInfoButton'
import {
  buildDifficultySnapshot,
  DEFAULT_MASYU_SAMPLE_URL,
  DEFAULT_SLITHERLINK_SAMPLE_URL,
  MAX_SOLVE_CHUNK_SIZE,
  useSolverStore,
} from './solverStore'

type ActivePuzzlePopover = 'rules' | 'legend' | null

export const ControlPanel = () => {
  const {
    pluginId,
    sourceUrl,
    importError,
    setSourceUrl,
    setPluginId,
    importFromUrl,
    nextStep,
    prevStep,
    goToStep,
    solveAll,
    resetTimeline,
    solveChunkSize,
    setSolveChunkSize,
    isRunning,
    currentPuzzle,
    terminalReport,
    steps,
    pointer,
  } = useSolverStore()
  const [localUrl, setLocalUrl] = useState(sourceUrl)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('puzzlink')
  const [exportText, setExportText] = useState('')
  const [showExportPanel, setShowExportPanel] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [exportGenerateError, setExportGenerateError] = useState('')
  const [showImportErrorDialog, setShowImportErrorDialog] = useState(false)
  const [showTerminalReport, setShowTerminalReport] = useState(false)
  const [timelinePreviewStep, setTimelinePreviewStep] = useState<number | null>(null)
  const [activePuzzlePopover, setActivePuzzlePopover] = useState<ActivePuzzlePopover>(null)
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])
  const difficulty = useMemo(() => buildDifficultySnapshot(activeSteps), [activeSteps])
  const ruleUsageEntries = useMemo(
    () => Object.entries(difficulty.ruleUsage).sort(([a], [b]) => a.localeCompare(b)),
    [difficulty.ruleUsage],
  )
  const terminalCoverage = terminalReport
    ? `${(terminalReport.stats.decidedRatio * 100).toFixed(1)}%`
    : '0.0%'
  const terminalDurationSeconds = terminalReport
    ? `${(terminalReport.totalDurationMs / 1000).toFixed(2)} s`
    : '0.00 s'

  useEffect(() => {
    setLocalUrl(sourceUrl)
  }, [sourceUrl])

  useEffect(() => {
    setShowTerminalReport(terminalReport !== null)
  }, [terminalReport])

  useEffect(() => {
    setShowImportErrorDialog(Boolean(importError))
  }, [importError])

  const solveChunkLabel = `Next ${solveChunkSize} ${solveChunkSize === 1 ? 'Step' : 'Steps'}`
  const previousChunkLabel = `Prev ${solveChunkSize} ${solveChunkSize === 1 ? 'Step' : 'Steps'}`
  const timelineStepForTooltip = timelinePreviewStep ?? pointer
  const timelineTooltipLeft =
    steps.length > 0 ? `${Math.min(100, Math.max(0, (timelineStepForTooltip / steps.length) * 100))}%` : '0%'

  return (
    <section className="panel-card control-panel-card">
      <header className="panel-header">
        <h2>Input & Controls</h2>
      </header>
      <div className="label-row type-row-wrap">
        <span className="type-row-label">Puzzle Type</span>
        <div className="type-row-controls">
          <select
            value={pluginId}
            onChange={(event) => {
              const nextPluginId = event.target.value
              setActivePuzzlePopover(null)
              if (nextPluginId === 'masyu') {
                setLocalUrl(DEFAULT_MASYU_SAMPLE_URL)
                importFromUrl(DEFAULT_MASYU_SAMPLE_URL, nextPluginId)
                return
              }
              if (nextPluginId === 'slitherlink') {
                setLocalUrl(DEFAULT_SLITHERLINK_SAMPLE_URL)
                importFromUrl(DEFAULT_SLITHERLINK_SAMPLE_URL, nextPluginId)
                return
              }
              setPluginId(nextPluginId)
            }}
          >
            {puzzleRegistry.all().map((plugin) => (
              <option key={plugin.id} value={plugin.id}>
                {plugin.displayName}
              </option>
            ))}
          </select>
          <PuzzleInfoButton
            pluginId={pluginId}
            isOpen={activePuzzlePopover === 'rules'}
            onToggle={() =>
              setActivePuzzlePopover((current) => (current === 'rules' ? null : 'rules'))
            }
            onClose={() => setActivePuzzlePopover(null)}
          />
          <BoardLegendButton
            pluginId={pluginId}
            isOpen={activePuzzlePopover === 'legend'}
            onToggle={() =>
              setActivePuzzlePopover((current) => (current === 'legend' ? null : 'legend'))
            }
            onClose={() => setActivePuzzlePopover(null)}
          />
        </div>
      </div>
      <label className="label-row">
        <span className="url-format-links">
          URL (
          <a href="https://puzz.link/list.html" target="_blank" rel="noreferrer">
            puzz.link
          </a>
          ,{' '}
          <a href="https://pzplus.tck.mn/list.html" target="_blank" rel="noreferrer">
            pzplus
          </a>
          ,{' '}
          <a href="http://pzv.jp/" target="_blank" rel="noreferrer">
            pzv
          </a>
          , or{' '}
          <a href="https://swaroopg92.github.io/penpa-edit/" target="_blank" rel="noreferrer">
            penpa+
          </a>
          {' formats supported)'}
        </span>
        <textarea
          rows={2}
          value={localUrl}
          onChange={(event) => setLocalUrl(event.target.value)}
          placeholder="Paste puzz.link, pzplus, pzv, or penpa URL"
        />
      </label>
      <div className="control-groups">
        <div className="control-group compact-control-group">
          <span className="control-group-title">Puzzle I/O</span>
          <div className="button-row io-action-row">
            <button
              onClick={() => {
                setShowImportErrorDialog(true)
                setSourceUrl(localUrl)
                importFromUrl(localUrl, pluginId)
              }}
            >
              Import URL
            </button>
            <button onClick={resetTimeline}>Reset Replay</button>
            <button
              data-active={showExportPanel}
              onClick={() => {
                setShowExportPanel((prev) => !prev)
                setCopyFeedback('')
                setExportGenerateError('')
              }}
            >
              {showExportPanel ? 'Close Export' : 'Export…'}
            </button>
          </div>
        </div>
        <div className="control-group compact-control-group">
          <span className="control-group-title">Replay</span>
          <div className="button-row replay-step-row">
            <button disabled={isRunning || pointer === 0} onClick={prevStep}>
              Prev Step
            </button>
            <button disabled={isRunning || terminalReport !== null} onClick={nextStep}>
              Next Step
            </button>
          </div>
          <div className="chunk-stepper-row">
            <button
              type="button"
              disabled={isRunning || pointer === 0}
              onClick={() => goToStep(pointer - solveChunkSize)}
            >
              {previousChunkLabel}
            </button>
            <label className="chunk-stepper-field">
              <span className="sr-only">Step Chunk</span>
              <input
                type="number"
                min={1}
                max={MAX_SOLVE_CHUNK_SIZE}
                value={solveChunkSize}
                aria-label="Step Chunk"
                onChange={(event) => setSolveChunkSize(Number(event.target.value))}
              />
            </label>
            <button
              disabled={isRunning || terminalReport !== null}
              onClick={() => {
                void solveAll()
              }}
            >
              {solveChunkLabel}
            </button>
          </div>
          <div className="timeline-row">
            <div className="timeline-header">
              <label htmlFor="replay-timeline">Replay Timeline</label>
              <span>
                Step {pointer} / {steps.length}
              </span>
            </div>
            <div className="timeline-slider-wrap">
              <input
                id="replay-timeline"
                className="timeline-slider"
                type="range"
                min={0}
                max={steps.length}
                value={pointer}
                disabled={isRunning || steps.length === 0}
                aria-valuetext={`Step ${pointer} of ${steps.length}`}
                onMouseEnter={() => setTimelinePreviewStep(pointer)}
                onMouseLeave={() => setTimelinePreviewStep(null)}
                onFocus={() => setTimelinePreviewStep(pointer)}
                onBlur={() => setTimelinePreviewStep(null)}
                onChange={(event) => {
                  const targetStep = Number(event.target.value)
                  setTimelinePreviewStep(targetStep)
                  goToStep(targetStep)
                }}
              />
              {timelinePreviewStep !== null && steps.length > 0 ? (
                <span
                  className="timeline-tooltip"
                  style={{ left: timelineTooltipLeft }}
                  aria-hidden="true"
                >
                  Step {timelineStepForTooltip}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {importError && showImportErrorDialog ? (
        <div className="import-error-overlay">
          <div
            className="import-error-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="import-error-title"
          >
            <div className="import-error-header">
              <h3 id="import-error-title">Import failed</h3>
              <button
                type="button"
                className="button-compact"
                onClick={() => setShowImportErrorDialog(false)}
              >
                Close
              </button>
            </div>
            <p className="import-error-summary">
              The puzzle data could not be imported. Check the URL, or expand details for the parser
              error.
            </p>
            <details className="import-error-details">
              <summary>Show error details</summary>
              <pre>{importError}</pre>
            </details>
          </div>
        </div>
      ) : null}
      {terminalReport && showTerminalReport ? (
        <div className="solve-report-dialog" role="dialog" aria-modal="false" aria-labelledby="solve-report-title">
          <div className="solve-report-header">
            <h3 id="solve-report-title">
              {terminalReport.status === 'solved' ? 'Solved! 😃' : 'No further progress found. 😭'}
            </h3>
            <button type="button" className="button-compact" onClick={() => setShowTerminalReport(false)}>
              Close
            </button>
          </div>
          <div className="solve-report-grid">
            <div>
              <span>Total Steps</span>
              <strong>{terminalReport.stepCount}</strong>
            </div>
            <div>
              <span>Total Time</span>
              <strong>{terminalDurationSeconds}</strong>
            </div>
            {terminalReport.status === 'stalled' ? (
              <>
                <div>
                  <span>Decided {terminalReport.stats.unitLabel}</span>
                  <strong>
                    {terminalReport.stats.decidedUnits} / {terminalReport.stats.totalUnits},{' '}
                    {terminalCoverage}
                  </strong>
                </div>
                <div>
                  <span>Unknown {terminalReport.stats.unitLabel}</span>
                  <strong>{terminalReport.stats.unknownUnits}</strong>
                </div>
              </>
            ) : null}
          </div>
          {terminalReport.status === 'stalled' && terminalReport.reasons.length > 0 ? (
            <div className="solve-report-section">
              <h4>Current blockers</h4>
              <ul>
                {terminalReport.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="solve-report-section">
            <h4>Rule Usage</h4>
            {ruleUsageEntries.length === 0 ? (
              <p>None yet</p>
            ) : (
              <ul>
                {ruleUsageEntries.map(([rule, count]) => (
                  <li key={rule}>
                    {rule}: {count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      {showExportPanel ? (
        <section
          className="export-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="export-panel-title"
        >
          <header className="export-panel-header">
            <h2 id="export-panel-title">Export Puzzle</h2>
            <button
              type="button"
              className="panel-icon-close"
              aria-label="Close export panel"
              onClick={() => setShowExportPanel(false)}
            >
              ×
            </button>
          </header>
          <label className="label-row compact">
            Export Format
            <select
              value={exportFormat}
              onChange={(event) => {
                setExportFormat(event.target.value as ExportFormat)
                setExportGenerateError('')
              }}
            >
              {exporters.map((item) => (
                <option key={item.format} value={item.format}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button
              onClick={() => {
                setCopyFeedback('')
                if (isPuzzleUrlExportFormat(exportFormat)) {
                  const result = tryEncodePuzzleUrl({ puzzle: currentPuzzle, pluginId }, exportFormat)
                  if (result.ok === false) {
                    setExportGenerateError(result.message)
                    return
                  }
                  setExportGenerateError('')
                  setExportText(result.url)
                  return
                }
                setExportGenerateError('')
                setExportText(exportPuzzle({ puzzle: currentPuzzle, pluginId }, exportFormat))
              }}
            >
              Generate Export
            </button>
            <button
              onClick={async () => {
                if (!exportText.trim()) {
                  setCopyFeedback('Nothing to copy yet.')
                  return
                }
                try {
                  await navigator.clipboard.writeText(exportText)
                  setCopyFeedback('Copied to clipboard.')
                } catch {
                  setCopyFeedback('Clipboard copy failed in this browser context.')
                }
              }}
            >
              Copy to Clipboard
            </button>
          </div>
          {exportGenerateError ? <p className="error-text">{exportGenerateError}</p> : null}
          {copyFeedback ? <p className="copy-feedback">{copyFeedback}</p> : null}
          <label className="label-row compact">
            Export Output
            <textarea
              rows={4}
              value={exportText}
              onChange={(event) => setExportText(event.target.value)}
              placeholder="Click Generate Export to preview output."
            />
          </label>
        </section>
      ) : null}
    </section>
  )
}
