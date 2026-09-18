/**
 * AI layer: analyzes fetched data and decides which components from the active
 * design system's catalog to use, producing a UI spec the design system renders.
 *
 * Cascade: cached LayoutPolicy replay → Jev judgments → LLM structured spec →
 * deterministic heuristicPlan.
 */
import { uiSpecSchema } from './schema.js'
import { getLLMAdapter } from './llm/registry.js'
import { inferShape, findRows } from './shape.js'
import { applyPolicy, extractPolicy, isIdLikeKey } from './layout-policy.js'
import { jevAvailable, planWithJev } from './jev/planner.js'
import { llmAdapter } from './decisions/llm.js'
import { isIteratePrompt, mergeIteratePolicy, selectReplayPolicy } from './iterate.js'

export function aiAvailable(provider = process.env.LLM_PROVIDER || 'anthropic') {
  try {
    return getLLMAdapter(provider).isAvailable()
  } catch {
    return false
  }
}

/** Lightweight auth check for a client-supplied key — no completion tokens spent. */
export async function verifyApiKey(apiKey, provider = process.env.LLM_PROVIDER || 'anthropic') {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
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
    return {
      ...c,
      props: {
        columns: c.props.columns,
        rows: Array.isArray(rows) ? rows.slice(0, maxRows) : [],
      },
    }
  })
  return { ...spec, components }
}

const SYSTEM_PROMPT_RULES = [
  'Rules:',
  '- User instructions are the highest priority. If they conflict with a default below, follow the instructions.',
  '- Decide "presentation": use "modal" when the instructions ask for a popup, modal, dialog, overlay, or a single focused widget shown over the page. Use "component" when the instructions ask for just one bare widget/snippet to embed inline with no page chrome. Use "page" (default) for a full dashboard.',
  '- Pick the components that best communicate this specific data: metrics first when aggregates exist, table or list for record sets, chart when there is a meaningful numeric dimension, key-value for a single object.',
  '- Match the number of components to the request: a focused/popup/component ask gets 1 component; a general "show me this data" or dashboard ask gets 2-5 components covering different angles.',
  '- If instructions name specific fields/metrics (e.g. "just show temperature and humidity"), build components from only those fields — ignore the rest of the data.',
  '- If instructions name a specific component (e.g. "as a chart", "as a table", "as a list"), use that component type even if another type would normally fit better.',
  '- Use "alert" for status/warning callouts the instructions ask to highlight (e.g. "warn if stock is low").',
  '- Use "action-row" only when instructions ask for buttons/links/actions (e.g. "add a button to open the source"). action: "link" needs a real url from the data or sourceUrl; action: "notify" shows an in-app message.',
  '- For "table" components do NOT copy row data: provide column definitions plus rowsPath (dot-path to the row array in the data; "" if the root is the array). The server hydrates rows from the original payload.',
  '- For charts, extract real values/labels from the data sample. Never invent data.',
  'Examples of instruction → decision:',
  '- "show this in a popup" → presentation: "modal", 1 component.',
  '- "just show me the temperature" → presentation: "modal", 1 stat-grid with only that value.',
  '- "just show the temperature as a single component" → presentation: "component", 1 stat-grid with only that value, no page chrome.',
  '- "show as a bar chart" → 1 chart component, chartType: "bar", even if a table would otherwise be picked.',
  '- "add a link to view the raw data" → include an action-row with a "link" action pointing at sourceUrl.',
]

async function planWithLlm({ data, sourceUrl, instructions, designSystem, apiKey, llmProvider }) {
  const provider = llmProvider || process.env.LLM_PROVIDER || 'anthropic'
  let adapter
  try {
    adapter = getLLMAdapter(provider)
  } catch {
    return null
  }

  if (!adapter.isAvailable(apiKey)) return null

  const catalog = designSystem.components
    .map((c) => `- ${c.type}: ${c.description}`)
    .join('\n')

  const system = [
    'You are a UI architect inside an MCP UI server. You receive data fetched from an API endpoint and design a UI for it.',
    `You may ONLY use components from the "${designSystem.name}" design system catalog:`,
    catalog,
    ...SYSTEM_PROMPT_RULES,
  ].join('\n')

  const shape = inferShape(data)
  const excerpt = String(instructions || '').slice(0, 800)
  const userContent = [
    `Source endpoint: ${sourceUrl}`,
    excerpt ? `User instructions: ${excerpt}` : null,
    'Data shape (values omitted — never invent records; bind fields from this shape):',
    '```json',
    JSON.stringify(shape),
    '```',
  ]
    .filter(Boolean)
    .join('\n')

  const generated = await adapter.generateStructured({
    apiKey,
    system,
    userContent,
    schema: uiSpecSchema,
    maxTokens: llmAdapter.maxTokens,
  })

  const policy = extractPolicy(generated, data)
  const spec = applyPolicy(policy, data, sourceUrl)
  return { spec, policy, planner: `${adapter.id}:${adapter.model}` }
}

function specHasLiveRecords(spec) {
  for (const component of spec?.components || []) {
    const props = component.props || {}
    if (Array.isArray(props.rows) && props.rows.length) return true
    if (Array.isArray(props.values) && props.values.length) return true
  }
  return false
}

function withPolicy(result, data, extras = {}) {
  let spec = result.spec
  let policy = result.policy || extractPolicy(spec, data)
  const planner = result.planner
  const judged = typeof planner === 'string' && /^(jev:|replay|iterate)/.test(planner)
  if (!judged && findRows(data).rows?.length && !specHasLiveRecords(spec)) {
    spec = heuristicPlan(data, extras.sourceUrl, extras.instructions)
    policy = extractPolicy(spec, data)
  }
  spec = applyPolicy(policy, data, extras.sourceUrl)
  return {
    spec: { ...spec, motion: spec.motion || policy.motion || extras.motion || 'none' },
    policy,
    planner,
    shape: result.shape || inferShape(data),
    cached: Boolean(extras.cached),
    jevConfidence: extras.jevConfidence ?? result.confidence ?? null,
    jevAnswers: extras.jevAnswers ?? result.answers ?? null,
    latencyMs: extras.latencyMs,
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
} = {}) {
  const started = Date.now()
  const done = (result, extras) =>
    withPolicy(result, data, {
      ...extras,
      sourceUrl,
      instructions,
      latencyMs: Date.now() - started,
    })

  const iterate = Boolean(previousPolicy && isIteratePrompt(instructions))
  const replay = selectReplayPolicy({
    fingerprintPolicy: cachedPolicy,
    iterate,
    instructions,
    shape: inferShape(data),
  })

  if (replay) {
    return done(
      {
        spec: applyPolicy(replay, data, sourceUrl),
        policy: replay,
        planner: 'replay',
      },
      { cached: true },
    )
  }

  if (iterate) {
    const policy = mergeIteratePolicy(previousPolicy, null, instructions)
    return done({
      spec: applyPolicy(policy, data, sourceUrl),
      policy,
      planner: 'iterate',
    })
  }

  if (typeof askJev === 'function' || jevAvailable(typesafeApiKey)) {
    try {
      const jev = await planWithJev({
        data,
        sourceUrl,
        instructions,
        designSystem,
        neighbors,
        previousPolicy,
        askJev,
        typesafeApiKey,
      })
      if (jev.ok) {
        return done(jev, { jevConfidence: jev.confidence, jevAnswers: jev.answers })
      }
      const llm = await planWithLlm({
        data,
        sourceUrl,
        instructions,
        designSystem,
        apiKey,
        llmProvider,
      })
      if (llm) {
        return done(llm, { jevConfidence: jev.confidence, jevAnswers: jev.answers })
      }
      return done(
        {
          spec: heuristicPlan(data, sourceUrl, instructions),
          planner: 'heuristic',
        },
        { jevConfidence: jev.confidence, jevAnswers: jev.answers },
      )
    } catch {
      // Fall through to LLM / heuristic when Jev or its SDK is unavailable.
    }
  }

  const llm = await planWithLlm({
    data,
    sourceUrl,
    instructions,
    designSystem,
    apiKey,
    llmProvider,
  })
  if (llm) return done(llm, { cached: false })

  return done({
    spec: heuristicPlan(data, sourceUrl, instructions),
    planner: 'heuristic',
  })
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
    const chart = numericKey
      ? {
          type: 'chart',
          title: numericKey,
          props: {
            chartType: 'bar',
            tooltip: true,
            values: arr.slice(0, 12).map((r) => Number(r[numericKey]) || 0),
            labels: arr.slice(0, 12).map((r, i) => String(labelKey ? r[labelKey] : i)),
          },
        }
      : null
    const table = {
      type: 'table',
      title: 'Records',
      props: {
        columns: keys.map((k) => ({ key: k, label: k })),
        rows: arr.slice(0, 50),
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
