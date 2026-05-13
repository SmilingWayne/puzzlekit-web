import type { Dirent } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  runBenchmarkManifest,
  validateBenchmarkManifest,
} from '../src/domain/benchmark'

const DATASET_DIRS = ['dataset/public', 'dataset/private']
const OUTPUT_DIR = 'benchmark-results'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const findJsonFiles = async (dir: string): Promise<string[]> => {
  const absoluteDir = path.join(projectRoot, dir)
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
    const relativePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findJsonFiles(relativePath)))
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(relativePath)
    }
  }
  return files.sort()
}

const readManifest = async (manifestPath: string) => {
  const raw = await readFile(path.join(projectRoot, manifestPath), 'utf8')
  return validateBenchmarkManifest(JSON.parse(raw))
}

const writeReport = async (
  datasetId: string,
  report: unknown,
): Promise<string> => {
  const outPath = path.join(OUTPUT_DIR, `${datasetId}.report.json`)
  const absoluteOutPath = path.join(projectRoot, outPath)
  await mkdir(path.dirname(absoluteOutPath), { recursive: true })
  await writeFile(absoluteOutPath, `${JSON.stringify(report, null, 2)}\n`)
  return outPath
}

const main = async (): Promise<void> => {
  const manifestPaths = (
    await Promise.all(DATASET_DIRS.map((dir) => findJsonFiles(dir)))
  ).flat()

  if (manifestPaths.length === 0) {
    throw new Error(
      `No benchmark manifests found under ${DATASET_DIRS.join(' or ')}.`,
    )
  }

  for (const manifestPath of manifestPaths) {
    const manifest = await readManifest(manifestPath)
    const report = runBenchmarkManifest(manifest)
    const outPath = await writeReport(manifest.id, report)
    console.log(
      `Wrote ${manifest.id}: ${report.summary.total} puzzle(s), ${outPath}`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
