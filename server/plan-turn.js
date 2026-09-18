import { createHash, randomUUID } from 'node:crypto'
import { createUIResource } from '@mcp-ui/server'
import {
  getDesignSystem,
  planUI,
  inferShape,
  fingerprint,
  shapeHash,
  normalizeInstructions,
  isIteratePrompt,
  selectReplayPolicy,
  demoPayload,
  payloadForDemoSource,
  emptySourceSpec,
  DEMO_CHECKOUT_SOURCE,
} from 'ui-compose-kit'
import { fetchEndpointData } from './data-source.js'
import {
  lookupByFingerprint,
  neighborsForShape,
  saveDecision,
  saveSessionWidget,
  loadSessionWidget,
} from './store.js'
import { insertTurn, neighborPolicy } from './mongo.js'
import { assertGeneratedHtmlWithinLimit } from './generated-html-limit.js'

export const URL_RE = /https?:\/\/[^\s<>"']+/gi

export function extractUrls(text) {
  return [...String(text || '').matchAll(URL_RE)].map((m) => m[0].replace(/[.,);]+$/, ''))
}

export function plannerLabel(planner, cached) {
  if (cached || planner === 'replay') return 'Replay'
  if (planner === 'iterate') return 'Iterate'
  if (typeof planner === 'string' && planner.startsWith('jev:')) return 'Jev'
  if (planner === 'heuristic') return 'Heuristic'
  if (planner) return 'LLM'
  return 'Heuristic'
}

function promptHash(instructions) {
  return createHash('sha256').update(normalizeInstructions(instructions)).digest('hex').slice(0, 32)
}

function isDemoSource(url) {
  return String(url || '').startsWith('demo:')
}

export async function planTurn({
  message,
  url,
  method,
  headers,
  body,
  instructions,
  designSystem: dsId,
  llmProvider,
  apiKey,
  typesafeApiKey,
  sessionId,
  onEvent,
} = {}) {
  const emit = typeof onEvent === 'function' ? onEvent : () => {}
  const started = Date.now()
  let last = started
  const timings = []
  const mark = (step, extra = {}) => {
    const now = Date.now()
    const rec = { step, ms: now - last, elapsedMs: now - started, ...extra }
    last = now
    timings.push(rec)
    emit(step, rec)
    return rec
  }

  const prompt = instructions || message || ''
  const session = sessionId ? await loadSessionWidget(sessionId) : null
  const previousPolicy = session?.policy || null
  const iterate = Boolean(previousPolicy && isIteratePrompt(prompt))
  const urls = url ? [url] : extractUrls(prompt)
  let sourceUrl = urls[0] || (iterate ? session?.sourceUrl : '') || ''

  mark('routed', {
    intent: iterate ? 'iterate' : sourceUrl ? 'fetch_api' : 'create_widget',
    hasUrl: Boolean(sourceUrl),
    iterate,
  })

  let data = null
  let contentType = 'application/json'
  let bytes = 0
  if (isDemoSource(sourceUrl)) {
    data = payloadForDemoSource(sourceUrl, prompt)
    mark('fetching', { skipped: true, demo: sourceUrl })
  } else if (sourceUrl) {
    emit('fetching', { status: 'start', url: sourceUrl })
    const fetched = await fetchEndpointData({
      url: sourceUrl,
      method: method || 'GET',
      headers,
      body,
    })
    data = fetched.data
    contentType = fetched.contentType
    bytes = fetched.bytes
    mark('fetching', { url: sourceUrl, bytes, contentType })
  } else {
    const demo = demoPayload(prompt)
    if (demo) {
      data = demo
      sourceUrl = DEMO_CHECKOUT_SOURCE
      mark('fetching', { skipped: true, demo: sourceUrl })
    } else {
      mark('fetching', { skipped: true })
    }
  }

  const designSystem = getDesignSystem(dsId)
  if (!data) {
    const spec = emptySourceSpec()
    const html = designSystem.render(spec)
    assertGeneratedHtmlWithinLimit(html)
    mark('planned', { planner: 'heuristic', plannerLabel: 'Heuristic' })
    mark('render', { htmlBytes: Buffer.byteLength(html) })
    const componentId = `turn-${randomUUID()}`
    const resource = createUIResource({
      uri: `ui://endpoint/${componentId}`,
      content: { type: 'rawHtml', htmlString: html },
      encoding: 'text',
    })
    const payload = {
      ...resource,
      componentId,
      spec,
      html,
      meta: {
        planner: 'heuristic',
        plannerLabel: 'Heuristic',
        cached: false,
        totalMs: Date.now() - started,
        timings,
        decisionId: componentId,
        designSystem: designSystem.id,
        motion: spec.motion || 'none',
        source: null,
      },
    }
    emit('rendered', payload)
    return payload
  }

  const shape = inferShape(data)
  const fp = fingerprint(shape, prompt, designSystem.id)
  const sHash = shapeHash(shape)
  const cached = iterate ? null : await lookupByFingerprint(fp)
  const mongoNeighbor = cached || iterate ? null : await neighborPolicy(sHash)
  const neighbors = cached || iterate ? [] : await neighborsForShape(sHash)
  if (mongoNeighbor) neighbors.unshift({ policy: mongoNeighbor, replayEligible: true })
  const cachedPolicy = selectReplayPolicy({
    fingerprintPolicy: cached?.policy,
    iterate,
    instructions: prompt,
    shape,
  })

  emit('planned', { status: 'start' })
  const planned = await planUI({
    data,
    sourceUrl: sourceUrl || undefined,
    instructions: prompt,
    designSystem,
    apiKey,
    llmProvider,
    cachedPolicy,
    previousPolicy,
    neighbors,
    typesafeApiKey,
  })

  mark('planned', {
    planner: planned.planner,
    plannerLabel: plannerLabel(planned.planner, planned.cached),
    jevConfidence: planned.jevConfidence,
    planMs: planned.latencyMs,
  })

  const html = designSystem.render(planned.spec)
  assertGeneratedHtmlWithinLimit(html)
  mark('render', { htmlBytes: Buffer.byteLength(html) })

  const componentId = `turn-${randomUUID()}`
  const resource = createUIResource({
    uri: `ui://endpoint/${componentId}`,
    content: { type: 'rawHtml', htmlString: html },
    encoding: 'text',
  })

  const replayEligible = planned.planner !== 'heuristic'
  const decision = {
    id: componentId,
    fingerprint: fp,
    shapeHash: sHash,
    shape,
    instructions: prompt,
    designSystem: designSystem.id,
    planner: planned.planner,
    latencyMs: planned.latencyMs,
    jevAnswers: planned.jevAnswers,
    jevConfidence: planned.jevConfidence,
    policy: planned.policy,
    spec: planned.spec,
    motion: planned.spec?.motion || planned.policy?.motion || 'none',
    sourceUrl,
    ratings: [],
    replayEligible,
    createdAt: new Date().toISOString(),
  }
  await saveDecision(decision)
  await insertTurn({
    decisionId: componentId,
    promptHash: promptHash(prompt),
    shape,
    shapeHash: sHash,
    jevAnswers: planned.jevAnswers,
    jevConfidence: planned.jevConfidence,
    planner: planned.planner,
    latencyMs: planned.latencyMs,
    policy: planned.policy,
    themeId: designSystem.id,
    motion: decision.motion,
    sourceUrl,
    sessionId: sessionId || null,
  })
  await saveSessionWidget(sessionId || componentId, {
    decisionId: componentId,
    spec: planned.spec,
    policy: planned.policy,
    themeId: designSystem.id,
    motion: decision.motion,
    sourceUrl,
    html,
  })

  const payload = {
    ...resource,
    componentId,
    spec: planned.spec,
    html,
    meta: {
      planner: planned.planner,
      plannerLabel: plannerLabel(planned.planner, planned.cached),
      cached: Boolean(planned.cached),
      latencyMs: planned.latencyMs,
      totalMs: Date.now() - started,
      timings,
      fingerprint: fp,
      decisionId: componentId,
      jevConfidence: planned.jevConfidence,
      designSystem: designSystem.id,
      motion: decision.motion,
      source: sourceUrl && !isDemoSource(sourceUrl) ? { url: sourceUrl, contentType, bytes } : null,
    },
  }
  emit('rendered', payload)
  return payload
}
