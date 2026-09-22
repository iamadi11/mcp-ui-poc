/**
 * AI layer: Laya or Jev decides look, motion, iterate vs create, and in-catalog.
 * Code hydrates via applyPolicy. An LLM fills copy slots on catalog layouts
 * or generates sanitized HTML when the catalog cannot express the ask.
 *
 * Redis fingerprint replay is off unless fresh === false.
 * Cascade: decision engine → copy slots or HTML generate → catalog/heuristic.
 */
import { getLLMAdapter } from './llm/registry.js'
import { inferShape, findRows } from './shape.js'
import { applyPolicy, extractPolicy, isIdLikeKey, sampleRows } from './layout-policy.js'
import { sanitizeSpecActions } from './sanitize-spec.js'
import { planWithJev } from './jev/planner.js'
import { decisionAvailable, resolveAskDecision } from './decisions/provider.js'
import { isIteratePrompt, mergeIteratePolicy, selectReplayPolicy, applyInstructionUpgrades, isLookMotionOnly } from './iterate.js'
import { DEMO_LOGIN_SOURCE, isLoginIntent, brandFromPrompt, DEMO_LANDING_SOURCE, DEMO_CHECKOUT_SOURCE, DEMO_PRICING_SOURCE, DEMO_FORM_SOURCE, DEMO_SETTINGS_SOURCE, DEMO_CALENDAR_SOURCE, DEMO_GENERATED_SOURCE } from './demo-payload.js'
import { classifySurface, catalogCannotExpress, isProductSurface, DEMO_WORKSPACE_SOURCE } from './surface.js'
import { catalogFromPack, normalizePack } from './design-systems/pack.js'
import { generateUiHtml, generatedPolicy } from './generate-ui.js'
import { composeTurnPrompt, currentTurnText } from './chat-context.js'
import { withUntrustedDataSystem, formatUntrustedShapeBlock } from './untrusted-data.js'

const COPY_SLOT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    kicker: { type: 'string' },
    subtitle: { type: 'string' },
  },
  required: ['title', 'summary'],
  additionalProperties: false,
}

function defaultLlmProvider() {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER
  // Prefer OpenAI-compatible when a local/open base URL is configured.
  if (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return 'gemini'
  return 'anthropic'
}

export function aiAvailable(provider = defaultLlmProvider(), apiKey) {
  try {
    return getLLMAdapter(provider).isAvailable(apiKey)
  } catch {
    return false
  }
}

/** Lightweight auth check for a client-supplied key — no completion tokens spent. */
export async function verifyApiKey(apiKey, provider = defaultLlmProvider()) {
  if (!apiKey && !process.env.OPENAI_BASE_URL) return { valid: false, error: 'No API key provided' }
  return getLLMAdapter(provider).verifyApiKey(apiKey)
}

function getPath(data, path) {
  if (!path) return data
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), data)
}

/** Resolve table rowsPath references against the real (untruncated) data. */
export function hydrateSpec(spec, data, maxRows = 50) {
  const components = (spec.components || []).map((c) => {
    if (c.type !== 'table') return c
    if (!Object.prototype.hasOwnProperty.call(c.props || {}, 'rowsPath')) return c
    const rows = getPath(data, c.props.rowsPath)
    const total = Array.isArray(rows) ? rows.length : 0
    const truncated = total > maxRows
    return {
      ...c,
      props: {
        columns: c.props.columns,
        rows: Array.isArray(rows) ? rows.slice(0, maxRows) : [],
        truncated,
        total,
      },
    }
  })
  return { ...spec, components }
}

async function fillCopySlots({ spec, policy, data, sourceUrl, instructions, apiKey, llmProvider, planner }) {
  const provider = llmProvider || defaultLlmProvider()
  let adapter
  try {
    adapter = getLLMAdapter(provider)
  } catch {
    return null
  }
  if (!adapter.isAvailable(apiKey)) return null
  const excerpt = String(instructions || '').slice(0, 800)
  const first = spec?.components?.[0] || {}
  try {
    const slots = await adapter.generateStructured({
      apiKey,
      system: withUntrustedDataSystem(
        'Fill short UI copy only. Never invent layout, widgets, or data. Keep title under 48 characters.',
      ),
      userContent: [
        excerpt ? `User instructions: ${excerpt}` : null,
        `Current title: ${spec?.title || ''}`,
        `Current summary: ${spec?.summary || ''}`,
        `Component: ${first.type || 'unknown'}`,
        formatUntrustedShapeBlock(inferShape(data)),
      ].filter(Boolean).join('\n'),
      schema: COPY_SLOT_SCHEMA,
      maxTokens: 400,
    })
    const nextSpec = {
      ...spec,
      title: slots.title || spec.title,
      summary: slots.summary || spec.summary,
      components: (spec.components || []).map((c, i) => {
        if (i !== 0) return c
        return {
          ...c,
          props: {
            ...(c.props || {}),
            kicker: slots.kicker || c.props?.kicker,
            subtitle: slots.subtitle || c.props?.subtitle,
          },
        }
      }),
    }
    const nextPolicy = {
      ...policy,
      title: nextSpec.title,
      summary: nextSpec.summary,
    }
    return { spec: applyPolicy(nextPolicy, data, sourceUrl), policy: nextPolicy, planner: planner || `${adapter.id}:${adapter.model}:slots` }
  } catch {
    return null
  }
}

function wantsGeneratedUi(text, sourceUrl, previousPolicy) {
  if (String(sourceUrl || '') === DEMO_GENERATED_SOURCE) return true
  if ((previousPolicy?.componentTypes || []).includes('html-block')) return true
  if (catalogCannotExpress(text)) return true
  return classifySurface(text, sourceUrl).catalog === false
}

function catalogFallbackPolicy(instructions, sourceUrl, data) {
  const text = instructions || ''
  if (catalogCannotExpress(text)) return null
  const surface = classifySurface(text, sourceUrl)
  if (isLoginIntent(text) || String(sourceUrl || '') === DEMO_LOGIN_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['login-form'],
      title: brandFromPrompt(text, typeof data?.store === 'string' ? data.store : 'Sign in'),
    }, text)
  }
  if (surface.kind === 'marketing' || String(sourceUrl || '') === DEMO_LANDING_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['landing-page'],
      title: brandFromPrompt(text, typeof data?.store === 'string' ? data.store : 'Landing'),
    }, text)
  }
  if (surface.main === 'checkout' || String(sourceUrl || '') === DEMO_CHECKOUT_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['checkout'],
      title: brandFromPrompt(text, typeof data?.store === 'string' ? data.store : 'Checkout'),
    }, text)
  }
  if (surface.main === 'pricing' || String(sourceUrl || '') === DEMO_PRICING_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['pricing'],
      title: typeof data?.store === 'string' ? data.store : 'Pricing',
    }, text)
  }
  if (surface.main === 'form' || String(sourceUrl || '') === DEMO_FORM_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['form'],
      title: typeof data?.store === 'string' ? data.store : 'Contact',
    }, text)
  }
  if (surface.main === 'settings' || String(sourceUrl || '') === DEMO_SETTINGS_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['settings'],
      title: typeof data?.store === 'string' ? data.store : 'Settings',
    }, text)
  }
  if (surface.main === 'calendar' || String(sourceUrl || '') === DEMO_CALENDAR_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['calendar'],
      title: typeof data?.store === 'string' ? data.store : 'Calendar',
    }, text)
  }
  if (isProductSurface(surface) || String(sourceUrl || '') === DEMO_WORKSPACE_SOURCE) {
    return applyInstructionUpgrades({
      presentation: 'page',
      motion: 'none',
      componentTypes: ['work-stage'],
      stageMode: surface.main === 'map' || data?.mode === 'map' ? 'map' : 'board',
      title: typeof data?.store === 'string' ? data.store : (surface.title || 'Workspace'),
    }, text)
  }
  return null
}

function specHasLiveRecords(spec) {
  for (const component of spec?.components || []) {
    if (component.type === 'login-form' || component.type === 'work-stage' || component.type === 'landing-page' || component.type === 'checkout' || component.type === 'pricing' || component.type === 'form' || component.type === 'settings' || component.type === 'calendar' || component.type === 'html-block') return true
    const props = component.props || {}
    if (Array.isArray(props.rows) && props.rows.length) return true
    if (Array.isArray(props.values) && props.values.length) return true
    if (Array.isArray(props.fields) && props.fields.length) return true
  }
  return false
}

function withPolicy(result, data, extras = {}) {
  let spec = result.spec
  let policy = result.policy || extractPolicy(spec, data)
  const planner = result.planner
  const judged = typeof planner === 'string' && /^(jev:|replay|iterate|catalog)/.test(planner)
  if (!judged && findRows(data).rows?.length && !specHasLiveRecords(spec)) {
    spec = heuristicPlan(data, extras.sourceUrl, extras.instructions)
    policy = extractPolicy(spec, data)
  }
  spec = sanitizeSpecActions(applyPolicy(policy, data, extras.sourceUrl), {
    data,
    sourceUrl: extras.sourceUrl,
  })
  return {
    spec: { ...spec, motion: spec.motion || policy.motion || extras.motion || 'none' },
    policy,
    planner,
    shape: result.shape || inferShape(data),
    cached: Boolean(extras.cached),
    jevConfidence: extras.jevConfidence ?? result.confidence ?? null,
    jevAnswers: extras.jevAnswers ?? result.answers ?? null,
    latencyMs: extras.latencyMs,
    trace: extras.trace || result.trace || null,
  }
}

export async function planUI({
  data,
  sourceUrl,
  instructions,
  designSystem,
  apiKey,
  llmProvider,
  cachedPolicy,
  previousPolicy,
  neighbors,
  askJev,
  typesafeApiKey,
  onTrace,
  fresh,
  themePack,
  generateUi,
  history,
  goal,
} = {}) {
  const started = Date.now()
  const think = (thought, extra = {}) => {
    if (typeof onTrace === 'function') onTrace({ thought, ...extra })
  }
  const done = (result, extras) =>
    withPolicy(result, data, {
      ...extras,
      sourceUrl,
      instructions,
      latencyMs: Date.now() - started,
    })

  think(
    fresh === false
      ? 'Cascade: replay identical fingerprints, else Laya/Jev, then LLM generate or copy slots.'
      : 'Live plan: fingerprint replay skipped. Laya or Jev decides this turn.',
  )

  const pack = themePack ? normalizePack(themePack) : null
  const catalogTypes = pack ? catalogFromPack(pack) : undefined
  const sessionFollowUp = Boolean(previousPolicy)
  const turnPrompt = composeTurnPrompt({ current: instructions, history, goal })
  const turnCurrent = currentTurnText(turnPrompt)

  const tryGenerate = async (hints = {}) => {
    const slots = await generateUiHtml({
      instructions: turnPrompt,
      data,
      sourceUrl,
      look: hints.look || previousPolicy?.look,
      motion: hints.motion || previousPolicy?.motion,
      previous: previousPolicy,
      pack,
      apiKey,
      llmProvider,
      generateUi,
      history,
      goal,
    })
    if (slots?.error || !slots?.html?.trim()) {
      return { error: slots?.error || 'Haiku returned empty markup.' }
    }
    const policy = applyInstructionUpgrades(generatedPolicy(slots, {
      motion: hints.motion || previousPolicy?.motion,
      look: hints.look || previousPolicy?.look,
      radius: hints.radius || previousPolicy?.radius,
      summary: typeof data?.notice === 'string' ? data.notice : 'Generated from your prompt.',
    }), turnPrompt)
    return {
      spec: applyPolicy(policy, data, sourceUrl),
      policy,
      planner: 'haiku:generate',
    }
  }

  const failGenerate = (built, extra = {}) => {
    const detail = built?.error || extra.reason
    think(detail || 'Haiku was unavailable. This prompt is not a catalog widget.')
    return done(missingGenerateResult(turnPrompt, data, { error: detail, apiKey, llmProvider }), extra)
  }

  const replay = selectReplayPolicy({
    fingerprintPolicy: cachedPolicy,
    iterate: sessionFollowUp || isIteratePrompt(turnCurrent),
    instructions: turnCurrent,
    shape: inferShape(data),
    fresh,
  })

  if (replay && !sessionFollowUp) {
    think('Fingerprint matched a stored policy. Replaying without a model.')
    return done(
      {
        spec: applyPolicy(replay, data, sourceUrl),
        policy: replay,
        planner: 'replay',
      },
      { cached: true, trace: { path: ['replay'], reason: 'Same prompt fingerprint as a stored decision.' } },
    )
  }

  const decision = resolveAskDecision({ askJev, typesafeApiKey })
  if (decision.ask || typeof askJev === 'function' || decisionAvailable(typesafeApiKey)) {
    const backend = decision.backend === 'injected' ? 'decision' : decision.backend || 'jev'
    think(`Asking ${backend === 'laya' ? 'Laya' : backend === 'jev' ? 'Jev' : 'the decision engine'} which catalog widgets fit this turn.`)
    try {
      const jev = await planWithJev({
        data,
        sourceUrl,
        instructions: turnPrompt,
        designSystem,
        neighbors,
        previousPolicy,
        askJev: decision.ask || askJev,
        typesafeApiKey,
        catalogTypes,
        pack,
        history,
        goal,
      })
      const plannerPrefix = backend === 'laya' ? 'laya' : 'jev'
      if (jev.ok) {
        think(`${backend === 'laya' ? 'Laya' : 'Jev'} decided (${Math.round((jev.confidence || 0) * 100)}% confidence). Hydrating with applyPolicy.`)
        let result = {
          ...jev,
          planner: typeof jev.planner === 'string'
            ? jev.planner.replace(/^jev:/, `${plannerPrefix}:`)
            : `${plannerPrefix}:ok`,
        }
        if (jev.needsCopy) {
          const slots = await fillCopySlots({
            spec: jev.spec,
            policy: jev.policy,
            data,
            sourceUrl,
            instructions: turnPrompt,
            apiKey,
            llmProvider,
            planner: result.planner,
          })
          if (slots) {
            think('LLM filled copy slots on the decided layout.')
            result = { ...result, spec: slots.spec, policy: slots.policy }
          }
        }
        return done(result, {
          jevConfidence: jev.confidence,
          jevAnswers: jev.answers,
          trace: { path: [plannerPrefix, result.planner || plannerPrefix], reason: 'Catalog can express the ask.' },
        })
      }

      const outOfCatalog = jev.generate || wantsGeneratedUi(turnPrompt, sourceUrl, previousPolicy)
      if (outOfCatalog) {
        think(`${backend === 'laya' ? 'Laya' : 'Jev'} routed this out of catalog. LLM is generating the UI.`)
        const built = await tryGenerate(jev.hints)
        if (built?.spec) {
          return done(built, {
            jevConfidence: jev.confidence,
            jevAnswers: jev.answers,
            trace: { path: [plannerPrefix, 'llm'], reason: 'Out of catalog; LLM generated the UI.' },
          })
        }
        return failGenerate(built, {
          jevConfidence: jev.confidence,
          jevAnswers: jev.answers,
          trace: {
            path: [plannerPrefix, 'generate-missing'],
            reason: built?.error || 'LLM generate failed.',
          },
        })
      }

      think(`${backend === 'laya' ? 'Laya' : 'Jev'} is low-confidence. Copy slots on a catalog or heuristic layout.`)
      const fallback = catalogFallbackPolicy(turnPrompt, sourceUrl, data)
      const basePolicy = fallback || extractPolicy(heuristicPlan(data, sourceUrl, turnPrompt), data)
      const baseSpec = applyPolicy(basePolicy, data, sourceUrl)
      const slots = await fillCopySlots({
        spec: baseSpec,
        policy: basePolicy,
        data,
        sourceUrl,
        instructions: turnPrompt,
        apiKey,
        llmProvider,
        planner: fallback ? 'catalog' : 'heuristic',
      })
      if (slots) {
        think('LLM filled copy slots. Layout stayed in catalog code.')
        return done(slots, {
          jevConfidence: jev.confidence,
          jevAnswers: jev.answers,
          trace: { path: [plannerPrefix, 'slots'], reason: 'Copy slots on an already-constructed spec.' },
        })
      }
      return done({
        spec: baseSpec,
        policy: basePolicy,
        planner: fallback ? 'catalog' : 'heuristic',
      }, {
        jevConfidence: jev.confidence,
        jevAnswers: jev.answers,
        trace: { path: [plannerPrefix, fallback ? 'catalog' : 'heuristic'], reason: 'No copy model; constructed layout.' },
      })
    } catch {
      think('Decision engine threw. Falling through to catalog or heuristic.')
    }
  }

  if (previousPolicy && isIteratePrompt(turnCurrent)) {
    const generatedFollowUp = (previousPolicy.componentTypes || []).includes('html-block') && !isLookMotionOnly(turnCurrent)
    if (generatedFollowUp) {
      think('Follow-up on a generated UI. Haiku is revising it.')
      const built = await tryGenerate({ look: previousPolicy.look, motion: previousPolicy.motion })
      if (built?.spec) {
        return done(built, { trace: { path: ['haiku', 'iterate'], reason: 'Haiku revised the generated UI.' } })
      }
    }
    think('No Jev. Follow-up upgrades the current policy in code.')
    const policy = mergeIteratePolicy(previousPolicy, null, turnCurrent)
    return done({
      spec: applyPolicy(policy, data, sourceUrl),
      policy,
      planner: 'iterate',
    }, { trace: { path: ['iterate'], reason: 'No TypeSafe key; instruction upgrades the session widget.' } })
  }

  if (wantsGeneratedUi(turnPrompt, sourceUrl, previousPolicy)) {
    think('Out of catalog. Haiku is generating the UI.')
    const built = await tryGenerate({ look: previousPolicy?.look, motion: previousPolicy?.motion })
    if (built?.spec) {
      return done(built, { trace: { path: ['haiku'], reason: 'Haiku generated the UI.' } })
    }
    return failGenerate(built, {
      trace: { path: ['generate-missing'], reason: built?.error || 'Haiku generate failed.' },
    })
  }

  const fallback = catalogFallbackPolicy(turnPrompt, sourceUrl, data)
  if (fallback) {
    think('No Jev. Constructing a catalog primitive in code.')
    return done({
      spec: applyPolicy(fallback, data, sourceUrl),
      policy: fallback,
      planner: 'catalog',
    }, { trace: { path: ['catalog', fallback.componentTypes[0]], reason: 'No TypeSafe key; catalog fallback.' } })
  }

  think('Heuristic layout from data shape.')
  return done({
    spec: heuristicPlan(data, sourceUrl, turnPrompt),
    planner: 'heuristic',
  }, { trace: { path: ['heuristic'], reason: 'No Jev key.' } })
}

function missingGenerateResult(instructions, data, { error, apiKey, llmProvider } = {}) {
  const title = typeof data?.store === 'string' && data.store.trim() ? data.store : 'Widget'
  const hasKey = Boolean(apiKey) || aiAvailable(llmProvider)
  const message = hasKey
    ? (error || 'Couldn’t generate this UI. Try again.')
    : 'This UI is not in the catalog. Add an Anthropic key in Settings to generate it from the prompt.'
  return {
    spec: {
      title,
      summary: message,
      presentation: 'page',
      motion: 'none',
      components: [{ type: 'alert', props: { severity: 'info', message } }],
    },
    policy: {
      presentation: 'page',
      motion: 'none',
      title,
      componentTypes: ['alert'],
      alert: { severity: 'info', message },
    },
    planner: 'generate:missing',
  }
}

function scalarKeys(record) {
  return Object.keys(record || {}).filter((key) => {
    const value = record[key]
    return value == null || typeof value !== 'object'
  })
}

function keysFromInstructions(instructions, keys) {
  const text = String(instructions || '').toLowerCase()
  const mentioned = keys.filter((key) => new RegExp(`\\b${key}\\b`, 'i').test(text))
  return mentioned.length ? mentioned : keys
}

function pickNumericKey(keys, record) {
  return keys.find((k) => typeof record[k] === 'number' && !isIdLikeKey(k)) || null
}

/** No-key fallback: deterministic spec from data shape. */
export function heuristicPlan(data, sourceUrl, instructions) {
  const text = instructions || ''
  const fallback = catalogFallbackPolicy(text, sourceUrl, data)
  if (fallback) return applyPolicy(fallback, data, sourceUrl)
  const presentation = /\b(popup|modal|dialog|overlay)\b/i.test(text)
    ? 'modal'
    : 'page'
  const wantChart = /\bchart\b/i.test(text)
  const wantTable = /\btable\b/i.test(text)
  const headlineOnly = /headline metrics/i.test(text)
  const components = []
  const found = findRows(data)
  const arr = found.rows

  if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object') {
    const scalars = scalarKeys(arr[0])
    const named = keysFromInstructions(text, scalars)
    const namedOnly = named.length > 0 && named.length !== scalars.length
    const keys = (namedOnly ? named : (scalars.length ? scalars : Object.keys(arr[0]))).slice(0, 6)
    const numericKey = pickNumericKey(keys, arr[0]) || pickNumericKey(scalars, arr[0]) || null
    const labelKey = keys.find((k) => typeof arr[0][k] === 'string')
      || scalars.find((k) => typeof arr[0][k] === 'string')
    const chartSample = sampleRows(arr, 12)
    const chart = numericKey
      ? {
          type: 'chart',
          title: numericKey,
          props: {
            chartType: 'bar',
            tooltip: true,
            values: chartSample.map((r) => Number(r[numericKey]) || 0),
            labels: chartSample.map((r, i) => String(labelKey ? r[labelKey] : i)),
            truncated: arr.length > chartSample.length,
            total: arr.length,
            sampled: chartSample.length,
          },
        }
      : null
    const table = {
      type: 'table',
      title: 'Records',
      props: {
        columns: keys.map((k) => ({ key: k, label: k })),
        rows: arr.slice(0, 50),
        truncated: arr.length > 50,
        total: arr.length,
      },
    }
    const stats = {
      type: 'stat-grid',
      props: { items: [{ label: 'Records', value: String(arr.length) }] },
    }

    if (headlineOnly) {
      components.push(stats)
    } else if (namedOnly) {
      components.push(table)
    } else if (wantChart && chart) {
      components.push(chart)
    } else if (wantTable) {
      components.push(table)
    } else {
      components.push(stats, table)
      if (chart) components.push(chart)
    }
  } else if (data && typeof data === 'object') {
    components.push({
      type: 'key-value',
      title: 'Details',
      props: {
        pairs: Object.entries(data)
          .slice(0, 30)
          .map(([key, value]) => ({
            key,
            value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
          })),
      },
    })
  } else {
    components.push({ type: 'text', props: { content: String(data).slice(0, 2000) } })
  }

  let host = 'endpoint data'
  try {
    if (sourceUrl) host = new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    host = String(sourceUrl || 'endpoint data').slice(0, 48)
  }

  return {
    title: 'Data overview',
    summary: sourceUrl ? `Live data · ${host}` : 'Generated layout',
    presentation,
    motion: 'none',
    components,
  }
}
