/**
 * Follow-up turns upgrade the current widget. Code owns the deltas so
 * "add a tooltip" does not rebuild a layout from scratch.
 */

const ITERATE_RE =
  /\b(add|make it|make the|change|tweak|update|upgrade|rename|hide|remove|show only|tooltip|hover|animate|animations?|responsive|drawer|sheet|mobile)\b/i

const DASHBOARD_RE = /\bcreate a (new )?dashboard\b|\bbuild a dashboard\b/i

const MISSING_RECORDS_RE =
  /\b(nothing|empty|missing|visible|blank).{0,48}\b(records?|table|rows)\b|\b(records?|table|rows).{0,48}\b(nothing|empty|missing|visible|blank)\b/i

function wantsRecordsLayout(text) {
  return (
    DASHBOARD_RE.test(text) ||
    /\brecords?\b|\brows\b/i.test(text) ||
    (/\btable\b/i.test(text) && /\b(add|show|include|visible|missing)\b/i.test(text))
  )
}

function hasRecordsLayout(policy) {
  const types = policy?.componentTypes || []
  return types.includes('table') || types.includes('list')
}

export function policyFitsShape(policy, shape) {
  if (!policy || !shape) return true
  if (shape.rowsPath != null && policy.rowsPath != null && String(policy.rowsPath) !== String(shape.rowsPath)) {
    return false
  }
  const fields = new Set((shape.fields || []).map((f) => f.key))
  const claimed = [
    ...(Array.isArray(policy.includedFields) ? policy.includedFields : []),
    ...(Array.isArray(policy.columns) ? policy.columns.map((c) => c?.key) : []),
  ].filter(Boolean)
  if (!claimed.length || !fields.size) return true
  return claimed.some((key) => fields.has(key))
}

export function isIteratePrompt(text) {
  const raw = String(text || '')
  if (DASHBOARD_RE.test(raw)) return false
  if (MISSING_RECORDS_RE.test(raw)) return true
  return ITERATE_RE.test(raw)
}

export function selectReplayPolicy({ fingerprintPolicy, iterate, instructions, shape } = {}) {
  if (iterate) return null
  if (!fingerprintPolicy) return null
  if (!policyFitsShape(fingerprintPolicy, shape)) return null
  if (wantsRecordsLayout(String(instructions || '')) && !hasRecordsLayout(fingerprintPolicy)) {
    return null
  }
  return fingerprintPolicy
}

function ensureTypes(types, extras) {
  const next = Array.isArray(types) ? [...types] : []
  for (const type of extras) {
    if (!next.includes(type)) next.push(type)
  }
  return next
}

export function applyInstructionUpgrades(policy, instructions) {
  const text = String(instructions || '')
  const next = {
    ...(policy || {}),
    componentTypes: Array.isArray(policy?.componentTypes) ? [...policy.componentTypes] : [],
    chart: policy?.chart ? { ...policy.chart } : undefined,
  }

  if (/\btooltip|\bhover\b/i.test(text)) {
    next.chart = { ...(next.chart || {}), tooltip: true }
    if (!next.componentTypes.includes('chart')) next.componentTypes.push('chart')
  }

  if (/\bline\b/i.test(text) && /\bchart\b/i.test(text)) {
    next.chart = { ...(next.chart || {}), chartType: 'line' }
  } else if (/\bbar\b/i.test(text) && /\bchart\b/i.test(text)) {
    next.chart = { ...(next.chart || {}), chartType: 'bar' }
  } else if (/\bpie\b/i.test(text) && /\bchart\b/i.test(text)) {
    next.chart = { ...(next.chart || {}), chartType: 'pie' }
  }

  if (/\bstagger\b|\bheavy animat|\banimat|\bmotion\b/i.test(text)) {
    next.motion = /\blive\b/i.test(text) ? 'live' : 'stagger'
  }

  if (/\bdrawer|\bsheet|\binsights?\b|\bresponsive|\bmobile\b/i.test(text)) {
    next.drawer = true
    next.componentTypes = ensureTypes(next.componentTypes, ['table'])
  }

  if (/\bonly (the )?chart\b|\bhide (the )?table\b/i.test(text)) {
    next.componentTypes = next.componentTypes.filter((type) => type !== 'table' && type !== 'list')
    if (!next.componentTypes.includes('chart')) next.componentTypes.push('chart')
  } else if (wantsRecordsLayout(text)) {
    next.componentTypes = ensureTypes(next.componentTypes, ['stat-grid', 'chart', 'table'])
  }

  return next
}

export function mergeIteratePolicy(previous, generated, instructions) {
  const base = previous || generated || {}
  const upgraded = applyInstructionUpgrades(base, instructions)
  const fromJev = generated || {}
  return {
    ...base,
    ...upgraded,
    title: base.title || fromJev.title,
    summary: base.summary || fromJev.summary,
    presentation: base.presentation || fromJev.presentation,
    componentTypes:
      upgraded.componentTypes?.length ? upgraded.componentTypes : fromJev.componentTypes || base.componentTypes,
    chart: { ...(base.chart || {}), ...(fromJev.chart || {}), ...(upgraded.chart || {}) },
    motion: upgraded.motion || fromJev.motion || base.motion || 'none',
    drawer: Boolean(upgraded.drawer || fromJev.drawer || base.drawer),
    includedFields: base.includedFields || fromJev.includedFields,
    rowsPath: base.rowsPath ?? fromJev.rowsPath,
    columns: base.columns || fromJev.columns,
  }
}
