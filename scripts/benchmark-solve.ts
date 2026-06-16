import type { Dirent } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  formatBenchmarkReportText,
  formatBenchmarkReportTsv,
  runBenchmarkManifest,
  validateBenchmarkManifest,
} from '../src/domain/benchmark'
import type {
  BenchmarkDatasetManifest,
  BenchmarkReport,
  BenchmarkTelemetryLevel,
} from '../src/domain/benchmark'

const DATASET_DIRS = ['dataset/public', 'dataset/private']
const DEFAULT_OUTPUT_DIR = 'benchmark-results'

export type BenchmarkOutputFormat = 'json' | 'text' | 'tsv' | 'both'

export type BenchmarkCliOptions = {
  datasetPaths: string[]
  ids: string[]
  maxSteps: number
  timeoutMs: number
  telemetry: BenchmarkTelemetryLevel
  format: BenchmarkOutputFormat
  outDir: string
}

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const parsePositiveInteger = (
  name: string,
  value: string | undefined,
  fallback: number,
) => {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `--${name} must be a positive integer; received "${value}".`,
    )
  }
  return parsed
}

const parseEnum = <T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T => {
  if (value === undefined) return fallback
  if (!allowed.includes(value as T)) {
    throw new Error(
      `--${name} must be one of ${allowed.join(', ')}; received "${value}".`,
    )
  }
  return value as T
}

const flattenCsvValues = (values: string[] | undefined): string[] =>
  (values ?? [])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

const getString = (
  values: ReturnType<typeof parseArgs>['values'],
  key: string,
): string | undefined => {
  const value = values[key]
  return typeof value === 'string' ? value : undefined
}

const getStrings = (
  values: ReturnType<typeof parseArgs>['values'],
  key: string,
): string[] | undefined => {
  const value = values[key]
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : undefined
}

export const parseBenchmarkCliArgs = (args: string[]): BenchmarkCliOptions => {
  let values: ReturnType<typeof parseArgs>['values']
  try {
    ;({ values } = parseArgs({
      args,
      strict: true,
      allowPositionals: false,
      options: {
        dataset: { type: 'string', multiple: true },
        ids: { type: 'string', multiple: true },
        'max-steps': { type: 'string' },
        'timeout-ms': { type: 'string' },
        telemetry: { type: 'string' },
        format: { type: 'string' },
        'out-dir': { type: 'string' },
      },
    }))
  } catch (error) {
    throw new Error(
      `Invalid benchmark arguments: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return {
    datasetPaths: getStrings(values, 'dataset') ?? [],
    ids: flattenCsvValues(getStrings(values, 'ids')),
    maxSteps: parsePositiveInteger(
      'max-steps',
      getString(values, 'max-steps'),
      2000,
    ),
    timeoutMs: parsePositiveInteger(
      'timeout-ms',
      getString(values, 'timeout-ms'),
      60_000,
    ),
    telemetry: parseEnum(
      'telemetry',
      getString(values, 'telemetry'),
      ['off', 'summary'] as const,
      'summary',
    ),
    format: parseEnum(
      'format',
      getString(values, 'format'),
      ['json', 'text', 'tsv', 'both'] as const,
      'both',
    ),
    outDir: getString(values, 'out-dir') ?? DEFAULT_OUTPUT_DIR,
  }
}

const resolveProjectPath = (targetPath: string): string =>
  path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath)

export const findJsonFiles = async (dir: string): Promise<string[]> => {
  const absoluteDir = resolveProjectPath(dir)
  let entries: Dirent<string>[]
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const files: string[] = []
  for (const entry of entries) {
    const entryPath = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findJsonFiles(entryPath)))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

export const readManifest = async (
  manifestPath: string,
): Promise<BenchmarkDatasetManifest> => {
  const absolutePath = resolveProjectPath(manifestPath)
  let raw: string
  try {
    raw = await readFile(absolutePath, 'utf8')
  } catch (error) {
    throw new Error(
      `Unable to read dataset "${manifestPath}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  try {
    return validateBenchmarkManifest(JSON.parse(raw))
  } catch (error) {
    throw new Error(
      `Invalid dataset "${manifestPath}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export const selectManifestItems = (
  manifests: BenchmarkDatasetManifest[],
  ids: string[],
): BenchmarkDatasetManifest[] => {
  const duplicateIds = manifests
    .map((manifest) => manifest.id)
    .filter((id, index, all) => all.indexOf(id) !== index)
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate dataset ID(s): ${Array.from(new Set(duplicateIds)).join(', ')}.`,
    )
  }
  if (ids.length === 0) return manifests

  const selectedIds = new Set(ids)
  const filtered = manifests.flatMap((manifest) => {
    const items = manifest.items.filter((item) => selectedIds.has(item.id))
    return items.length > 0 ? [{ ...manifest, items }] : []
  })
  if (filtered.length === 0) {
    throw new Error(`No puzzles matched --ids ${ids.join(', ')}.`)
  }
  return filtered
}

export const formatRunTimestamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

export const createRunDirectory = async (
  outDir: string,
  datasetId: string,
  timestamp: string,
): Promise<string> => {
  const datasetDir = path.join(resolveProjectPath(outDir), datasetId)
  await mkdir(datasetDir, { recursive: true })
  for (let suffix = 1; ; suffix += 1) {
    const name = suffix === 1 ? timestamp : `${timestamp}-${suffix}`
    const runDir = path.join(datasetDir, name)
    try {
      await mkdir(runDir)
      return runDir
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        continue
      }
      throw error
    }
  }
}

const writeArtifact = async (
  runDir: string,
  filename: string,
  content: string,
): Promise<string> => {
  const absolutePath = path.join(runDir, filename)
  await writeFile(absolutePath, content)
  return path.relative(projectRoot, absolutePath)
}

export const writeBenchmarkOutputs = async (
  report: BenchmarkReport,
  options: Pick<BenchmarkCliOptions, 'format' | 'outDir'>,
  timestamp: string,
): Promise<string[]> => {
  const runDir = await createRunDirectory(
    options.outDir,
    report.run.datasetId,
    timestamp,
  )
  if (options.format === 'json') {
    return [
      await writeArtifact(
        runDir,
        'report.json',
        `${JSON.stringify(report, null, 2)}\n`,
      ),
    ]
  }

  const outputPaths: string[] = []
  if (options.format === 'text' || options.format === 'both') {
    outputPaths.push(
      await writeArtifact(
        runDir,
        'summary.txt',
        `${formatBenchmarkReportText(report)}\n`,
      ),
    )
  }
  if (options.format === 'tsv' || options.format === 'both') {
    const tables = formatBenchmarkReportTsv(report)
    outputPaths.push(await writeArtifact(runDir, 'puzzles.tsv', tables.puzzles))
    if (tables.ruleAttempts && tables.strongInference) {
      outputPaths.push(
        await writeArtifact(runDir, 'rule-attempts.tsv', tables.ruleAttempts),
        await writeArtifact(
          runDir,
          'strong-inference.tsv',
          tables.strongInference,
        ),
      )
    }
  }
  return outputPaths
}

export const runBenchmarkCli = async (
  options: BenchmarkCliOptions,
): Promise<void> => {
  const manifestPaths =
    options.datasetPaths.length > 0
      ? options.datasetPaths
      : (
          await Promise.all(DATASET_DIRS.map((dir) => findJsonFiles(dir)))
        ).flat()
  if (manifestPaths.length === 0) {
    throw new Error(
      `No benchmark manifests found under ${DATASET_DIRS.join(' or ')}.`,
    )
  }

  const manifests = selectManifestItems(
    await Promise.all(manifestPaths.map(readManifest)),
    options.ids,
  )
  const runTimestamp = formatRunTimestamp(new Date())
  for (const manifest of manifests) {
    const report = runBenchmarkManifest(manifest, {
      maxSteps: options.maxSteps,
      timeoutMs: options.timeoutMs,
      telemetry: options.telemetry,
    })
    if (options.format === 'text' || options.format === 'both') {
      console.log(formatBenchmarkReportText(report))
    }
    if (
      (options.format === 'tsv' || options.format === 'both') &&
      options.telemetry === 'off'
    ) {
      console.log(
        `${manifest.id}: telemetry is off; rule-attempts.tsv and strong-inference.tsv were not generated.`,
      )
    }
    const outputPaths = await writeBenchmarkOutputs(
      report,
      options,
      runTimestamp,
    )
    console.log(`Wrote ${manifest.id}: ${report.summary.total} puzzle(s)`)
    for (const outputPath of outputPaths) {
      console.log(`  ${outputPath}`)
    }
  }
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false

if (isMain) {
  runBenchmarkCli(parseBenchmarkCliArgs(process.argv.slice(2))).catch(
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    },
  )
}
