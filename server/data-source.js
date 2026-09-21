import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BODY_BYTES = Number(process.env.MCP_MAX_FETCH_BYTES || 2 * 1024 * 1024) // 2 MiB
const FETCH_TIMEOUT_MS = Number(process.env.MCP_FETCH_TIMEOUT_MS || 15000)

function allowPrivateEndpoints() {
  return process.env.MCP_ALLOW_PRIVATE_ENDPOINTS === '1'
}

const PRIVATE_IPV6_PREFIXES = ['fe80', 'fc', 'fd']

function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
}

/** Extract dotted IPv4 from IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:xxxx:yyyy). */
function ipv4FromMappedIPv6(addr) {
  const a = normalizeHost(addr)
  const dotted = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (dotted) return dotted[1]
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!hex) return null
  const hi = Number.parseInt(hex[1], 16)
  const lo = Number.parseInt(hex[2], 16)
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
}

function isPrivateIPv6(addr) {
  const a = normalizeHost(addr)
  if (a === '::1') return true
  if (PRIVATE_IPV6_PREFIXES.some((prefix) => a.startsWith(prefix))) return true
  const mapped = ipv4FromMappedIPv6(a)
  if (mapped) return isPrivateIPv4(mapped)
  return false
}

function isPrivateIPv4(addr) {
  const parts = String(addr).split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 127 || a === 10 || a === 0) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true
  // 100.64.0.0/10 carrier-grade NAT (common cloud internal)
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateAddress(addr) {
  const host = normalizeHost(addr)
  const ipKind = isIP(host)
  if (ipKind === 4) return isPrivateIPv4(host)
  if (ipKind === 6) return isPrivateIPv6(host)
  return host.includes(':') ? isPrivateIPv6(host) : isPrivateIPv4(host)
}

/**
 * Reject decimal/hex IP spellings in the *raw* URL host before relying on URL()/DNS.
 * WHATWG URL may normalize some forms; this keeps older/resolver edge cases closed.
 */
function assertHostNotEncoded(rawUrl) {
  const m = String(rawUrl).match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i)
  if (!m) return
  let host = m[1]
  // strip userinfo and port (keep IPv6 bracket form intact for stripping below)
  host = host.replace(/^([^@]*@)/, '')
  if (host.startsWith('[')) {
    host = host.replace(/^\[([^\]]*)\].*$/, '$1')
  } else {
    host = host.replace(/:\d+$/, '')
  }
  host = host.trim()
  if (!host) return

  if (/^[0-9]+$/.test(host)) {
    const err = new Error('Numeric hosts are not allowed')
    err.status = 400
    throw err
  }
  if (/^0[xX][0-9a-fA-F.]+$/.test(host) || /(^|\.)0[xX]/.test(host)) {
    const err = new Error('Hex-encoded hosts are not allowed')
    err.status = 400
    throw err
  }
}

/** Validate a user-supplied endpoint URL; rejects non-HTTP schemes and private/loopback hosts (SSRF guard). */
export async function assertSafeEndpoint(rawUrl) {
  assertHostNotEncoded(rawUrl)

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
  if (allowPrivateEndpoints()) return url

  const host = normalizeHost(url.hostname)
  const ipKind = isIP(host)
  const addrs = ipKind
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
