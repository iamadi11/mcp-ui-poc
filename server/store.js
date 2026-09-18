/**
 * Decision store: LayoutPolicy + Jev answers + ratings.
 * Upstash REST in production, REDIS_URL (local redis) in dev.
 * No-ops when neither is set so generate still works.
 */
import { Redis } from '@upstash/redis'
import { createClient } from 'redis'

const TTL_SECONDS = 60 * 60 * 24 * 30
const SHAPE_LIST_MAX = 12

export function storeBackend() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return 'upstash'
  if (process.env.REDIS_URL) return 'redis'
  return null
}

export function storeAvailable() {
  return Boolean(storeBackend())
}

export function storeLabel() {
  const backend = storeBackend()
  if (backend === 'upstash') return 'redis'
  if (backend === 'redis') return 'redis-local'
  return 'memory-disabled'
}

let cached = null
const REDIS_BUDGET_MS = 400

function redisTimeout(label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(label)), REDIS_BUDGET_MS)
  })
}

function parseMaybe(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function wrapUpstash(client) {
  return {
    get: (key) => client.get(key),
    set: (key, value, opts = {}) => client.set(key, value, { ex: opts.ex }),
    del: (key) => client.del(key),
    lpush: (key, value) => client.lpush(key, value),
    ltrim: (key, start, stop) => client.ltrim(key, start, stop),
    lrange: (key, start, stop) => client.lrange(key, start, stop),
    expire: (key, seconds) => client.expire(key, seconds),
    ping: async () => {
      if (typeof client.ping === 'function') {
        await client.ping()
        return true
      }
      await client.get('__health__')
      return true
    },
  }
}

function wrapNodeRedis(client) {
  return {
    get: async (key) => parseMaybe(await client.get(key)),
    set: async (key, value, opts = {}) => {
      const payload = typeof value === 'string' ? value : JSON.stringify(value)
      if (opts.ex) return client.set(key, payload, { EX: opts.ex })
      return client.set(key, payload)
    },
    del: (key) => client.del(key),
    lpush: (key, value) => client.lPush(key, String(value)),
    ltrim: (key, start, stop) => client.lTrim(key, start, stop),
    lrange: (key, start, stop) => client.lRange(key, start, stop),
    expire: (key, seconds) => client.expire(key, seconds),
    ping: async () => {
      const pong = await client.ping()
      return pong === 'PONG' || pong === true
    },
  }
}

async function redis() {
  const backend = storeBackend()
  if (!backend) return null
  if (cached) return cached
  if (backend === 'upstash') {
    cached = wrapUpstash(Redis.fromEnv())
    return cached
  }
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { reconnectStrategy: false },
  })
  client.on('error', () => {})
  try {
    await Promise.race([client.connect(), redisTimeout('redis-connect')])
  } catch (error) {
    client.disconnect?.().catch(() => {})
    throw error
  }
  cached = wrapNodeRedis(client)
  return cached
}

/** Redis is optional. Timeouts must not fail a Turn. */
async function redisOp(run, fallback) {
  try {
    const client = await redis()
    if (!client) return fallback
    return await Promise.race([run(client), redisTimeout('redis-op')])
  } catch {
    cached = null
    return fallback
  }
}

export async function storeStatus() {
  if (!storeAvailable()) return 'memory-disabled'
  const ok = await redisOp((client) => client.ping(), false)
  return ok ? storeLabel() : 'redis-error'
}

function decisionKey(id) {
  return `decision:${id}`
}

function fpKey(fingerprint) {
  return `fp:${fingerprint}`
}

function shapeKey(shapeHash) {
  return `shape:${shapeHash}`
}

function asRecord(value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

export async function lookupByFingerprint(fingerprint) {
  if (!fingerprint) return null
  return redisOp(async (client) => {
    const id = await client.get(fpKey(fingerprint))
    if (!id) return null
    const record = asRecord(await client.get(decisionKey(id)))
    if (!record || record.replayEligible === false) return null
    return record
  }, null)
}

export async function getDecision(id) {
  if (!id) return null
  return redisOp(async (client) => asRecord(await client.get(decisionKey(id))), null)
}

export async function neighborsForShape(hash, { excludeId, limit = 5 } = {}) {
  if (!hash) return []
  return redisOp(async (client) => {
    const ids = await client.lrange(shapeKey(hash), 0, SHAPE_LIST_MAX - 1)
    if (!Array.isArray(ids) || !ids.length) return []
    const records = []
    for (const id of ids) {
      if (!id || id === excludeId) continue
      const rec = asRecord(await client.get(decisionKey(id)))
      if (rec) records.push(rec)
      if (records.length >= limit) break
    }
    return records
  }, [])
}

export async function saveDecision(record) {
  if (!record?.id) return { stored: false }
  const payload = { ...record, updatedAt: new Date().toISOString() }
  const stored = await redisOp(async (client) => {
    await client.set(decisionKey(record.id), payload, { ex: TTL_SECONDS })
    if (payload.replayEligible !== false && payload.fingerprint) {
      await client.set(fpKey(payload.fingerprint), record.id, { ex: TTL_SECONDS })
    }
    if (payload.shapeHash) {
      const sk = shapeKey(payload.shapeHash)
      await client.lpush(sk, record.id)
      await client.ltrim(sk, 0, SHAPE_LIST_MAX - 1)
      await client.expire(sk, TTL_SECONDS)
    }
    return true
  }, false)
  return { stored: Boolean(stored) }
}

export async function applyFeedback({ decisionId, rating, note }) {
  try {
  const client = await redis()
  if (!client) {
    const err = new Error('Decision store is not configured')
    err.status = 503
    throw err
  }
  const record = asRecord(await client.get(decisionKey(decisionId)))
  if (!record) {
    const err = new Error('Unknown decisionId')
    err.status = 404
    throw err
  }
  const entry = {
    rating,
    note: note ? String(note).slice(0, 500) : undefined,
    at: new Date().toISOString(),
  }
  const ratings = Array.isArray(record.ratings) ? [...record.ratings, entry] : [entry]
  const replayEligible = rating === 'up'
  const next = { ...record, ratings, replayEligible, updatedAt: entry.at }
  await client.set(decisionKey(decisionId), next, { ex: TTL_SECONDS })

  if (record.fingerprint) {
    const key = fpKey(record.fingerprint)
    if (rating === 'up') {
      await client.set(key, decisionId, { ex: TTL_SECONDS })
    } else {
      const current = await client.get(key)
      if (current === decisionId) await client.del(key)
    }
  }
  return next
  } catch (error) {
    if (error.status) throw error
    const err = new Error('Decision store unavailable')
    err.status = 503
    throw err
  }
}

const SESSION_TTL = 60 * 60 * 24 * 7
const memory = new Map()

function remember(key, value, ttlSeconds) {
  memory.set(key, { value, exp: Date.now() + ttlSeconds * 1000 })
}

function recall(key) {
  const hit = memory.get(key)
  if (!hit) return null
  if (Date.now() > hit.exp) {
    memory.delete(key)
    return null
  }
  return hit.value
}

export async function setCache(key, value, ttlSeconds = SESSION_TTL) {
  if (!key) return false
  remember(key, value, ttlSeconds)
  await redisOp(async (client) => {
    await client.set(key, value, { ex: ttlSeconds })
    return true
  }, false)
  return true
}

export async function getCache(key) {
  if (!key) return null
  const fromRedis = await redisOp(async (client) => {
    const raw = await client.get(key)
    return asRecord(raw) ?? raw
  }, null)
  if (fromRedis != null) return fromRedis
  return recall(key)
}

export async function deleteCache(key) {
  if (!key) return
  memory.delete(key)
  await redisOp(async (client) => {
    await client.del(key)
    return true
  }, false)
}

export async function saveSessionWidget(sessionId, widget) {
  if (!sessionId) return { stored: false }
  return { stored: await setCache(`session:${sessionId}:widget`, widget, 60 * 60 * 6) }
}

export async function loadSessionWidget(sessionId) {
  if (!sessionId) return null
  return asRecord(await getCache(`session:${sessionId}:widget`))
}
