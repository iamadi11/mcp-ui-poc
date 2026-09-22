/**
 * Laya DecisionAdapter — open-weight System 1 (choice / score / noul).
 * Same I/O as Jev. Prefer HTTP sidecar on serverless; optional local ONNX.
 *
 * Env:
 *   LAYA_BASE_URL   — e.g. http://127.0.0.1:8091  (POST /v1/system_one)
 *   LAYA_API_KEY    — optional Bearer for the sidecar
 *   LAYA_MODE       — http (default when BASE_URL) | onnx
 *   LAYA_MODEL_DIR  — local ONNX bundle for @receptron/laya
 *   LAYA_ENABLED    — set to 1 to allow ONNX auto-detect without BASE_URL
 *   LAYA_TIMEOUT_MS — HTTP timeout (default 15000)
 */

const DEFAULT_TIMEOUT_MS = 15000

let onnxAgent = null
let onnxLoadPromise = null

export function layaTimeoutMs() {
  const n = Number(process.env.LAYA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

export function layaMode() {
  const raw = String(process.env.LAYA_MODE || '').trim().toLowerCase()
  if (raw === 'onnx' || raw === 'http') return raw
  if (process.env.LAYA_BASE_URL) return 'http'
  if (process.env.LAYA_MODEL_DIR || process.env.LAYA_ENABLED === '1') return 'onnx'
  return 'http'
}

export function layaAvailable() {
  if (process.env.LAYA_BASE_URL) return true
  if (layaMode() === 'onnx' && (process.env.LAYA_MODEL_DIR || process.env.LAYA_ENABLED === '1')) {
    return true
  }
  return false
}

export function layaModel() {
  return process.env.LAYA_MODEL || 'laya'
}

function aggregateConfidence(answers) {
  if (!answers || typeof answers !== 'object') return undefined
  const scores = []
  for (const value of Object.values(answers)) {
    if (value && typeof value.confidence === 'number' && Number.isFinite(value.confidence)) {
      scores.push(value.confidence)
    }
  }
  if (!scores.length) return undefined
  return Math.min(...scores)
}

async function askLayaHttp({ state, questions, model, apiKey, baseUrl }) {
  const root = String(baseUrl || process.env.LAYA_BASE_URL || '').replace(/\/$/, '')
  if (!root) throw new Error('LAYA_BASE_URL is not configured')
  const headers = { 'content-type': 'application/json', accept: 'application/json' }
  const key = apiKey || process.env.LAYA_API_KEY
  if (key) headers.authorization = `Bearer ${key}`

  const response = await fetch(`${root}/v1/system_one`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ state, questions, model: model || layaModel() }),
    signal: AbortSignal.timeout(layaTimeoutMs()),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const err = new Error(`Laya HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`)
    err.status = response.status
    throw err
  }
  return response.json()
}

async function loadOnnxAgent() {
  if (onnxAgent) return onnxAgent
  if (onnxLoadPromise) return onnxLoadPromise
  onnxLoadPromise = (async () => {
    const mod = await import('@receptron/laya')
    const Laya = mod.Laya || mod.default?.Laya || mod.default
    if (!Laya?.load) throw new Error('@receptron/laya is not installed (npm i @receptron/laya)')
    const opts = {}
    if (process.env.LAYA_MODEL_DIR) opts.modelDir = process.env.LAYA_MODEL_DIR
    if (process.env.LAYA_CACHE) opts.cacheDir = process.env.LAYA_CACHE
    if (process.env.HF_TOKEN) opts.token = process.env.HF_TOKEN
    onnxAgent = await Laya.load(opts)
    return onnxAgent
  })()
  try {
    return await onnxLoadPromise
  } catch (error) {
    onnxLoadPromise = null
    throw error
  }
}

async function askLayaOnnx({ state, questions }) {
  const agent = await loadOnnxAgent()
  return agent.systemOne(state, questions)
}

export async function defaultAskLaya({ state, questions, model, apiKey, mode } = {}) {
  const resolved = mode || layaMode()
  if (resolved === 'onnx') return askLayaOnnx({ state, questions })
  return askLayaHttp({ state, questions, model, apiKey })
}

/** Open-weight System 1 — one fan-out of typed questions, no prose. */
export const layaAdapter = {
  id: 'laya',
  async decide({ state, questions, model, apiKey, askLaya }) {
    const ask =
      typeof askLaya === 'function'
        ? askLaya
        : (args) => defaultAskLaya({ ...args, apiKey })
    const response = await ask({
      state,
      questions,
      model: model || layaModel(),
    })
    const answers = response.answers || response
    return {
      answers,
      confidence: response.confidence ?? aggregateConfidence(answers),
      model: response.model || model || layaModel(),
    }
  },
  isAvailable() {
    return layaAvailable()
  },
}
