import { z } from 'zod'
import type { BenchmarkDatasetManifest } from './types'

const DatasetItemSchema = z.object({
  id: z.string().min(1),
  puzzleType: z.string().min(1),
  sourceUrl: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tags: z.array(z.string()),
  source: z.string().optional(),
})

const DatasetManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  puzzleType: z.string().min(1),
  items: z.array(DatasetItemSchema),
})

export const validateBenchmarkManifest = (
  input: unknown,
): BenchmarkDatasetManifest => DatasetManifestSchema.parse(input)
