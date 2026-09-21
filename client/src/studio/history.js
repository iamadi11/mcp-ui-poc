const KEY = 'mcp-studio-history'
const ARCHIVE_KEY = 'mcp-studio-archive'
const MAX_CHATS = 24
const MAX_ARCHIVE = 80
export const MAX_VERSIONS = 8

function empty() {
  return { chats: [], activeId: null }
}

export function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw || !Array.isArray(raw.chats)) return empty()
    const chats = raw.chats.filter((chat) => !chat?.deletedAt).slice(0, MAX_CHATS)
    const activeId = chats.some((chat) => chat.id === raw.activeId) ? raw.activeId : (chats[0]?.id || null)
    return { chats, activeId }
  } catch {
    return empty()
  }
}

export function writeHistory(state) {
  const payload = {
    chats: (state.chats || []).slice(0, MAX_CHATS),
    activeId: state.activeId || null,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
    return true
  } catch {
    const stripped = payload.chats.map((chat) => ({
      ...chat,
      versions: stripOldVersionHtml(chat.versions),
    }))
    try {
      localStorage.setItem(KEY, JSON.stringify({ chats: stripped.slice(0, 8), activeId: payload.activeId }))
      return true
    } catch {
      return false
    }
  }
}

export function chatTitle(messages) {
  const first = (messages || []).find((item) => item.role === 'user')
  const text = String(first?.text || 'New chat').replace(/\s+/g, ' ').trim()
  return text.slice(0, 56) || 'New chat'
}

export function upsertChat(chats, chat) {
  const next = (chats || []).filter((item) => item.id !== chat.id)
  next.unshift(chat)
  return next.slice(0, MAX_CHATS)
}

export function compactResult(result) {
  if (!result) return null
  const sourceUrl = result.sourceUrl || result.meta?.source?.url || ''
  return {
    resource: result.resource || null,
    html: result.html || null,
    spec: result.spec || null,
    policy: result.policy || null,
    themeId: result.themeId || result.meta?.designSystem || null,
    themePack: result.themePack || null,
    motion: result.motion || result.meta?.motion || result.spec?.motion || 'none',
    look: result.look || result.spec?.look || 'default',
    sourceUrl,
    meta: result.meta || null,
    componentId: result.componentId || null,
  }
}

export function sessionDraft(result) {
  const packed = compactResult(result)
  if (!packed?.spec) return null
  return {
    spec: packed.spec,
    policy: packed.policy || null,
    themeId: packed.themeId || 'shadcn',
    themePack: packed.themePack || null,
    motion: packed.motion || 'none',
    look: packed.look === 'vivid' ? 'vivid' : 'default',
    sourceUrl: packed.sourceUrl || '',
    decisionId: packed.componentId || null,
  }
}

export function appendVersion(versions, entry) {
  const next = [...(versions || [])]
  if (entry?.id && next.some((item) => item.id === entry.id)) return next.slice(-MAX_VERSIONS)
  next.push(entry)
  return next.slice(-MAX_VERSIONS)
}

export function makeVersion(prompt, result) {
  const packed = compactResult(result)
  return {
    id: packed?.componentId || `v-${Date.now()}`,
    prompt: String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    createdAt: new Date().toISOString(),
    result: packed,
  }
}

export function versionLabel(version, index) {
  const prompt = String(version?.prompt || '').replace(/\s+/g, ' ').trim()
  if (prompt) return `v${index + 1} · ${prompt.slice(0, 28)}`
  return `Version ${index + 1}`
}

export function loadArchive() {
  try {
    const raw = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function writeArchive(chats) {
  const payload = (chats || []).slice(0, MAX_ARCHIVE)
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(payload))
    return true
  } catch {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(payload.slice(0, 16)))
      return true
    } catch {
      return false
    }
  }
}

export function isArchived(id) {
  if (!id) return false
  return loadArchive().some((item) => item.id === id)
}

function compactMeta(meta) {
  if (!meta) return null
  return {
    planner: meta.planner || null,
    plannerLabel: meta.plannerLabel || null,
    jevConfidence: meta.jevConfidence ?? null,
    path: Array.isArray(meta.path) ? meta.path : [],
    reason: meta.reason || '',
    cached: Boolean(meta.cached),
    fresh: Boolean(meta.fresh),
  }
}

function compactTrainingResult(result) {
  if (!result) return null
  return {
    spec: result.spec || null,
    policy: result.policy || null,
    themeId: result.themeId || result.meta?.designSystem || null,
    themePack: result.themePack || null,
    motion: result.motion || result.meta?.motion || result.spec?.motion || 'none',
    look: result.look || result.spec?.look || 'default',
    sourceUrl: result.sourceUrl || result.meta?.source?.url || '',
    meta: compactMeta(result.meta),
    componentId: result.componentId || null,
  }
}

/** Prompt log + policy/spec only — no HTML, iframe resource, or API payloads. */
export function trainingRecord(chat) {
  const deletedAt = chat?.deletedAt || new Date().toISOString()
  const messages = (chat?.messages || []).map((item) => {
    if (item?.role === 'metrics') {
      return {
        role: 'metrics',
        planner: item.planner || null,
        path: Array.isArray(item.path) ? item.path : [],
        reason: item.reason || '',
        totalMs: item.totalMs ?? null,
      }
    }
    return {
      role: item?.role || 'user',
      text: String(item?.text || '').slice(0, 4000),
    }
  })
  const versions = (chat?.versions || []).map((item) => ({
    id: item?.id || null,
    prompt: String(item?.prompt || '').slice(0, 400),
    createdAt: item?.createdAt || null,
    result: compactTrainingResult(item?.result),
  }))
  return {
    id: chat?.id,
    sessionId: chat?.id,
    title: String(chat?.title || 'Untitled').slice(0, 120),
    messages,
    versions,
    result: compactTrainingResult(chat?.result),
    publicId: chat?.publicId || null,
    updatedAt: chat?.updatedAt || deletedAt,
    deletedAt,
  }
}

export function archiveChatLocal(chat) {
  const record = trainingRecord(chat)
  if (!record.id) return record
  const next = [record, ...loadArchive().filter((item) => item.id !== record.id)].slice(0, MAX_ARCHIVE)
  writeArchive(next)
  return record
}

export function removeChatFromHistory(chats, id) {
  return (chats || []).filter((chat) => chat.id !== id && !chat.deletedAt)
}

function stripOldVersionHtml(versions) {
  const list = versions || []
  return list.map((item, index) => {
    if (index === list.length - 1 || !item?.result) return item
    return {
      ...item,
      result: { ...item.result, html: undefined, resource: undefined },
    }
  })
}
