export const USER_ID_STORAGE_KEY = 'mcp-ui-user-id-v1'

/**
 * Stable demo user id for API calls (generate, store-data). Persisted in localStorage
 * so refresh keeps the same namespace on the server; mirrors glass settings pattern.
 */
export function readOrCreateUserId() {
  try {
    const existing = localStorage.getItem(USER_ID_STORAGE_KEY)
    if (existing && existing.trim()) return existing.trim()
  } catch {
    /* ignore */
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `user-${crypto.randomUUID()}`
      : `user-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  try {
    localStorage.setItem(USER_ID_STORAGE_KEY, id)
  } catch {
    /* ignore quota */
  }
  return id
}

/** Clears stored id and creates a new one (new server-side data namespace). */
export function resetUserId() {
  try {
    localStorage.removeItem(USER_ID_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return readOrCreateUserId()
}

export function formatUserIdShort(id) {
  if (!id || id.length <= 24) return id
  return `${id.slice(0, 14)}…${id.slice(-6)}`
}
