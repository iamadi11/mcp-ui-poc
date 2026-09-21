/**
 * Short-TTL memoization for identical planTurn responses when the *server*
 * provider key is used. Per-user BYOK headers must bypass this cache.
 */

const DEFAULT_TTL_MS = 15 * 60_000
const DEFAULT_MAX = 500

export function createPlanCache({ ttlMs = DEFAULT_TTL_MS, max = DEFAULT_MAX } = {}) {
  /** @type {Map<string, { expiresAt: number, value: unknown }>} */
  const store = new Map()

  function prune(now = Date.now()) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key)
    }
    while (store.size > max) {
      const oldest = store.keys().next().value
      store.delete(oldest)
    }
  }

  return {
    planKey({ url, instructions, designSystem, llmProvider }) {
      return JSON.stringify([
        String(url || ''),
        String(instructions ?? ''),
        String(designSystem ?? ''),
        String(llmProvider ?? ''),
      ])
    },

    /** Cache only when the client did not supply provider keys (server env key). */
    shouldCache({ apiKey, typesafeApiKey } = {}) {
      return !apiKey && !typesafeApiKey
    },

    get(key) {
      prune()
      const entry = store.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        store.delete(key)
        return undefined
      }
      // Refresh insertion order for simple LRU-ish eviction
      store.delete(key)
      store.set(key, entry)
      return entry.value
    },

    set(key, value) {
      prune()
      if (store.has(key)) store.delete(key)
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
      prune()
    },

    clear() {
      store.clear()
    },

    get size() {
      return store.size
    },
  }
}

/** Process-wide cache for the Express process. */
export const planCache = createPlanCache()
