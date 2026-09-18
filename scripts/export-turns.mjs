#!/usr/bin/env node
/**
 * Export anonymized turns for a future LocalAdapter.
 * Does not include raw API payloads, keys, or GitHub tokens.
 *
 *   MONGODB_URI=... npm run export:turns > turns.json
 */
import '../server/load-env.js'
import { listTurnsForExport, mongoAvailable } from '../server/mongo.js'

if (!mongoAvailable()) {
  console.error('MONGODB_URI is not set')
  process.exit(1)
}

const rows = await listTurnsForExport({ limit: Number(process.env.EXPORT_LIMIT || 2000) })
const payload = {
  exportedAt: new Date().toISOString(),
  adapterIo: '{ state, questions } → { answers, confidence }',
  rows: rows.map((row) => ({
    promptHash: row.promptHash,
    shape: row.shape,
    jevAnswers: row.jevAnswers,
    jevConfidence: row.jevConfidence,
    planner: row.planner,
    latencyMs: row.latencyMs,
    rating: row.rating || null,
    policy: row.policy,
    createdAt: row.createdAt,
  })),
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
process.exit(0)
