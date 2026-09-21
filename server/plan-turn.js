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
  promptPayload,
  payloadForDemoSource,
  emptySourceSpec,
  googleMapsKey,
  normalizePack,
  packHash,
  STARTER_PACKS,
  mergeChatHistory,
  sessionGoal,
  effectivePrompt,
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

function looksLikeMissingKey(message) {
  return /add (a )?(typesafe|anthropic) key|no anthropic key configured|no typesafe key/i.test(String(message || ''))
}

function surfaceGenerateError(message, { apiKey } = {}) {
  const raw = String(message || 'Could not generate this UI.').trim()
  const hasAi = Boolean(apiKey || process.env.ANTHROPIC_API_KEY)
  if (hasAi && looksLikeMissingKey(raw)) {
    return 'Haiku could not generate this UI. Try again, or simplify the prompt.'
  }
  if (!hasAi && looksLikeMissingKey(raw)) {
    return 'This UI is not in the catalog. Add an Anthropic key in Settings to generate it from the prompt.'
  }
  if (hasAi && raw) return raw
  return raw || 'Could not generate this UI.'
}

export function plannerLabel(planner, cached) {
  if (cached || planner === 'replay') return 'Replay'
  if (planner === 'iterate') return 'Iterate'
  if (planner === 'catalog') return 'Catalog'
  if (planner === 'generate:missing') return 'Generate failed'
  if (typeof planner === 'string' && planner.startsWith('haiku')) return 'Haiku'
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
  fresh,
  rebuild,
  themePack: themePackInput,
  history: historyInput,
  goal: goalInput,
} = {}) {
  const emit = typeof onEvent === 'function' ? onEvent : () => {}
  const started = Date.now()
  let last = started
  const timings = []
  const thoughts = []
  const think = (thought, extra = {}) => {
    const rec = { thought, elapsedMs: Date.now() - started, ...extra }
    thoughts.push(rec)
    emit('trace', rec)
  }
  const mark = (step, extra = {}) => {
    const now = Date.now()
    const rec = { step, ms: now - last, elapsedMs: now - started, ...extra }
    last = now
    timings.push(rec)
    emit(step, rec)
    return rec
  }

  const prompt = instructions || message || ''
  const skipCache = true
  const session = sessionId ? await loadSessionWidget(sessionId) : null
  const history = rebuild ? [] : mergeChatHistory(session?.history, historyInput)
  const goal = rebuild
    ? String(prompt).slice(0, 500)
    : sessionGoal(goalInput || session?.goal, history, prompt)
  const contextPrompt = rebuild ? prompt : effectivePrompt({ current: prompt, history, goal })
  const iterate = Boolean(!rebuild && session?.policy && isIteratePrompt(prompt))
  const previousPolicy = iterate ? session.policy : null
  const urls = url ? [url] : extractUrls(prompt)
  const bindText = goal && goal !== prompt ? `${goal}\n${prompt}` : prompt
  const liveSession = Boolean(session?.sourceUrl && !isDemoSource(session.sourceUrl))
  let sourceUrl = urls[0] || (iterate && liveSession ? session.sourceUrl : '') || ''
  const themePack = normalizePack(themePackInput || session?.themePack || STARTER_PACKS.studio)
  const packKey = packHash(themePack)

  emit('stage', { stage: 'designing' })
  mark('routed', {
    intent: iterate ? 'iterate' : sourceUrl ? 'fetch_api' : 'create_widget',
    hasUrl: Boolean(sourceUrl),
    iterate,
    fresh: skipCache,
  })
  think(
    rebuild
      ? 'Rebuild: ignore session iterate and fingerprint cache; plan this prompt live.'
      : goal && goal !== prompt
        ? `Remembering the original ask. This turn is a follow-up.`
        : skipCache
          ? 'Live plan: no fingerprint replay.'
          : iterate
            ? 'Follow-up: keep the current widget and apply instruction upgrades.'
            : sourceUrl
              ? `Route: fetch ${sourceUrl}, then plan a layout.`
              : 'No API URL in the message. Bind a prompt fixture, then plan from the catalog.',
  )

  let data = null
  let contentType = 'application/json'
  let bytes = 0
  if (sourceUrl && !isDemoSource(sourceUrl)) {
    emit('stage', { stage: 'fetching' })
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
    think(`Fetched ${bytes} bytes from ${sourceUrl}.`)
  } else if (iterate && liveSession && session?.dataSnapshot) {
    data = session.dataSnapshot
    sourceUrl = sourceUrl || session.sourceUrl || ''
    mark('fetching', { skipped: true, demo: sourceUrl || 'session' })
    think('Follow-up: reused the live session snapshot.')
  } else if (isDemoSource(sourceUrl)) {
    data = payloadForDemoSource(sourceUrl, bindText)
    mark('fetching', { skipped: true, demo: sourceUrl })
    think(`Bound fixture ${sourceUrl} from the conversation.`)
  } else {
    const packed = promptPayload(bindText)
    if (packed) {
      data = packed.data
      sourceUrl = packed.source
      mark('fetching', { skipped: true, demo: sourceUrl })
      think(`Bound fixture ${sourceUrl} from the conversation.`)
    } else {
      mark('fetching', { skipped: true })
      think('No fixture and no URL. Empty-source layout.')
    }
  }

  const designSystem = getDesignSystem(dsId)
  const renderHtml = (spec) => designSystem.render(spec, themePack)
  if (!data) {
    const spec = emptySourceSpec()
    const html = renderHtml(spec)
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
      policy: null,
      html,
      themeId: designSystem.id,
      themePack,
      motion: spec.motion || 'none',
      look: spec.look || 'default',
      sourceUrl: '',
      meta: {
        planner: 'heuristic',
        plannerLabel: 'Heuristic',
        cached: false,
        totalMs: Date.now() - started,
        timings,
        thoughts,
        path: ['heuristic'],
        reason: 'No payload to bind.',
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
  const fp = fingerprint(shape, prompt, designSystem.id, packKey)
  const sHash = shapeHash(shape)
  const cached = iterate || skipCache ? null : await lookupByFingerprint(fp)
  const mongoNeighbor = cached || iterate || skipCache ? null : await neighborPolicy(sHash)
  const neighbors = cached || iterate || skipCache ? [] : await neighborsForShape(sHash)
  if (mongoNeighbor) neighbors.unshift({ policy: mongoNeighbor, replayEligible: true })
  const cachedPolicy = selectReplayPolicy({
    fingerprintPolicy: cached?.policy,
    iterate,
    instructions: prompt,
    shape,
    fresh: skipCache,
  })

  emit('stage', { stage: 'designing' })
  emit('planned', { status: 'start' })
  think(skipCache ? 'Planning a live layout (no fingerprint replay).' : 'Planning the layout from the bound data.')
  const planned = await planUI({
    data,
    sourceUrl: sourceUrl || undefined,
    instructions: contextPrompt,
    designSystem,
    apiKey,
    llmProvider,
    cachedPolicy,
    previousPolicy,
    neighbors,
    typesafeApiKey,
    fresh: skipCache,
    themePack,
    history,
    goal,
    onTrace: (event) => think(event?.thought, { path: event?.path, reason: event?.reason }),
  })

  const path = planned.trace?.path || []
  const reason = planned.trace?.reason || ''
  if (path.length) think(`Path: ${path.join(' → ')}${reason ? `. ${reason}` : ''}`, { path, reason })

  if (planned.planner === 'generate:missing') {
    const msg = surfaceGenerateError(
      planned.spec?.summary
        || (planned.spec?.components || []).find((c) => c.type === 'alert')?.props?.message
        || reason
        || 'Could not generate this UI.',
      { apiKey },
    )
    think(msg)
    mark('planned', {
      planner: planned.planner,
      plannerLabel: 'Generate failed',
      path,
      reason: msg,
    })
    emit('error', { error: msg })
    return {
      componentId: `turn-${randomUUID()}`,
      spec: planned.spec,
      policy: planned.policy,
      html: '',
      error: msg,
      meta: {
        planner: planned.planner,
        plannerLabel: 'Generate failed',
        cached: false,
        totalMs: Date.now() - started,
        timings,
        thoughts,
        path,
        reason: msg,
        fresh: skipCache,
        rebuild: Boolean(rebuild),
      },
    }
  }

  mark('planned', {
    planner: planned.planner,
    plannerLabel: plannerLabel(planned.planner, planned.cached),
    jevConfidence: planned.jevConfidence,
    planMs: planned.latencyMs,
    path,
    reason,
  })

  emit('stage', { stage: 'rendering' })
  const html = renderHtml(planned.spec)
  assertGeneratedHtmlWithinLimit(html)
  mark('render', { htmlBytes: Buffer.byteLength(html) })
  think(`Rendered ${Buffer.byteLength(html)} bytes of HTML.`)
  const mapStage = (planned.spec?.components || []).some(
    (c) => c.type === 'work-stage' && c.props?.mode === 'map',
  )
  if (mapStage) {
    think(
      googleMapsKey()
        ? 'Google Maps JavaScript API with the Drawing library.'
        : 'No server Maps key. The canvas asks for a browser key to load the Maps JavaScript API.',
    )
  }

  const componentId = `turn-${randomUUID()}`
  const resource = createUIResource({
    uri: `ui://endpoint/${componentId}`,
    content: { type: 'rawHtml', htmlString: html },
    encoding: 'text',
  })

  const replayEligible = skipCache ? false : planned.planner !== 'heuristic'
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
    prompt: String(prompt || '').slice(0, 2000),
  })
  await saveSessionWidget(sessionId || componentId, {
    decisionId: componentId,
    spec: planned.spec,
    policy: planned.policy,
    themeId: designSystem.id,
    themePack,
    motion: decision.motion,
    sourceUrl,
    html,
    dataSnapshot: isDemoSource(sourceUrl) ? data : undefined,
    history: mergeChatHistory(history, [{ role: 'user', text: prompt }]),
    goal,
  })

  const payload = {
    ...resource,
    componentId,
    spec: planned.spec,
    policy: planned.policy,
    html,
    themeId: designSystem.id,
    themePack,
    motion: decision.motion,
    look: planned.spec?.look || 'default',
    sourceUrl: sourceUrl && !isDemoSource(sourceUrl) ? sourceUrl : sourceUrl || '',
    meta: {
      planner: planned.planner,
      plannerLabel: plannerLabel(planned.planner, planned.cached),
      cached: Boolean(planned.cached),
      latencyMs: planned.latencyMs,
      totalMs: Date.now() - started,
      timings,
      thoughts,
      path,
      reason,
      fingerprint: fp,
      decisionId: componentId,
      jevConfidence: planned.jevConfidence,
      designSystem: designSystem.id,
      motion: decision.motion,
      fresh: skipCache,
      rebuild: Boolean(rebuild),
      source: sourceUrl && !isDemoSource(sourceUrl) ? { url: sourceUrl, contentType, bytes } : null,
    },
  }
  emit('rendered', payload)
  return payload
}
