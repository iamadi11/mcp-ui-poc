/**
 * Google Maps JS API key for generated map workspaces.
 * Browser keys are restricted by HTTP referrer; still never log the value.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage()

export function sanitizeGoogleMapsKey(raw) {
  const key = String(raw || '').trim()
  return /^[A-Za-z0-9_-]{20,200}$/.test(key) ? key : ''
}

export function runWithGoogleMapsKey(key, fn) {
  return als.run(sanitizeGoogleMapsKey(key), fn)
}

export function googleMapsKey() {
  const scoped = als.getStore()
  if (typeof scoped === 'string' && scoped) return scoped
  return sanitizeGoogleMapsKey(process.env.GOOGLE_MAPS_API_KEY)
}
