function minConfidence() {
  const raw = Number.parseFloat(process.env.JEV_MIN_CONFIDENCE || '0.5')
  return Number.isFinite(raw) ? raw : 0.5
}

const NOUL_HIGH = 0.5

export function noulValue(answer, fallback = 0) {
  const n = answer?.noul
  return typeof n === 'number' ? n : fallback
}

/**
 * Catalog can already express the ask (named widget or include_* ≥ 0.5, or
 * in_catalog noul). Motion/animation is a token — not a reason to call Haiku.
 */
export function catalogExpressible(answers, context = {}) {
  const named = answers?.named_widget?.choice
  if (context.surface && context.surface.catalog === false) return false
  if (named && named !== 'none') return true
  for (const [key, value] of Object.entries(answers || {})) {
    if (!key.startsWith('include_')) continue
    if (noulValue(value, 0) >= NOUL_HIGH) return true
  }
  return noulValue(answers?.in_catalog, 0) >= NOUL_HIGH
}

/** Confidence-gated: answer = what; confidence = whether to act. */
export function shouldUseLlm(answers, confidence, min = minConfidence(), context = {}) {
  if (catalogExpressible(answers, context)) return false
  if (context.surface && context.surface.catalog === false && noulValue(answers?.in_catalog, 1) < NOUL_HIGH) {
    return true
  }
  if (noulValue(answers?.needs_llm, 0) >= NOUL_HIGH && noulValue(answers?.in_catalog, 1) < NOUL_HIGH) return true
  if (noulValue(answers?.in_catalog, 1) < NOUL_HIGH) return true
  if (typeof confidence === 'number' && confidence < min) return true
  return false
}

export function motionToken(answers) {
  const choice = answers?.motion?.choice
  if (choice === 'enter' || choice === 'stagger' || choice === 'live' || choice === 'none') {
    return choice
  }
  if (noulValue(answers?.needs_motion, 0) >= NOUL_HIGH) return 'enter'
  return 'none'
}

export function pickPlannerPath({ cachedPolicy, jevOk, useLlm, llmAvailable }) {
  if (cachedPolicy) return 'replay'
  if (jevOk && !useLlm) return 'jev'
  if (useLlm && llmAvailable) return 'llm'
  if (jevOk) return 'jev'
  return 'heuristic'
}
