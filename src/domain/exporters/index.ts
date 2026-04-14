import { normalizePuzzle } from '../ir/normalize'
import { puzzleRegistry } from '../plugins/registry'
import type { ExportContext, ExportFormat, Exporter } from './types'

const exportPuzzlink = ({ puzzle, pluginId }: ExportContext): string => {
  const plugin = puzzleRegistry.get(pluginId)
  if (!plugin) {
    return `TODO: puzzle plugin "${pluginId}" not found`
  }
  try {
    return plugin.encode(puzzle)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `TODO: puzzlink export not ready for "${pluginId}" (${message})`
  }
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
