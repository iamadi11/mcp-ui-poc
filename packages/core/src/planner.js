/**
 * AI layer: analyzes fetched data and decides which components from the active
 * design system's catalog to use, producing a UI spec the design system renders.
 *
 * Delegates to the LLM adapter registry; falls back to a deterministic heuristic
 * planner when no provider is available.
 */
import { uiSpecSchema } from './schema.js'
import { sampleData } from './sample-data.js'
import { getLLMAdapter } from './llm/registry.js'

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
function hydrateSpec(spec, data, maxRows = 50) {
  const components = (spec.components || []).map((c) => {
    if (c.type !== 'table') return c
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

export async function planUI({ data, sourceUrl, instructions, designSystem, apiKey, llmProvider }) {
  const provider = llmProvider || process.env.LLM_PROVIDER || 'anthropic'
  let adapter
  try {
    adapter = getLLMAdapter(provider)
  } catch {
    return { spec: heuristicPlan(data, sourceUrl, instructions), planner: 'heuristic' }
  }

  if (!adapter.isAvailable(apiKey)) {
    return { spec: heuristicPlan(data, sourceUrl, instructions), planner: 'heuristic' }
  }

  const catalog = designSystem.components
    .map((c) => `- ${c.type}: ${c.description}`)
    .join('\n')

  const system = [
    'You are a UI architect inside an MCP UI server. You receive data fetched from an API endpoint and design a UI for it.',
    `You may ONLY use components from the "${designSystem.name}" design system catalog:`,
    catalog,
    ...SYSTEM_PROMPT_RULES,
  ].join('\n')

  const userContent = [
    `Source endpoint: ${sourceUrl}`,
    instructions ? `User instructions: ${instructions}` : null,
    'Data sample (may be truncated):',
    '```json',
    sampleData(data),
    '```',
  ]
    .filter(Boolean)
    .join('\n')

  const spec = await adapter.generateStructured({
    apiKey,
    system,
    userContent,
    schema: uiSpecSchema,
    maxTokens: 16000,
  })

  return { spec: hydrateSpec(spec, data), planner: `${adapter.id}:${adapter.model}` }
}

/** No-key fallback: deterministic spec from data shape. */
export function heuristicPlan(data, sourceUrl, instructions) {
  const presentation = /\b(popup|modal|dialog|overlay)\b/i.test(instructions || '')
    ? 'modal'
    : 'page'
  const components = []
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data).find(Array.isArray)
      : null

  if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object') {
    const keys = Object.keys(arr[0]).slice(0, 6)
    components.push({
      type: 'stat-grid',
      props: { items: [{ label: 'Records', value: String(arr.length) }] },
    })
    components.push({
      type: 'table',
      title: 'Records',
      props: {
        columns: keys.map((k) => ({ key: k, label: k })),
        rows: arr.slice(0, 50),
      },
    })
    const numericKey = keys.find((k) => typeof arr[0][k] === 'number')
    const labelKey = keys.find((k) => typeof arr[0][k] === 'string')
    if (numericKey) {
      components.push({
        type: 'chart',
        title: numericKey,
        props: {
          chartType: 'bar',
          values: arr.slice(0, 12).map((r) => Number(r[numericKey]) || 0),
          labels: arr.slice(0, 12).map((r, i) => String(labelKey ? r[labelKey] : i)),
        },
      })
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

  return {
    title: 'Data overview',
    summary: `Heuristic view of ${sourceUrl} (set an LLM provider API key for AI-designed layouts)`,
    presentation,
    components,
  }
}
