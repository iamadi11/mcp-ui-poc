const API_KEY_STORAGE_KEY = 'mcpui:anthropicApiKey'
const ENDPOINTS_STORAGE_KEY = 'mcpui:savedEndpoints'

export function readApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function writeApiKey(key) {
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key)
    else localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch {
    /* ignore quota */
  }
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
