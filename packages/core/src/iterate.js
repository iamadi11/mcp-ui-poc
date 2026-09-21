/**
 * Follow-up turns upgrade the current widget. Code owns the deltas so
 * "add a tooltip" does not rebuild a layout from scratch.
 */

const ITERATE_RE =
  /\b(add|make it|make the|change|tweak|update|upgrade|rename|hide|remove|show only|tooltip|hover|animate|animations?|graffiti|neon|responsive|drawer|sheet|mobile|modern|colour(?:ful)?|color(?:ful)?|vivid|theme|style|look|rounder|radius|corners?|tighter)\b/i

const DASHBOARD_RE = /\bcreate a (new )?dashboard\b|\bbuild a dashboard\b/i

const CREATE_RE =
  /^\s*((please|can you|could you|would you|will you)\s+)?(create|build|generate|design|make me|make a)\b/i

const CREATE_ANYWHERE_RE =
  /\b(create|build|generate|design)\b.{0,80}\b(checkout|login|landing|game|form|page|app|dashboard|widget)\b/i

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
  if ((CREATE_RE.test(raw) || CREATE_ANYWHERE_RE.test(raw)) && !/\bmake it\b/i.test(raw)) return false
  if (MISSING_RECORDS_RE.test(raw)) return true
  return ITERATE_RE.test(raw)
}

export function selectReplayPolicy({ fingerprintPolicy, iterate, instructions, shape, fresh } = {}) {
  if (fresh !== false) return null
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
    const exclusive = ['login-form', 'work-stage', 'landing-page', 'checkout', 'pricing', 'form', 'settings', 'calendar', 'html-block']
    if (!exclusive.some((type) => next.componentTypes.includes(type))) {
      next.drawer = true
      next.componentTypes = ensureTypes(next.componentTypes, ['table'])
    }
  }

  const radiusOnly = /\brounder|\bradius|\bcorners?\b|\btighter\b/i.test(text)
    && !/\bvivid\b|\bmodern\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b/i.test(text)
  if (radiusOnly) {
    next.radius = /\btighter\b/i.test(text) ? '4px' : '16px'
  } else if (/\bmodern\b|\bvivid\b|\btheme\b|\bstyle\b|\blook\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b/i.test(text)) {
    next.look = 'vivid'
    if (!next.motion || next.motion === 'none') next.motion = 'stagger'
  }

  if (/\bonly (the )?chart\b|\bhide (the )?table\b/i.test(text)) {
    next.componentTypes = next.componentTypes.filter((type) => type !== 'table' && type !== 'list')
    if (!next.componentTypes.includes('chart')) next.componentTypes.push('chart')
  } else if (wantsRecordsLayout(text)) {
    next.componentTypes = ensureTypes(next.componentTypes, ['stat-grid', 'chart', 'table'])
  }

  if (next.componentTypes.includes('login-form')) {
    next.componentTypes = ['login-form']
    next.drawer = false
  }
  if (next.componentTypes.includes('work-stage')) {
    next.componentTypes = ['work-stage']
    next.drawer = false
  }
  if (next.componentTypes.includes('landing-page')) {
    next.componentTypes = ['landing-page']
    next.drawer = false
  }
  if (next.componentTypes.includes('checkout')) {
    next.componentTypes = ['checkout']
    next.drawer = false
  }
  if (next.componentTypes.includes('pricing')) {
    next.componentTypes = ['pricing']
    next.drawer = false
  }
  if (next.componentTypes.includes('form')) {
    next.componentTypes = ['form']
    next.drawer = false
  }
  if (next.componentTypes.includes('settings')) {
    next.componentTypes = ['settings']
    next.drawer = false
  }
  if (next.componentTypes.includes('calendar')) {
    next.componentTypes = ['calendar']
    next.drawer = false
  }
  if (next.componentTypes.includes('html-block')) {
    next.componentTypes = ['html-block']
    next.drawer = false
  }

  return next
}

function isRadiusOnly(text) {
  return /\brounder|\bradius|\bcorners?\b|\btighter\b/i.test(String(text || ''))
    && !/\bvivid\b|\bmodern\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b/i.test(String(text || ''))
}

export function isLookMotionOnly(text) {
  const s = String(text || '')
  if (!s.trim()) return false
  if (/\bgraffiti|neon|spray|glitch|paint\b/i.test(s)) return false
  const look = /\bvivid\b|\brounder\b|\bradius\b|\bcorners?\b|\btighter\b|\bmodern\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b|\banimat|\bmotion\b|\bstagger\b|\btheme\b|\bstyle\b|\blook\b/i.test(s)
  const create = /\bcreate\b|\bbuild\b|\bgame\b|\blogin\b|\bcheckout\b|\blanding\b|\bdashboard\b|\bform\b|\bmap\b|\bpricing\b|\bcalendar\b|\bsettings\b/i.test(s)
  return look && !create
}

export function mergeIteratePolicy(previous, generated, instructions) {
  const base = previous || generated || {}
  const upgraded = applyInstructionUpgrades(base, instructions)
  const fromJev = generated || {}
  const radiusOnly = isRadiusOnly(instructions)
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
    look: radiusOnly ? (base.look || 'default') : (upgraded.look || fromJev.look || base.look || 'default'),
    radius: upgraded.radius || fromJev.radius || base.radius,
    drawer: Boolean(upgraded.drawer || fromJev.drawer || base.drawer),
    includedFields: base.includedFields || fromJev.includedFields,
    rowsPath: base.rowsPath ?? fromJev.rowsPath,
    columns: base.columns || fromJev.columns,
    html: base.html || fromJev.html,
    css: base.css || fromJev.css,
    script: base.script || fromJev.script,
    kicker: base.kicker || fromJev.kicker,
  }
}
