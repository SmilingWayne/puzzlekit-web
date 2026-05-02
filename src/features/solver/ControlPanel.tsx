import { useEffect, useMemo, useState } from 'react'
import { exportPuzzle, exporters, tryEncodePuzzlink } from '../../domain/exporters'
import type { ExportFormat } from '../../domain/exporters/types'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../../domain/ir/slither'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { buildDifficultySnapshot, MAX_SOLVE_CHUNK_SIZE, useSolverStore } from './solverStore'

export const ControlPanel = () => {
  const {
    pluginId,
    sourceUrl,
    importError,
    setSourceUrl,
    setPluginId,
    importFromUrl,
    applyCustomSlitherGrid,
    nextStep,
    prevStep,
    goToStep,
    solveAll,
    resetTimeline,
    solveChunkSize,
    setSolveChunkSize,
    includeVertexNumbers,
    setIncludeVertexNumbers,
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
  const [showCustomGridPopover, setShowCustomGridPopover] = useState(false)
  const [showImportErrorDialog, setShowImportErrorDialog] = useState(false)
  const [showTerminalReport, setShowTerminalReport] = useState(false)
  const [customRows, setCustomRows] = useState(String(currentPuzzle.rows))
  const [customCols, setCustomCols] = useState(String(currentPuzzle.cols))
  const [timelinePreviewStep, setTimelinePreviewStep] = useState<number | null>(null)
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])
  const difficulty = useMemo(() => buildDifficultySnapshot(activeSteps), [activeSteps])
  const ruleUsageEntries = useMemo(
    () => Object.entries(difficulty.ruleUsage).sort(([a], [b]) => a.localeCompare(b)),
    [difficulty.ruleUsage],
  )
  const terminalCoverage = terminalReport
    ? `${(terminalReport.stats.decidedEdgeRatio * 100).toFixed(1)}%`
    : '0.0%'
  const terminalDurationSeconds = terminalReport
    ? `${(terminalReport.totalDurationMs / 1000).toFixed(2)} s`
    : '0.00 s'

  useEffect(() => {
    setLocalUrl(sourceUrl)
  }, [sourceUrl])

  useEffect(() => {
    if (showCustomGridPopover) {
      setCustomRows(String(currentPuzzle.rows))
      setCustomCols(String(currentPuzzle.cols))
    }
  }, [showCustomGridPopover, currentPuzzle.rows, currentPuzzle.cols])

  useEffect(() => {
    setShowTerminalReport(terminalReport !== null)
  }, [terminalReport])

  useEffect(() => {
    setShowImportErrorDialog(Boolean(importError))
  }, [importError])

  const solveChunkLabel = `Solve Next ${solveChunkSize} ${solveChunkSize === 1 ? 'Step' : 'Steps'}`
  const previousChunkLabel = `Previous ${solveChunkSize} ${solveChunkSize === 1 ? 'Step' : 'Steps'}`
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
              setPluginId(event.target.value)
            }}
          >
            {puzzleRegistry.all().map((plugin) => (
              <option key={plugin.id} value={plugin.id}>
                {plugin.displayName}
              </option>
            ))}
          </select>
          <div className="custom-grid-anchor">
            <button
              type="button"
              className="button-compact"
              disabled={pluginId !== 'slitherlink'}
              title={
                pluginId === 'slitherlink'
                  ? 'Create a blank Slitherlink grid'
                  : 'Custom grid is only available for Slitherlink'
              }
              data-active={showCustomGridPopover}
              onClick={() => {
                setShowCustomGridPopover((open) => !open)
              }}
            >
              Custom grid…
            </button>
            {showCustomGridPopover ? (
              <div className="custom-grid-popover">
                <p className="custom-grid-popover-title">New Slitherlink grid</p>
                <label className="custom-grid-field">
                  Rows
                  <input
                    type="number"
                    min={SLITHER_CUSTOM_GRID_MIN}
                    max={SLITHER_CUSTOM_GRID_MAX}
                    value={customRows}
                    onChange={(e) => setCustomRows(e.target.value)}
                  />
                </label>
                <label className="custom-grid-field">
                  Cols
                  <input
                    type="number"
                    min={SLITHER_CUSTOM_GRID_MIN}
                    max={SLITHER_CUSTOM_GRID_MAX}
                    value={customCols}
                    onChange={(e) => setCustomCols(e.target.value)}
                  />
                </label>
                <label className="check-row custom-grid-check-row">
                  <input
                    type="checkbox"
                    checked={includeVertexNumbers}
                    onChange={(event) => setIncludeVertexNumbers(event.target.checked)}
                  />
                  Show vertex numbering overlay
                </label>
                <div className="custom-grid-popover-actions">
                  <button
                    type="button"
                    onClick={() => {
                      applyCustomSlitherGrid(Number(customRows), Number(customCols))
                      setShowCustomGridPopover(false)
                    }}
                  >
                    Apply
                  </button>
                  <button type="button" onClick={() => setShowCustomGridPopover(false)}>
                    Cancel
                  </button>
                </div>
                <p className="custom-grid-hint">
                  Size {SLITHER_CUSTOM_GRID_MIN}–{SLITHER_CUSTOM_GRID_MAX}. Clears clues and solve
                  progress.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <label className="label-row">
        URL (puzz.link, pzplus, pzv, or Penpa+ Slitherlink)
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
              Previous Step
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
                  <span>Decided Edges</span>
                  <strong>
                    {terminalReport.stats.decidedEdges} / {terminalReport.stats.totalEdges},{' '}
                    {terminalCoverage}
                  </strong>
                </div>
                <div>
                  <span>Unknown Edges</span>
                  <strong>{terminalReport.stats.unknownEdges}</strong>
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
              className="button-compact"
              onClick={() => setShowExportPanel(false)}
            >
              Cancel
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
                if (exportFormat === 'puzzlink') {
                  const result = tryEncodePuzzlink({ puzzle: currentPuzzle, pluginId })
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
