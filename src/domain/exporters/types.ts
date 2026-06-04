import type { PuzzleIR } from '../ir/types'

export type PuzzleUrlExportFormat = 'puzzlink' | 'pzplus' | 'pzprxs'
export type ExportFormat = PuzzleUrlExportFormat | 'penpa' | 'json'

export type ExportContext = {
  puzzle: PuzzleIR
  pluginId: string
}

export type Exporter = {
  format: ExportFormat
  label: string
  export: (context: ExportContext) => string
}

export type PuzzlinkEncodeResult =
  | { ok: true; url: string }
  | { ok: false; message: string }
