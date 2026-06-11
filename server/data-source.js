import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BODY_BYTES = Number(process.env.MCP_MAX_FETCH_BYTES || 2 * 1024 * 1024) // 2 MiB
const FETCH_TIMEOUT_MS = Number(process.env.MCP_FETCH_TIMEOUT_MS || 15000)
const ALLOW_PRIVATE = process.env.MCP_ALLOW_PRIVATE_ENDPOINTS === '1'

const PRIVATE_IPV6_PREFIXES = ['fe80', 'fc', 'fd', '::ffff:127.', '::ffff:10.', '::ffff:192.168.']

function isPrivateIPv6(addr) {
  const a = addr.toLowerCase()
  return a === '::1' || PRIVATE_IPV6_PREFIXES.some((prefix) => a.startsWith(prefix))
}

function isPrivateIPv4(addr) {
  const [a, b] = addr.split('.').map(Number)
  if (a === 127 || a === 10 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  return false
}

function isPrivateAddress(addr) {
  return addr.includes(':') ? isPrivateIPv6(addr) : isPrivateIPv4(addr)
}

/** Validate a user-supplied endpoint URL; rejects non-HTTP schemes and private/loopback hosts (SSRF guard). */
export async function assertSafeEndpoint(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    const err = new Error('Invalid URL')
    err.status = 400
    throw err
  }
  if (!/^https?:$/.test(url.protocol)) {
    const err = new Error('Only http(s) endpoints are supported')
    err.status = 400
    throw err
  }
  if (ALLOW_PRIVATE) return url

  const host = url.hostname
  const addrs = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        const err = new Error(`Could not resolve host: ${host}`)
        err.status = 400
        throw err
      })
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    const err = new Error(
      'Endpoint resolves to a private/loopback address (set MCP_ALLOW_PRIVATE_ENDPOINTS=1 for local dev APIs)',
    )
    err.status = 400
    throw err
  }
  return url
}

/**
 * Fetch arbitrary user-provided endpoint. Returns { data, contentType, raw }.
 * Data of any type: JSON parsed when possible, otherwise raw text kept.
 */
export async function fetchEndpointData({ url, method = 'GET', headers = {}, body }) {
  const target = await assertSafeEndpoint(url)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let response
  try {
    response = await fetch(target, {
      method: method.toUpperCase(),
      headers: { accept: 'application/json, text/*;q=0.8, */*;q=0.5', ...headers },
      body: body && method.toUpperCase() !== 'GET' ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: 'follow',
    })
  } catch (e) {
    const err = new Error(
      e.name === 'AbortError' ? `Endpoint timed out after ${FETCH_TIMEOUT_MS}ms` : `Fetch failed: ${e.message}`,
    )
    err.status = 502
    throw err
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const err = new Error(`Endpoint returned ${response.status} ${response.statusText}`)
    err.status = 502
    throw err
  }

  const reader = response.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_BODY_BYTES) {
      reader.cancel()
      const err = new Error(`Response exceeds ${MAX_BODY_BYTES} byte limit`)
      err.status = 413
      throw err
    }
    chunks.push(value)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  const contentType = response.headers.get('content-type') || ''

  let data = raw
  try {
    data = JSON.parse(raw)
  } catch {
    // keep as text — planner handles any data type
  }
  return { data, contentType, raw, bytes: received }
}
