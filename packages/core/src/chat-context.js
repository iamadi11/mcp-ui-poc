/**
 * Compact user-turn history so Jev and Haiku remember the original ask.
 * Thoughts and assistant copy stay out of the model context.
 */

const MAX_TURNS = 8
const MAX_TEXT = 500

export function normalizeChatHistory(raw) {
  const out = []
  const seen = new Set()
  for (const item of Array.isArray(raw) ? raw : []) {
    const role = item?.role || 'user'
    if (role !== 'user') continue
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const key = text.slice(0, 240)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ role: 'user', text: text.slice(0, MAX_TEXT) })
    if (out.length >= MAX_TURNS) break
  }
  return out
}

export function mergeChatHistory(sessionHistory, clientHistory) {
  return normalizeChatHistory([...(sessionHistory || []), ...(clientHistory || [])])
}

export function sessionGoal(existing, history, current) {
  const remembered = String(existing || '').trim()
  if (remembered) return remembered.slice(0, MAX_TEXT)
  const first = normalizeChatHistory(history)[0]?.text
  return String(first || current || '').trim().slice(0, MAX_TEXT)
}

export function effectivePrompt({ current, history, goal } = {}) {
  const now = String(current || '').trim()
  const remembered = String(goal || '').trim()
  const prior = normalizeChatHistory(history).map((turn) => turn.text).filter((text) => text !== now)
  if (!remembered && !prior.length) return now
  if (remembered === now && !prior.length) return now
  const lines = []
  if (remembered && remembered !== now) lines.push(`Original request: ${remembered}`)
  const earlier = prior.filter((text) => text !== remembered)
  if (earlier.length) lines.push(`Earlier asks: ${earlier.join(' | ')}`)
  lines.push(`This turn: ${now}`)
  return lines.join('\n')
}

/** Idempotent wrap so Studio can pass a raw follow-up or an already-composed prompt. */
export function composeTurnPrompt({ current, history, goal } = {}) {
  const now = String(current || '').trim()
  if (/^Original request:/m.test(now) && /This turn:/m.test(now)) return now
  return effectivePrompt({ current, history, goal })
}

/** The user's latest message, even when `instructions` is an Original-request wrap. */
export function currentTurnText(instructions) {
  const text = String(instructions || '')
  const match = text.match(/(?:^|\n)This turn:\s*([\s\S]+)$/)
  if (match) return match[1].trim()
  return text.trim()
}
