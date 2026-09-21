#!/usr/bin/env node
/**
 * Export anonymized turns for a future LocalAdapter.
 * Does not include raw API payloads, keys, or GitHub tokens.
 *
 *   MONGODB_URI=... npm run export:turns > turns.json
 */
import '../server/load-env.js'
import { listTurnsForExport, listArchivedChatsForExport, mongoAvailable } from '../server/mongo.js'

if (!mongoAvailable()) {
  console.error('MONGODB_URI is not set')
  process.exit(1)
}

const rows = await listTurnsForExport({ limit: Number(process.env.EXPORT_LIMIT || 2000) })
const chats = await listArchivedChatsForExport({ limit: Number(process.env.EXPORT_CHAT_LIMIT || 500) })
const payload = {
  exportedAt: new Date().toISOString(),
  adapterIo: '{ state, questions } → { answers, confidence }',
  rows: rows.map((row) => ({
    promptHash: row.promptHash,
    prompt: row.prompt || null,
    shape: row.shape,
    jevAnswers: row.jevAnswers,
    jevConfidence: row.jevConfidence,
    planner: row.planner,
    latencyMs: row.latencyMs,
    rating: row.rating || null,
    policy: row.policy,
    sessionId: row.sessionId || null,
    createdAt: row.createdAt,
  })),
  archivedChats: chats.map((chat) => ({
    sessionId: chat.sessionId,
    title: chat.title,
    messages: chat.messages,
    versions: chat.versions,
    result: chat.result,
    deletedAt: chat.deletedAt,
    archivedAt: chat.archivedAt,
    createdAt: chat.createdAt,
  })),
}

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
process.exit(0)
