import type { BenchmarkDatasetManifest } from '../../domain/benchmark/types'
import slitherlinkExampleRaw from '../../../dataset/public/slitherlink.example.json?raw'

const parseManifest = (raw: string): BenchmarkDatasetManifest => JSON.parse(raw) as BenchmarkDatasetManifest

export const publicDatasetManifests: BenchmarkDatasetManifest[] = [
  parseManifest(slitherlinkExampleRaw),
]
