import { useState } from 'react'
import { exportPuzzle, exporters } from '../../domain/exporters'
import type { ExportFormat } from '../../domain/exporters/types'
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

  return (
    <section className="panel-card">
      <header className="panel-header">
        <h2>Input & Controls</h2>
      </header>
      <label className="label-row">
        Puzzle Type
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
      </label>
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
              onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
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
                setExportText(exportPuzzle({ puzzle: currentPuzzle, pluginId }, exportFormat))
                setCopyFeedback('')
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
