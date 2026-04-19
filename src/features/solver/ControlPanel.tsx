import { useEffect, useState } from 'react'
import { exportPuzzle, exporters, tryEncodePuzzlink } from '../../domain/exporters'
import type { ExportFormat } from '../../domain/exporters/types'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../../domain/ir/slither'
import { puzzleRegistry } from '../../domain/plugins/registry'
import { useSolverStore } from './solverStore'

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
    solveAll,
    resetTimeline,
    includeVertexNumbers,
    setIncludeVertexNumbers,
    isRunning,
    currentPuzzle,
  } = useSolverStore()
  const [localUrl, setLocalUrl] = useState(sourceUrl)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('puzzlink')
  const [exportText, setExportText] = useState('')
  const [showExportPanel, setShowExportPanel] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [exportGenerateError, setExportGenerateError] = useState('')
  const [showCustomGridPopover, setShowCustomGridPopover] = useState(false)
  const [customRows, setCustomRows] = useState(String(currentPuzzle.rows))
  const [customCols, setCustomCols] = useState(String(currentPuzzle.cols))

  useEffect(() => {
    setLocalUrl(sourceUrl)
  }, [sourceUrl])

  useEffect(() => {
    if (showCustomGridPopover) {
      setCustomRows(String(currentPuzzle.rows))
      setCustomCols(String(currentPuzzle.cols))
    }
  }, [showCustomGridPopover, currentPuzzle.rows, currentPuzzle.cols])

  return (
    <section className="panel-card">
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
        URL
        <textarea
          rows={2}
          value={localUrl}
          onChange={(event) => setLocalUrl(event.target.value)}
          placeholder="Paste puzz.link or penpa URL"
        />
      </label>
      {importError ? <p className="error-text">{importError}</p> : null}
      <div className="button-row">
        <button
          onClick={() => {
            setSourceUrl(localUrl)
            importFromUrl(localUrl, pluginId)
          }}
        >
          Import URL
        </button>
        <button onClick={nextStep}>Next Step</button>
        <button onClick={prevStep}>Previous Step</button>
        <button disabled={isRunning} onClick={() => solveAll()}>
          Solve to End
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
          {showExportPanel ? 'Hide Export Panel' : 'Open Export Panel'}
        </button>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={includeVertexNumbers}
          onChange={(event) => setIncludeVertexNumbers(event.target.checked)}
        />
        Show vertex numbering overlay
      </label>
      {showExportPanel ? (
        <section className="export-panel">
          <hr className="divider" />
          <header className="panel-header">
            <h2>Export Puzzle</h2>
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
