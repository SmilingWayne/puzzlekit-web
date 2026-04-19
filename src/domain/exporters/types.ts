import type { PuzzleIR } from '../ir/types'

export type ExportFormat = 'puzzlink' | 'penpa' | 'json'

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
