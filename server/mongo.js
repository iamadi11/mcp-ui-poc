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
          prompt: 1,
          shape: 1,
          jevAnswers: 1,
          planner: 1,
          latencyMs: 1,
          jevConfidence: 1,
          rating: 1,
          policy: 1,
          sessionId: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}

function compactTrainingMeta(meta) {
  if (!meta || typeof meta !== 'object') return null
  return {
    planner: meta.planner || null,
    plannerLabel: meta.plannerLabel || null,
    jevConfidence: meta.jevConfidence ?? null,
    path: Array.isArray(meta.path) ? meta.path.slice(0, 12) : [],
    reason: String(meta.reason || '').slice(0, 400),
  }
}

function compactTrainingResult(result) {
  if (!result || typeof result !== 'object') return null
  return {
    spec: result.spec || null,
    policy: result.policy || null,
    themeId: result.themeId || null,
    motion: result.motion || null,
    look: result.look || null,
    sourceUrl: typeof result.sourceUrl === 'string' ? result.sourceUrl.slice(0, 500) : '',
    meta: compactTrainingMeta(result.meta),
    componentId: result.componentId || null,
  }
}

export function sanitizeStudioChat(chat = {}) {
  const sessionId = String(chat.sessionId || chat.id || '').slice(0, 80)
  const messages = Array.isArray(chat.messages) ? chat.messages.slice(0, 200) : []
  const versions = Array.isArray(chat.versions) ? chat.versions.slice(0, 16) : []
  return {
    sessionId,
    title: String(chat.title || 'Untitled').slice(0, 120),
    messages: messages.map((item) => {
      if (item?.role === 'metrics') {
        return {
          role: 'metrics',
          planner: item.planner || null,
          path: Array.isArray(item.path) ? item.path.slice(0, 12) : [],
          reason: String(item.reason || '').slice(0, 400),
          totalMs: typeof item.totalMs === 'number' ? item.totalMs : null,
        }
      }
      return {
        role: item?.role === 'assistant' ? 'assistant' : 'user',
        text: String(item?.text || '').slice(0, 4000),
      }
    }),
    versions: versions.map((item) => ({
      id: item?.id ? String(item.id).slice(0, 80) : null,
      prompt: String(item?.prompt || '').slice(0, 400),
      createdAt: item?.createdAt || null,
      result: compactTrainingResult(item?.result),
    })),
    result: compactTrainingResult(chat.result),
    publicId: chat.publicId ? String(chat.publicId).slice(0, 80) : null,
    updatedAt: chat.updatedAt || new Date().toISOString(),
    deletedAt: chat.deletedAt || new Date().toISOString(),
  }
}

export async function archiveStudioChat(chat) {
  const doc = sanitizeStudioChat(chat)
  if (!doc.sessionId) return { stored: false, reason: 'sessionId required' }
  const database = await db()
  if (!database) return { stored: false, backend: 'none', sessionId: doc.sessionId }
  const now = new Date()
  await database.collection('studio_chats').updateOne(
    { sessionId: doc.sessionId },
    {
      $set: { ...doc, archivedAt: now, deletedAt: new Date(doc.deletedAt) },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )
  await database.collection('turns').updateMany(
    { sessionId: doc.sessionId },
    { $set: { studioDeletedAt: now } },
  )
  return { stored: true, backend: 'mongo', sessionId: doc.sessionId }
}

export async function listArchivedChatsForExport({ limit = 500 } = {}) {
  const database = await db()
  if (!database) return []
  return database
    .collection('studio_chats')
    .find(
      {},
      {
        projection: {
          sessionId: 1,
          title: 1,
          messages: 1,
          versions: 1,
          result: 1,
          deletedAt: 1,
          archivedAt: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ archivedAt: -1, deletedAt: -1 })
    .limit(limit)
    .toArray()
}
