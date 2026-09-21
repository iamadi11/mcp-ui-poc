/**
 * Shared helpers for LLM adapters.
 */

/** Flatten user content (string or content-block array) into plain text. */
export function userContentToText(userContent) {
  return Array.isArray(userContent)
    ? userContent.map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n')
    : userContent
}

/** Map an SDK error from a verifyApiKey call to the adapter's result shape. */
export function verifyApiKeyError(error) {
  return { valid: false, error: error?.status === 401 ? 'Invalid API key' : error.message }
}

/** Planner LLM call timeout in ms (default 30s). */
export function llmTimeoutMs() {
  const n = Number(process.env.MCP_LLM_TIMEOUT_MS || 30000)
  return Number.isFinite(n) && n > 0 ? n : 30000
}

export function llmAbortSignal() {
  return AbortSignal.timeout(llmTimeoutMs())
}

/** Normalize abort/timeout errors into a stable 504 planner timeout. */
export function mapLlmTimeoutError(error) {
  const name = error?.name || ''
  const msg = String(error?.message || '')
  const aborted =
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    error?.code === 20 ||
    /aborted|timeout/i.test(msg)
  if (!aborted) return error
  const err = new Error(`Planner timed out after ${llmTimeoutMs()}ms`)
  err.status = 504
  err.cause = error
  return err
}
