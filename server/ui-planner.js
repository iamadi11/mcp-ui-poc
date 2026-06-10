/**
 * AI layer: analyzes fetched data and decides which components from the active
 * design system's catalog to use, producing a UI spec the design system renders.
 *
 * Uses the Anthropic API (ANTHROPIC_API_KEY) with structured outputs; falls back
 * to a deterministic heuristic planner when no key is configured.
 */
import Anthropic from '@anthropic-ai/sdk'
import { sampleData } from './data-source.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let client = null
function getClient(apiKey) {
  if (apiKey) return new Anthropic({ apiKey })
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
  return client
}

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const statItem = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    value: { type: 'string' },
    hint: { type: 'string' },
  },
  required: ['label', 'value'],
  additionalProperties: false,
}

const componentSchema = {
  anyOf: [
    {
      type: 'object',
      properties: {
        type: { const: 'stat-grid' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: { items: { type: 'array', items: statItem } },
          required: ['items'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'table' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: {
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, label: { type: 'string' } },
                required: ['key', 'label'],
                additionalProperties: false,
              },
            },
            rowsPath: {
              type: 'string',
              description:
                'Dot-path into the fetched data pointing at the array of row objects, e.g. "results" or "" when the root is the array',
            },
          },
          required: ['columns', 'rowsPath'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'list' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  subtitle: { type: 'string' },
                  meta: { type: 'string' },
                },
                required: ['title'],
                additionalProperties: false,
              },
            },
          },
          required: ['items'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'key-value' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: {
            pairs: {
              type: 'array',
              items: {
                type: 'object',
                properties: { key: { type: 'string' }, value: { type: 'string' } },
                required: ['key', 'value'],
                additionalProperties: false,
              },
            },
          },
          required: ['pairs'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'chart' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: {
            chartType: { type: 'string', enum: ['bar', 'line', 'pie'] },
            values: { type: 'array', items: { type: 'number' } },
            labels: { type: 'array', items: { type: 'string' } },
          },
          required: ['chartType', 'values', 'labels'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'text' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: { content: { type: 'string' } },
          required: ['content'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'badge-row' },
        title: { type: 'string' },
        props: {
          type: 'object',
          properties: { items: { type: 'array', items: { type: 'string' } } },
          required: ['items'],
          additionalProperties: false,
        },
      },
      required: ['type', 'props'],
      additionalProperties: false,
    },
  ],
}

const uiSpecSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string', description: 'One-sentence description of what the data shows' },
    components: { type: 'array', items: componentSchema },
  },
  required: ['title', 'summary', 'components'],
  additionalProperties: false,
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

export async function planUI({ data, sourceUrl, instructions, designSystem, apiKey }) {
  const anthropic = getClient(apiKey)
  if (!anthropic) {
    return { spec: heuristicPlan(data, sourceUrl), planner: 'heuristic' }
  }

  const catalog = designSystem.components
    .map((c) => `- ${c.type}: ${c.description}`)
    .join('\n')

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      'You are a UI architect inside an MCP UI server. You receive data fetched from an API endpoint and design a dashboard for it.',
      `You may ONLY use components from the "${designSystem.name}" design system catalog:`,
      catalog,
      'Rules:',
      '- Pick the components that best communicate this specific data: metrics first when aggregates exist, table or list for record sets, chart when there is a meaningful numeric dimension, key-value for a single object.',
      '- For "table" components do NOT copy row data: provide column definitions plus rowsPath (dot-path to the row array in the data; "" if the root is the array). The server hydrates rows from the original payload.',
      '- For charts, extract real values/labels from the data sample. Never invent data.',
      '- Keep it focused: 2-5 components.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Source endpoint: ${sourceUrl}`,
          instructions ? `User instructions: ${instructions}` : null,
          'Data sample (may be truncated):',
          '```json',
          sampleData(data),
          '```',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    output_config: { format: { type: 'json_schema', schema: uiSpecSchema } },
  })

  let spec = response.parsed_output
  if (!spec) {
    const textBlock = response.content.find((b) => b.type === 'text')
    spec = textBlock ? JSON.parse(textBlock.text) : null
  }
  if (!spec) throw new Error('AI planner returned no parseable spec')
  return { spec: hydrateSpec(spec, data), planner: `anthropic:${MODEL}` }
}

/** No-key fallback: deterministic spec from data shape. */
export function heuristicPlan(data, sourceUrl) {
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
    summary: `Heuristic view of ${sourceUrl} (set ANTHROPIC_API_KEY for AI-designed layouts)`,
    components,
  }
}
