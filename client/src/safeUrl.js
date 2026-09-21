/**
 * Host-boundary URL allowlist for action-row / iframe postMessage link actions.
 * Keep in sync with packages/core/src/safe-url.js (canonical + unit-tested).
 */
export function isSafeHttpUrl(raw) {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '#') return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
