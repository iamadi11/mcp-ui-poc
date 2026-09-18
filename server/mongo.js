/**
 * Atlas M0 source of truth. Optional — plans still work without MONGODB_URI.
 * Never stores raw API payloads.
 */
let clientPromise = null

export function mongoAvailable() {
  return Boolean(process.env.MONGODB_URI)
}

export function mongoLabel() {
  if (!process.env.MONGODB_URI) return 'disabled'
  return /mongodb\+srv:/i.test(process.env.MONGODB_URI) ? 'atlas' : 'local'
}

export async function mongoStatus() {
  if (!mongoAvailable()) return 'disabled'
  try {
    const database = await db()
    if (!database) return 'disabled'
    await database.command({ ping: 1 })
    return mongoLabel()
  } catch {
    return 'mongo-error'
  }
}

async function db() {
  if (!process.env.MONGODB_URI) return null
  if (!clientPromise) {
    const { MongoClient } = await import('mongodb')
    const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 })
    clientPromise = client.connect()
  }
  const client = await clientPromise
  return client.db(process.env.MONGODB_DB || 'mcp_ui')
}

export async function upsertUser({ githubId, login }) {
  const database = await db()
  if (!database || githubId == null) return null
  const now = new Date()
  await database.collection('users').updateOne(
    { githubId },
    { $set: { githubId, login, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
  return { githubId, login }
}

export async function insertTurn(turn) {
  const database = await db()
  if (!database) return { stored: false }
  const doc = {
    ...turn,
    createdAt: turn.createdAt || new Date(),
  }
  delete doc.payload
  delete doc.data
  await database.collection('turns').insertOne(doc)
  return { stored: true }
}

export async function rateTurn({ decisionId, rating, note }) {
  const database = await db()
  if (!database || !decisionId) return
  await database.collection('turns').updateOne(
    { decisionId },
    { $set: { rating, note: note ? String(note).slice(0, 500) : undefined, ratedAt: new Date() } },
  )
}

export async function neighborPolicy(shapeHash) {
  const database = await db()
  if (!database || !shapeHash) return null
  const doc = await database.collection('turns').findOne(
    { shapeHash, rating: 'up', policy: { $exists: true } },
    { sort: { ratedAt: -1, createdAt: -1 } },
  )
  return doc?.policy || null
}

const memoryWidgets = new Map()

export async function saveWidget(widget) {
  if (!widget?.publicId) return { stored: false }
  const now = new Date()
  const createdAt = widget.createdAt || now
  const next = { ...widget, updatedAt: now, createdAt }
  memoryWidgets.set(widget.publicId, next)
  const database = await db()
  if (!database) return { stored: true, backend: 'memory' }
  const { createdAt: _created, ...setFields } = next
  await database.collection('widgets').updateOne(
    { publicId: widget.publicId },
    { $set: setFields, $setOnInsert: { createdAt } },
    { upsert: true },
  )
  return { stored: true, backend: 'mongo' }
}

export async function getWidget(publicId) {
  if (!publicId) return null
  const database = await db()
  if (database) {
    const doc = await database.collection('widgets').findOne({ publicId })
    if (doc) return doc
  }
  return memoryWidgets.get(publicId) || null
}

export async function listTurnsForExport({ limit = 500 } = {}) {
  const database = await db()
  if (!database) return []
  return database
    .collection('turns')
    .find(
      {},
      {
        projection: {
          promptHash: 1,
          shape: 1,
          jevAnswers: 1,
          planner: 1,
          latencyMs: 1,
          jevConfidence: 1,
          rating: 1,
          policy: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
