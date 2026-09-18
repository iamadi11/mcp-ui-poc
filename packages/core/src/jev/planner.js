/**
 * Jev planner: one System One request of typed questions, then code builds a
 * LayoutPolicy. Jev never generates spec JSON.
 */
import { inferShape } from '../shape.js'
import { applyPolicy, defaultComponentTypes, isIdLikeKey, isMoneyKey, isTimeLikeKey } from '../layout-policy.js'
import { shouldUseLlm, motionToken, noulValue } from '../decisions/router.js'
import { applyInstructionUpgrades, isIteratePrompt, mergeIteratePolicy } from '../iterate.js'

export const CATALOG_TYPES = [
  'stat-grid',
  'table',
  'list',
  'key-value',
  'chart',
  'text',
  'badge-row',
  'alert',
  'action-row',
]

const INCLUDE_PREFIX = 'include_'
const FIELD_PREFIX = 'field_'
const NOUL_INCLUDE = 0.5

function shortHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return String(url || '').slice(0, 48)
  }
}

function labelizeTitle(key) {
  return String(key)
    .replace(/_2m$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function jevAvailable(apiKey) {
  return Boolean(apiKey || process.env.TYPESAFE_API_KEY)
}

export function jevModel() {
  return process.env.TYPESAFE_MODEL || 'jev-1.13.0'
}

export function jevMinConfidence() {
  const raw = Number.parseFloat(process.env.JEV_MIN_CONFIDENCE || '0.5')
  return Number.isFinite(raw) ? raw : 0.5
}

function typeId(type) {
  return `${INCLUDE_PREFIX}${type.replace(/-/g, '_')}`
}

export function minChoiceConfidence(answers) {
  let min = 1
  let seen = false
  for (const value of Object.values(answers || {})) {
    if (value && typeof value.confidence === 'number') {
      min = Math.min(min, value.confidence)
      seen = true
    }
  }
  return seen ? min : 0
}

/**
 * Gate on layout questions only. Intent/motion/include_* noul confidence
 * must not drag a catalog-fit turn into Haiku.
 */
export function layoutChoiceConfidence(answers) {
  const a = answers || {}
  const keys = []
  if (typeof a.named_widget?.confidence === 'number') keys.push('named_widget')
  if (typeof a.surface?.confidence === 'number') keys.push('surface')
  else if (typeof a.presentation?.confidence === 'number') keys.push('presentation')
  const wantsChart =
    a.named_widget?.choice === 'chart' || noulValue(a.include_chart, 0) >= NOUL_INCLUDE
  if (wantsChart && typeof a.chart_type?.confidence === 'number') keys.push('chart_type')

  let min = 1
  let seen = false
  for (const key of keys) {
    const c = a[key]?.confidence
    if (typeof c === 'number') {
      min = Math.min(min, c)
      seen = true
    }
  }
  return seen ? min : minChoiceConfidence(answers)
}

export function serializeAnswers(answers) {
  const out = {}
  for (const [key, value] of Object.entries(answers || {})) {
    if (!value || typeof value !== 'object') continue
    out[key] = {
      choice: value.choice,
      noul: value.noul,
      score: value.score,
      confidence: value.confidence,
      probabilities: value.probabilities,
    }
  }
  return out
}

function neighborSummary(neighbors) {
  const list = Array.isArray(neighbors) ? neighbors : []
  const good = []
  const avoid = []
  for (const rec of list) {
    const policy = rec?.policy
    if (!policy) continue
    if (rec.replayEligible === false) avoid.push(policy)
    else good.push(policy)
  }
  return {
    goodLayouts: good.slice(0, 5),
    avoid: avoid.slice(0, 5),
  }
}

function choiceQuestion(instructions, criteria) {
  return { type: 'choice', instructions, criteria }
}

function noulQuestion(instructions) {
  return { type: 'noul', instructions }
}

function scoreQuestion(instructions, criteria) {
  return { type: 'score', instructions, criteria }
}

export function buildJevQuestions(shape) {
  const questions = {
    intent: choiceQuestion(
      'What is the user trying to do this turn? Use `prompt` and `instructions`.',
      {
        create_dashboard: 'Build a multi-widget dashboard from data.',
        create_widget: 'Build a single embeddable widget.',
        iterate: 'Tweak the previous layout, theme, or fields.',
        fetch_api: 'Load or refresh data from an API URL.',
        publish: 'Publish or copy an embed URL.',
        explain: 'Explain the current widget; do not redesign it.',
      },
    ),
    surface: choiceQuestion(
      'Which surface should the widget use?',
      {
        page: 'Full-width dashboard of several widgets.',
        modal: 'A popup, dialog, overlay, or one focused widget over the page.',
        component: 'A single bare widget with no page chrome, for inline embedding.',
      },
    ),
    presentation: choiceQuestion(
      'Which layout matches `instructions`? Choose none_implied if the instructions do not mention layout.',
      {
        page: 'Full-width dashboard of several widgets.',
        modal: 'A popup, dialog, overlay, or one focused widget over the page.',
        component: 'A single bare widget with no page chrome, for inline embedding.',
        none_implied: 'Instructions do not specify a layout; default to a full page dashboard.',
      },
    ),
    density: scoreQuestion('How many widgets should this UI include given `instructions` and `shape`?', [
      'One focused widget only.',
      'A small set of two or three complementary widgets.',
      'A full dashboard of four or five widgets covering different angles.',
    ]),
    named_widget: choiceQuestion(
      'If `instructions` name a specific widget type, which one? Choose none if they do not.',
      {
        none: 'No specific widget is named.',
        table: 'Show as a table.',
        chart: 'Show as a chart.',
        list: 'Show as a list.',
        'stat-grid': 'Show headline metrics.',
        'key-value': 'Show a detail / key-value panel.',
      },
    ),
    chart_type: choiceQuestion(
      'If a chart is used, which type fits `shape` and `instructions`?',
      {
        bar: 'Compare categories or discrete records.',
        line: 'A trend over an ordered axis.',
        pie: 'Parts of a whole.',
      },
    ),
    needs_fetch: noulQuestion('Does this turn require fetching or refreshing an API URL?'),
    needs_motion: noulQuestion('Do the instructions ask for animation, live updates, or staggered entrance?'),
    needs_llm: noulQuestion(
      'High only if a widget type missing from `catalog` is required, or the user wants generated prose. Tables, charts, dashboards, lists, stats, and CSS motion tokens (enter/stagger/live) are in catalog — choose low.',
    ),
    in_catalog: noulQuestion(
      'Can this UI be built from the registered catalog types in `catalog`? Dashboards, tables, charts, and animation tokens are in catalog — choose high.',
    ),
    motion: choiceQuestion('Which motion token should the theme adapter apply in CSS?', {
      none: 'No motion.',
      enter: 'A short fade/slide in for the widget.',
      stagger: 'Children enter in sequence.',
      live: 'Subtle pulse for live/updating data.',
    }),
  }

  for (const type of CATALOG_TYPES) {
    questions[typeId(type)] = noulQuestion(
      `Should the UI include a ${type} component for this data?`,
    )
  }

  const fields = (shape.fields || []).slice(0, 20)
  fields.forEach((field, i) => {
    questions[`${FIELD_PREFIX}${i}`] = noulQuestion(
      `Should the UI include the field \`${field.key}\` (type ${field.type})?`,
    )
  })

  return questions
}

export function answersToPolicy(answers, shape, { instructions, sourceUrl } = {}) {
  let presentation = answers.surface?.choice || answers.presentation?.choice
  if (presentation === 'none_implied' || !['page', 'modal', 'component'].includes(presentation)) {
    presentation = 'page'
  }

  const named = answers.named_widget?.choice
  const types = []
  if (named && named !== 'none' && CATALOG_TYPES.includes(named)) {
    types.push(named)
  }
  for (const type of CATALOG_TYPES) {
    if (types.includes(type)) continue
    const n = answers[typeId(type)]?.noul
    if (typeof n === 'number' && n >= NOUL_INCLUDE) types.push(type)
  }

  const wantsProse = /\b(summary|explain|prose|narrative|copy)\b/i.test(instructions || '')
  let filtered = types.filter((type) => (type === 'text' ? wantsProse : true))
  if (filtered.includes('table')) filtered = filtered.filter((type) => type !== 'list')
  if (filtered.includes('chart')) filtered = filtered.filter((type) => type !== 'key-value')

  const densityScore = typeof answers.density?.score === 'number' ? answers.density.score : 1
  let maxWidgets = densityScore < 0.75 ? 1 : densityScore < 1.75 ? 3 : 4
  if (presentation === 'modal' || presentation === 'component') {
    maxWidgets = Math.min(maxWidgets, 2)
  }
  if (/\b(popup|modal|dialog|overlay)\b/i.test(instructions || '')) {
    presentation = presentation === 'page' ? 'modal' : presentation
    maxWidgets = Math.min(maxWidgets, 2)
  }

  let componentTypes = filtered.slice(0, maxWidgets)
  if (!componentTypes.length) {
    componentTypes = defaultComponentTypes(shape).slice(0, maxWidgets || 3)
  }

  const includedFields = []
  const fields = shape.fields || []
  fields.forEach((field, i) => {
    const n = answers[`${FIELD_PREFIX}${i}`]?.noul
    if (typeof n === 'number' ? n >= NOUL_INCLUDE : true) includedFields.push(field.key)
  })

  const chartTypeChoice = answers.chart_type?.choice
  const numericKey =
    fields.find((f) => f.numeric && isMoneyKey(f.key))?.key ||
    fields.find((f) => f.numeric && !isIdLikeKey(f.key))?.key ||
    null
  if (numericKey && !componentTypes.includes('stat-grid')) {
    componentTypes = ['stat-grid', ...componentTypes.filter((type) => type !== 'stat-grid')].slice(0, Math.max(maxWidgets, 3))
  }

  const stringKey = fields.find((f) => f.string)?.key || null
  const timeSeries = isTimeLikeKey(stringKey || '')
  const chartType = timeSeries
    ? 'line'
    : ['bar', 'line', 'pie'].includes(chartTypeChoice)
      ? chartTypeChoice
      : 'bar'

  let title = 'Data overview'
  if (numericKey) title = labelizeTitle(numericKey)
  else if (sourceUrl) {
    try {
      title = new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      title = 'Data overview'
    }
  }

  return applyInstructionUpgrades({
    presentation,
    motion: motionToken(answers),
    title,
    summary: sourceUrl ? `Live data · ${shortHost(sourceUrl)}` : 'Generated layout',
    componentTypes,
    includedFields: includedFields.length ? includedFields : fields.map((f) => f.key),
    rowsPath: shape.rowsPath,
    columns: (includedFields.length ? includedFields : fields.map((f) => f.key)).map((key) => ({
      key,
      label: key,
    })),
    chart:
      componentTypes.includes('chart')
        ? {
            chartType,
            valueKey: numericKey,
            labelKey: stringKey,
            tooltip: true,
          }
        : undefined,
  }, instructions)
}

async function defaultAskJev({ state, questions, model, apiKey }) {
  const { TypeSafeClient } = await import('@typesafe-ai/sdk')
  const client = new TypeSafeClient({
    apiKey: apiKey || process.env.TYPESAFE_API_KEY,
    defaultModel: model,
  })
  return client.systemOne({ state, questions, model })
}

export async function verifyJevKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
  try {
    const { TypeSafeClient } = await import('@typesafe-ai/sdk')
    const client = new TypeSafeClient({ apiKey })
    const models = await client.models.list()
    const list = Array.isArray(models)
      ? models
      : Array.isArray(models?.data)
        ? models.data
        : Array.isArray(models?.models)
          ? models.models
          : []
    const first = list[0]
    const modelName = first?.name || first?.id || jevModel()
    return { valid: true, model: modelName }
  } catch (error) {
    const status = error?.status
    return { valid: false, error: status === 401 || status === 403 ? 'Invalid API key' : 'Could not verify key' }
  }
}

export async function planWithJev({
  data,
  sourceUrl,
  instructions,
  designSystem,
  neighbors,
  previousPolicy,
  askJev,
  typesafeApiKey,
}) {
  const shape = inferShape(data)
  const model = jevModel()
  const questions = buildJevQuestions(shape)
  const past = neighborSummary(neighbors)
  const iterate = Boolean(previousPolicy && isIteratePrompt(instructions))
  const state = {
    prompt: instructions || '',
    sourceUrl: sourceUrl || '',
    instructions: instructions || '',
    designSystem: designSystem?.id || designSystem?.name || '',
    catalog: (designSystem?.components || []).map((c) => c.type),
    shape,
    previousPolicy: previousPolicy || neighbors?.[0]?.policy || null,
    neighbors: past,
    past,
  }

  const ask =
    typeof askJev === 'function'
      ? askJev
      : (args) => defaultAskJev({ ...args, apiKey: typesafeApiKey || process.env.TYPESAFE_API_KEY })
  const response = await ask({ state, questions, model })
  const answers = response.answers || response
  const confidence = layoutChoiceConfidence(answers)
  const usedModel = response.model || model

  if (shouldUseLlm(answers, confidence) && !iterate) {
    return {
      ok: false,
      confidence,
      answers: serializeAnswers(answers),
      model: usedModel,
    }
  }

  const generated = answersToPolicy(answers, shape, { instructions, sourceUrl })
  const policy = iterate ? mergeIteratePolicy(previousPolicy, generated, instructions) : generated
  const spec = applyPolicy(policy, data, sourceUrl)
  return {
    ok: true,
    spec,
    policy,
    planner: iterate ? 'iterate' : `jev:${usedModel}`,
    confidence,
    answers: serializeAnswers(answers),
    model: usedModel,
    shape,
  }
}
