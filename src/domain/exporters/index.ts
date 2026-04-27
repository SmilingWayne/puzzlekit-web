import { normalizePuzzle } from '../ir/normalize'
import { puzzleRegistry } from '../plugins/registry'
import type { ExportContext, ExportFormat, Exporter, PuzzlinkEncodeResult } from './types'

export const tryEncodePuzzlink = (context: ExportContext): PuzzlinkEncodeResult => {
  const plugin = puzzleRegistry.get(context.pluginId)
  if (!plugin) {
    return { ok: false, message: `Puzzle plugin "${context.pluginId}" not found.` }
  }
  try {
    return { ok: true, url: plugin.encode(context.puzzle) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message }
  }
}

const exportPuzzlink = (context: ExportContext): string => {
  const result = tryEncodePuzzlink(context)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.url
}

const exportPenpa = ({ pluginId }: ExportContext): string =>
  `TODO: penpa export pipeline is not implemented yet for "${pluginId}".`

const exportJson = ({ puzzle }: ExportContext): string =>
  JSON.stringify(normalizePuzzle(puzzle), null, 2)

export const exporters: Exporter[] = [
  { format: 'puzzlink', label: 'puzz.link URL', export: exportPuzzlink },
  { format: 'penpa', label: 'Penpa URL', export: exportPenpa },
  { format: 'json', label: 'Custom JSON', export: exportJson },
]

export const exportPuzzle = (context: ExportContext, format: ExportFormat): string => {
  const exporter = exporters.find((item) => item.format === format)
  if (!exporter) {
    return `TODO: exporter "${format}" is not registered`
  }
  return exporter.export(context)
}
