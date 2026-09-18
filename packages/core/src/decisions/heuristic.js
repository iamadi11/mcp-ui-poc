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
    if (/\bchart\b/.test(lower)) named = 'chart'
    else if (/\btable\b/.test(lower)) named = 'table'
    else if (/\blist\b/.test(lower)) named = 'list'
    else if (/headline|metrics|stat/.test(lower)) named = 'stat-grid'

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
      chart_type: { choice: /\bline\b/.test(lower) ? 'line' : /\bpie\b/.test(lower) ? 'pie' : 'bar', confidence: 0.4 },
      needs_fetch: { noul: hasUrl ? 0.9 : 0.1 },
      needs_motion: { noul: /\banimat|\bmotion|\bstagger|\blive\b/.test(lower) ? 0.7 : 0.1 },
      needs_llm: { noul: 0.1 },
      in_catalog: { noul: 0.85 },
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
