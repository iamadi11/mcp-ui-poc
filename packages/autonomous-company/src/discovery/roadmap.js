/**
 * Parse docs/engineering-roadmap.md Selected / Deferred tables into discovery candidates.
 * Does not invent rows — only what the markdown tables contain.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const ROADMAP_RELATIVE_PATH = 'docs/engineering-roadmap.md'
export const SELECTED_CONFIDENCE = 0.85
export const DEFERRED_CONFIDENCE = 0.35
export const CURSOR_ENGINEERING_BLOCK_REASON =
  'Requires Cursor agent / engineering worker (LLM) — implement Selected roadmap item'

const TYPE_TO_CATEGORY = {
  feature: 'product',
  product: 'product',
  fix: 'bug',
  bug: 'bug',
  security: 'security',
  reliability: 'reliability',
  ux: 'ux',
  debt: 'tech_debt',
  docs: 'documentation',
}

/**
 * @param {string} markdown
 * @returns {{ selected: object[], deferred: object[] }}
 */
export function parseEngineeringRoadmapMarkdown(markdown) {
  const selected = []
  const deferred = []
  if (!markdown || typeof markdown !== 'string') return { selected, deferred }

  const sections = splitSections(markdown)
  for (const section of sections) {
    const heading = section.heading.toLowerCase()
    const isSelected = /selected|must implement/.test(heading)
    const isDeferred = /deferred/.test(heading) && !isSelected
    if (!isSelected && !isDeferred) continue
    const rows = parsePipeTable(section.body)
    for (const row of rows) {
      const id = (row.id || row.ID || '').trim()
      if (!/^([A-Z]{1,4})-(\d{2,4})$/i.test(id)) continue
      const type = String(row.type || row.Type || 'fix').trim().toLowerCase()
      const title = String(row.title || row.Title || '').trim()
      if (!title) continue
      const evidence = String(row.evidence || row.Evidence || '').trim()
      const acceptance = String(
        row.acceptance || row.Acceptance || row.notes || row.Notes || '',
      ).trim()
      const entry = {
        id: id.toUpperCase(),
        type,
        title,
        evidence,
        acceptance,
        section: isSelected ? 'selected' : 'deferred',
      }
      if (isSelected) selected.push(entry)
      else deferred.push(entry)
    }
  }
  return { selected, deferred }
}

function splitSections(markdown) {
  const lines = markdown.split(/\r?\n/)
  const sections = []
  let current = null
  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.+)\s*$/.exec(line)
    if (headingMatch) {
      if (current) sections.push(current)
      current = { heading: headingMatch[2].trim(), body: [] }
      continue
    }
    if (current) current.body.push(line)
  }
  if (current) sections.push(current)
  return sections.map((s) => ({ heading: s.heading, body: s.body.join('\n') }))
}

function parsePipeTable(body) {
  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const tableLines = lines.filter((l) => l.startsWith('|'))
  if (tableLines.length < 2) return []

  const headerCells = splitRow(tableLines[0])
  if (!headerCells.length) return []
  // skip separator |---|---|
  const start = /^\|?\s*:?-+:?\s*\|/.test(tableLines[1]) ? 2 : 1
  const headers = headerCells.map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const rows = []
  for (let i = start; i < tableLines.length; i += 1) {
    const cells = splitRow(tableLines[i])
    if (!cells.length) continue
    const row = {}
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c]
      row[key] = cells[c] ?? ''
      // also keep common aliases
      if (key === 'id') row.id = cells[c]
      if (key === 'type') row.type = cells[c]
      if (key === 'title') row.title = cells[c]
      if (key === 'evidence') row.evidence = cells[c]
      if (key === 'acceptance' || key === 'notes') {
        row.acceptance = row.acceptance || cells[c]
      }
    }
    rows.push(row)
  }
  return rows
}

function splitRow(line) {
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

function categoryForType(type) {
  return TYPE_TO_CATEGORY[type] || 'bug'
}

function rowToCandidate(row, { confidence, origin }) {
  const category = categoryForType(row.type)
  const roadmapPath = ROADMAP_RELATIVE_PATH
  return {
    category,
    problemKey: `roadmap:${row.id}`,
    title: `[${row.id}] ${row.title}`,
    department: 'engineering',
    confidence,
    origin,
    roadmapId: row.id,
    workType: row.type,
    skipDeliberation: origin === 'roadmap:selected',
    evidence: [
      {
        type: 'roadmap',
        path: roadmapPath,
        note: row.evidence || row.title,
        labeled: origin === 'roadmap:selected' ? 'verified' : 'hypothesis',
      },
    ],
    impact:
      origin === 'roadmap:selected'
        ? `Selected roadmap item ${row.id} — must implement`
        : `Deferred roadmap item ${row.id} — review only`,
    effort: 'M',
    ownerRole: 'engineer',
    filesLikely: guessFiles(row),
    acceptanceCriteria: [
      row.acceptance || `Ship or explicitly re-defer ${row.id} with evidence`,
      `Keep docs/${roadmapPath.split('/').pop()} honest after completion`,
    ],
    validationPlan: ['Relevant unit/lint checks for touched files', 'npm run company:test'],
    risks:
      origin === 'roadmap:selected'
        ? ['Requires Cursor agent / engineering worker (LLM)']
        : ['Do not promote without new evidence or ADR'],
    hypothesis: origin === 'roadmap:deferred' ? row.evidence || row.title : null,
  }
}

function guessFiles(row) {
  const blob = `${row.evidence} ${row.title} ${row.acceptance}`
  const files = []
  const re = /`([^`]+\.(?:js|jsx|md|json))`/g
  let m
  while ((m = re.exec(blob))) {
    files.push(m[1])
  }
  return files.slice(0, 8)
}

/**
 * @param {string} repoRoot
 * @param {{ roadmapPath?: string }} [options]
 */
export function discoverEngineeringRoadmap(repoRoot, options = {}) {
  const rel = options.roadmapPath || ROADMAP_RELATIVE_PATH
  const full = join(repoRoot, rel)
  if (!existsSync(full)) return []

  let text
  try {
    text = readFileSync(full, 'utf8')
  } catch {
    return []
  }

  const { selected, deferred } = parseEngineeringRoadmapMarkdown(text)
  const candidates = []

  for (const row of selected) {
    candidates.push(
      rowToCandidate(row, {
        confidence: SELECTED_CONFIDENCE,
        origin: 'roadmap:selected',
      }),
    )
  }
  for (const row of deferred) {
    candidates.push(
      rowToCandidate(row, {
        confidence: DEFERRED_CONFIDENCE,
        origin: 'roadmap:deferred',
      }),
    )
  }
  return candidates
}

/** True when OS must not fake-complete; Cursor LLM implements. */
export function requiresCursorEngineering(work) {
  if (!work) return false
  const origin = String(work.origin || '')
  const key = String(work.problemKey || '')
  const isRoadmapSelected =
    origin === 'roadmap:selected' || (key.startsWith('roadmap:') && work.confidence >= 0.8)
  if (!isRoadmapSelected) return false
  const dept = work.department || 'engineering'
  if (dept !== 'engineering') return false
  const type = String(work.workType || work.category || '').toLowerCase()
  return ['feature', 'fix', 'bug', 'product', 'security', 'reliability'].includes(type)
    || ['product', 'bug', 'security', 'reliability'].includes(work.category)
}

export function isSpeculativeOrDeferredOnly(tasks) {
  if (!tasks?.length) return false
  const open = tasks.filter((t) => {
    const s = t.status
    return !['completed', 'rejected', 'abandoned', 'failed'].includes(s)
  })
  if (!open.length) return false
  return open.every((t) => {
    if (t.origin === 'roadmap:deferred') return true
    if (t.confidence != null && t.confidence < 0.8 && t.origin !== 'roadmap:selected') return true
    const onlyHyp =
      (t.evidence || []).length > 0
      && (t.evidence || []).every((e) => e.labeled === 'hypothesis')
    return onlyHyp || String(t.origin || '').startsWith('cadence:')
  })
}

export function hasHighValueEngineeringWork(tasks) {
  return (tasks || []).some((t) => {
    const s = t.status
    const open =
      ['ready', 'queued', 'stale', 'blocked', 'claimed', 'in_progress', 'review', 'validation'].includes(
        s,
      )
    if (!open) return false
    if (t.origin === 'roadmap:selected') return true
    if (String(t.problemKey || '').startsWith('roadmap:') && (t.confidence ?? 0) >= 0.8) return true
    return (
      t.department === 'engineering'
      && (t.confidence ?? 0) >= 0.8
      && ['product', 'bug', 'security', 'reliability', 'ux'].includes(t.category)
    )
  })
}
