import { createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCache, getCache, setCache } from './store.js'

const COOKIE = 'mcp_ui_session'
const TTL_SECONDS = 60 * 60 * 24 * 7

function secret() {
  return process.env.SESSION_SECRET || ''
}

export function sessionConfigured() {
  return Boolean(secret())
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function unsign(token) {
  if (!token || !secret()) return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function readCookies(req) {
  const header = req.get('cookie') || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function cookieOptions({ clear = false } = {}) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  const maxAge = clear ? 0 : TTL_SECONDS
  return [
    `${COOKIE}=${clear ? '' : ''}PLACEHOLDER`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join('; ')
}

export function setSessionCookie(res, payload) {
  const token = sign({ ...payload, exp: Date.now() + TTL_SECONDS * 1000 })
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    [
      `${COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : '',
      `Max-Age=${TTL_SECONDS}`,
    ]
      .filter(Boolean)
      .join('; '),
  )
}

export function clearSessionCookie(res) {
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
  res.setHeader(
    'Set-Cookie',
    [
      `${COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : '',
      'Max-Age=0',
    ]
      .filter(Boolean)
      .join('; '),
  )
}

export async function readSession(req) {
  const token = readCookies(req)[COOKIE]
  const payload = unsign(token)
  if (!payload) return null
  if (payload.sid) {
    const stored = await getCache(`oauth:${payload.sid}`)
    if (stored && typeof stored === 'object') return stored
  }
  return { githubId: payload.githubId, login: payload.login }
}

export async function writeSession(res, user) {
  const sid = `${user.githubId}-${Date.now()}`
  await setCache(`oauth:${sid}`, { githubId: user.githubId, login: user.login }, TTL_SECONDS)
  setSessionCookie(res, { githubId: user.githubId, login: user.login, sid })
}

export async function revokeSession(req) {
  const token = readCookies(req)[COOKIE]
  const payload = unsign(token)
  if (payload?.sid) await deleteCache(`oauth:${payload.sid}`)
}

export function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '')
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
  const host = req.get('x-forwarded-host') || req.get('host')
  return `${proto}://${host}`
}
