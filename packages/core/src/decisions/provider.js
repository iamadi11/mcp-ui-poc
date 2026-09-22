/**
 * Decision backend selection: Laya (open) vs Jev (TypeSafe) vs none.
 *
 * DECISION_PROVIDER=auto|laya|jev (default auto)
 *   auto → Laya when configured, else Jev when a TypeSafe key exists
 */

import { jevAvailable, jevModel } from '../jev/planner.js'
import { layaAvailable, layaModel, defaultAskLaya, layaAdapter } from './laya.js'
import { jevAdapter } from './jev.js'

export function decisionProviderPreference() {
  const raw = String(process.env.DECISION_PROVIDER || 'auto').trim().toLowerCase()
  if (raw === 'laya' || raw === 'jev' || raw === 'auto') return raw
  return 'auto'
}

export function decideBackend({ typesafeApiKey, preference } = {}) {
  const pref = preference || decisionProviderPreference()
  if (pref === 'laya') return layaAvailable() ? 'laya' : null
  if (pref === 'jev') return jevAvailable(typesafeApiKey) ? 'jev' : null
  if (layaAvailable()) return 'laya'
  if (jevAvailable(typesafeApiKey)) return 'jev'
  return null
}

export function decisionAvailable(typesafeApiKey) {
  return decideBackend({ typesafeApiKey }) != null
}

export function decisionModel(backend) {
  if (backend === 'laya') return layaModel()
  return jevModel()
}

/**
 * Resolve an ask({ state, questions, model }) function for planWithJev.
 * Injected askJev always wins (tests / advanced hosts).
 */
export function resolveAskDecision({ askJev, typesafeApiKey, preference } = {}) {
  if (typeof askJev === 'function') {
    return { backend: 'injected', ask: askJev, model: undefined }
  }
  const backend = decideBackend({ typesafeApiKey, preference })
  if (backend === 'laya') {
    return {
      backend: 'laya',
      model: layaModel(),
      ask: (args) =>
        layaAdapter
          .decide({ ...args, askLaya: defaultAskLaya })
          .then((r) => ({ answers: r.answers, confidence: r.confidence, model: r.model })),
    }
  }
  if (backend === 'jev') {
    return {
      backend: 'jev',
      model: jevModel(),
      ask: (args) =>
        jevAdapter.decide({ ...args, apiKey: typesafeApiKey }).then((r) => ({
          answers: r.answers,
          confidence: r.confidence,
          model: r.model,
        })),
    }
  }
  return { backend: null, ask: null, model: undefined }
}

export { layaAdapter, layaAvailable, layaModel }
