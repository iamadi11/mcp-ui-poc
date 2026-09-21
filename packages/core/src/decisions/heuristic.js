import { CATALOG_TYPES } from '../jev/planner.js'
import { INTENT_CHOICES, SURFACE_CHOICES } from './schema.js'

function includeMap(types) {
  const out = {}
  for (const type of CATALOG_TYPES) {
    out[`include_${type.replace(/-/g, '_')}`] = {
      noul: types.includes(type) ? 0.9 : 0.05,
    }
  }
  return out
}

/**
 * No-key adapter: keyword answers on the frozen question schema.
 * Ugly-but-honest; code still builds the policy.
 */
export const heuristicAdapter = {
  id: 'heuristic',
  async decide({ state }) {
    const text = String(state?.instructions || state?.prompt || '')
    const lower = text.toLowerCase()
    const hasUrl = Boolean(state?.sourceUrl) || /https?:\/\//i.test(text)

    let intent = 'create_dashboard'
    if (/\bpublish\b|\bembed\b/.test(lower)) intent = 'publish'
    else if (/\bexplain\b|\bwhy\b/.test(lower)) intent = 'explain'
    else if (/\biterate\b|\bchange\b|\btweak\b|\bmake it\b|\badd\b|\btooltip\b|\bhover\b|\bupgrade\b/.test(lower)) intent = 'iterate'
    else if (hasUrl) intent = 'fetch_api'
    else if (/\bwidget\b|\bsingle\b|\bcomponent\b/.test(lower)) intent = 'create_widget'

    let surface = 'page'
    if (/\b(popup|modal|dialog|overlay)\b/.test(lower)) surface = 'modal'
    else if (/\bembed\b|\bcomponent\b|\bsnippet\b/.test(lower)) surface = 'component'

    let named = 'none'
    if (/\b(log\s*in|login|sign\s*in|sign-in|signin)\b/.test(lower)) named = 'login-form'
    else if (/\b(contact form|signup form|sign-up form|feedback form)\b/.test(lower) || (/\bform\b/.test(lower) && !/\bdashboard\b/.test(lower))) named = 'form'
    else if (/\b(account settings|settings page|user settings|preferences)\b/.test(lower)) named = 'settings'
    else if (/\bcalendar\b/.test(lower)) named = 'calendar'
    else if (/\b(landing|homepage|home page|marketing site)\b/.test(lower)) named = 'landing-page'
    else if (/checkout|check-out|check out/.test(lower)) named = 'checkout'
    else if (/\b(pricing|price plans?)\b/.test(lower)) named = 'pricing'
    else if (/\b(polygon|map|generator|editor|workspace|board)\b/.test(lower)) named = 'work-stage'
    else if (/\bchart\b/.test(lower)) named = 'chart'
    else if (/\btable\b/.test(lower)) named = 'table'
    else if (/\blist\b/.test(lower)) named = 'list'
    else if (/headline|metrics|stat/.test(lower)) named = 'stat-grid'

    let surfaceKind = 'records'
    if (named === 'login-form' || named === 'form' || named === 'settings') surfaceKind = 'auth'
    else if (named === 'calendar' || named === 'work-stage') surfaceKind = 'tool'
    else if (named === 'landing-page') surfaceKind = 'marketing'
    else if (named === 'checkout' || named === 'pricing') surfaceKind = 'commerce'

    const toolPrimitive = named === 'work-stage'
      ? (/\bmap|polygon|gis\b/.test(lower) ? 'map' : 'board')
      : 'none'

    const types = named !== 'none' ? [named] : ['stat-grid', 'table']
    const fields = state?.shape?.fields || []
    const fieldAnswers = {}
    fields.forEach((_, i) => {
      fieldAnswers[`field_${i}`] = { noul: 0.8 }
    })

    const answers = {
      intent: { choice: INTENT_CHOICES.includes(intent) ? intent : 'create_dashboard', confidence: 0.4 },
      surface: { choice: SURFACE_CHOICES.includes(surface) ? surface : 'page', confidence: 0.4 },
      presentation: { choice: surface, confidence: 0.4 },
      density: { score: surface === 'page' ? 1.5 : 0.4, confidence: 0.4 },
      named_widget: { choice: named, confidence: 0.4 },
      surface_kind: { choice: surfaceKind, confidence: 0.4 },
      tool_primitive: { choice: toolPrimitive, confidence: 0.4 },
      patch_hide_table: { noul: /\bhide (the )?table\b/.test(lower) ? 0.9 : 0.05 },
      patch_tooltip: { noul: /\btooltip|\bhover\b/.test(lower) ? 0.9 : 0.05 },
      patch_chart_bar: { noul: /\bbar\b/.test(lower) && /\bchart\b/.test(lower) ? 0.9 : 0.05 },
      patch_chart_line: { noul: /\bline\b/.test(lower) && /\bchart\b/.test(lower) ? 0.9 : 0.05 },
      patch_chart_pie: { noul: /\bpie\b/.test(lower) && /\bchart\b/.test(lower) ? 0.9 : 0.05 },
      patch_motion: { noul: /\banimat|\bmotion|\bstagger\b/.test(lower) ? 0.8 : 0.05 },
      patch_look_vivid: { noul: /\bvivid|\bmodern|\bcolour|\bcolor\b/.test(lower) ? 0.8 : 0.05 },
      patch_drawer: { noul: /\bdrawer|\bsheet\b/.test(lower) ? 0.8 : 0.05 },
      chart_type: { choice: /\bline\b/.test(lower) ? 'line' : /\bpie\b/.test(lower) ? 'pie' : 'bar', confidence: 0.4 },
      needs_fetch: { noul: hasUrl ? 0.9 : 0.1 },
      needs_motion: { noul: /\banimat|\bmotion|\bstagger|\blive\b/.test(lower) ? 0.7 : 0.1 },
      needs_llm: { noul: named === 'none' && !hasUrl && !/\bdashboard\b/.test(lower) ? 0.85 : 0.1 },
      in_catalog: { noul: named !== 'none' || hasUrl || /\bdashboard\b/.test(lower) ? 0.85 : 0.15 },
      motion: {
        choice: /\blive\b/.test(lower)
          ? 'live'
          : /\bstagger\b|heavy animat/.test(lower)
            ? 'stagger'
            : /\banimat|\bmotion\b/.test(lower)
              ? 'enter'
              : 'none',
        confidence: 0.4,
      },
      ...includeMap(types),
      ...fieldAnswers,
    }

    return { answers, confidence: 0.4, model: 'heuristic' }
  },
  isAvailable() {
    return true
  },
}
