const API_KEY_STORAGE_KEY = 'mcpui:anthropicApiKey'
const MAPS_KEY_STORAGE_KEY = 'mcpui:googleMapsApiKey'
const ENDPOINTS_STORAGE_KEY = 'mcpui:savedEndpoints'

/** Provider secrets use sessionStorage (cleared when the tab/session ends). */
function readSessionSecret(key) {
  try {
    const session = sessionStorage.getItem(key)
    if (session) return session
    // One-time migrate away from long-lived localStorage copies.
    const legacy = localStorage.getItem(key)
    if (legacy) {
      sessionStorage.setItem(key, legacy)
      localStorage.removeItem(key)
      return legacy
    }
    return ''
  } catch {
    return ''
  }
}

function writeSessionSecret(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
    // Ensure any prior localStorage copy cannot linger.
    localStorage.removeItem(key)
  } catch {
    /* ignore quota / private mode */
  }
}

export function readApiKey() {
  return readSessionSecret(API_KEY_STORAGE_KEY)
}

export function writeApiKey(key) {
  writeSessionSecret(API_KEY_STORAGE_KEY, key)
}

export function readGoogleMapsKey() {
  return readSessionSecret(MAPS_KEY_STORAGE_KEY)
}

export function writeGoogleMapsKey(key) {
  writeSessionSecret(MAPS_KEY_STORAGE_KEY, key)
}

export function readSavedEndpoints() {
  try {
    const raw = localStorage.getItem(ENDPOINTS_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function writeSavedEndpoints(list) {
  try {
    localStorage.setItem(ENDPOINTS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

const PACK_STORAGE_KEY = 'mcpui:themePack'

export function readThemePack() {
  try {
    const raw = localStorage.getItem(PACK_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeThemePack(pack) {
  try {
    if (pack) localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(pack))
    else localStorage.removeItem(PACK_STORAGE_KEY)
  } catch {
    /* ignore quota */
  }
}
