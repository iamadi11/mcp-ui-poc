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
