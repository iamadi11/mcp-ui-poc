import { Buffer } from 'node:buffer'

/** Default 768 KiB — keeps iframe documents and JSON responses bounded on small serverless RAM. */
const DEFAULT_MAX_HTML_BYTES = 786_432
const MIN_BYTES = 1024
const MAX_BYTES_CAP = 10_000_000

function readHtmlByteLimit() {
  const raw = process.env.MCP_MAX_HTML_BYTES
  if (raw == null || raw === '') return DEFAULT_MAX_HTML_BYTES
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return DEFAULT_MAX_HTML_BYTES
  return Math.min(Math.max(n, MIN_BYTES), MAX_BYTES_CAP)
}

export const MCP_MAX_HTML_BYTES = readHtmlByteLimit()

/**
 * Throws if UTF-8 byte length of generated HTML exceeds {@link MCP_MAX_HTML_BYTES}.
 * @param {unknown} html
 */
export function assertGeneratedHtmlWithinLimit(html) {
  const s = typeof html === 'string' ? html : String(html ?? '')
  const bytes = Buffer.byteLength(s, 'utf8')
  if (bytes > MCP_MAX_HTML_BYTES) {
    const err = new Error(
      `Generated HTML exceeds ${MCP_MAX_HTML_BYTES} bytes (got ${bytes}). Reduce fields/widgets or set MCP_MAX_HTML_BYTES.`
    )
    err.code = 'HTML_TOO_LARGE'
    err.statusCode = 413
    err.bytes = bytes
    err.limit = MCP_MAX_HTML_BYTES
    throw err
  }
}

export function isHtmlPayloadError(err) {
  return Boolean(err && err.code === 'HTML_TOO_LARGE' && err.statusCode === 413)
}

export function sendHtmlTooLarge(res, err) {
  return res.status(413).json({
    error: err.message,
    code: 'HTML_TOO_LARGE',
    limitBytes: err.limit,
    bytes: err.bytes,
  })
}
