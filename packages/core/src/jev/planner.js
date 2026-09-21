/**
 * Jev planner: one System One request of typed questions, then code builds a
 * LayoutPolicy. Jev never generates spec JSON.
 */
import { inferShape } from '../shape.js'
import { applyPolicy, defaultComponentTypes, isIdLikeKey, isMoneyKey, isTimeLikeKey } from '../layout-policy.js'
import { shouldUseLlm, motionToken, noulValue } from '../decisions/router.js'
import { applyInstructionUpgrades, mergeIteratePolicy, isLookMotionOnly, isIteratePrompt } from '../iterate.js'
import { DEMO_LOGIN_SOURCE, isLoginIntent, isFormIntent, isSettingsIntent, isCalendarIntent, isCheckoutIntent, isLandingIntent, isPricingIntent, brandFromPrompt } from '../demo-payload.js'
import { classifySurface, catalogCannotExpress } from '../surface.js'
import { composeTurnPrompt, currentTurnText } from '../chat-context.js'

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
  'login-form',
  'work-stage',
  'landing-page',
  'checkout',
  'pricing',
  'form',
  'settings',
  'calendar',
]

export const PRODUCT_TYPES = ['login-form', 'work-stage', 'landing-page', 'checkout', 'pricing', 'form', 'settings', 'calendar']

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
  if (typeof a.surface_kind?.confidence === 'number') keys.push('surface_kind')
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

export function buildJevQuestions(shape, { catalogTypes } = {}) {
  const catalog = Array.isArray(catalogTypes) && catalogTypes.length ? catalogTypes : CATALOG_TYPES
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
    surface_kind: choiceQuestion(
      'Which product surface matches `prompt`? Do not pick records for login, maps, landing, checkout, or pricing.',
      {
        records: 'A dashboard of stats, tables, or charts from JSON records.',
        auth: 'A sign-in or login screen.',
        tool: 'A workspace such as a map, board, editor, or generator.',
        marketing: 'A landing or marketing page.',
        commerce: 'Checkout, cart, or pricing plans.',
        unknown: 'None of the catalog primitives fit.',
      },
    ),
    tool_primitive: choiceQuestion(
      'If surface_kind is tool, which primitive? Choose none otherwise.',
      {
        none: 'Not a tool workspace.',
        map: 'Map, polygons, GIS, or Google Maps.',
        board: 'Board, notes, kanban, or generic canvas.',
      },
    ),
    surface: choiceQuestion(
      'Which chrome should the widget use?',
      {
        page: 'Full-width page of several widgets.',
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
      Object.fromEntries(
        [
          ['none', 'No specific widget is named.'],
          ['table', 'Show as a table.'],
          ['chart', 'Show as a chart.'],
          ['list', 'Show as a list.'],
          ['stat-grid', 'Show headline metrics.'],
          ['key-value', 'Show a detail / key-value panel.'],
          ['login-form', 'Show a sign-in / login card.'],
          ['form', 'Show a contact or generic form.'],
          ['settings', 'Show account settings.'],
          ['calendar', 'Show a week calendar.'],
          ['work-stage', 'Show a product workspace (map, editor, generator) — not a records dashboard.'],
          ['landing-page', 'Show a marketing landing page.'],
          ['checkout', 'Show a checkout or cart.'],
          ['pricing', 'Show pricing plans.'],
        ].filter(([id]) => id === 'none' || catalog.includes(id)),
      ),
    ),
    ...(catalog.includes('chart')
      ? {
          chart_type: choiceQuestion(
            'If a chart is used, which type fits `shape` and `instructions`?',
            {
              bar: 'Compare categories or discrete records.',
              line: 'A trend over an ordered axis.',
              pie: 'Parts of a whole.',
            },
          ),
        }
      : {}),
    needs_fetch: noulQuestion('Does this turn require fetching or refreshing an API URL?'),
    needs_motion: noulQuestion('Do the instructions ask for animation, live updates, or staggered entrance?'),
    needs_llm: noulQuestion(
      'High if the UI is not in `catalog` (a game, custom app, or a widget type missing from the list) or the user wants generated prose. Dashboards, tables, charts, login, landing, checkout, pricing, forms, settings, calendars, map/polygon workspaces, and CSS motion tokens are in catalog — choose low for those.',
    ),
    in_catalog: noulQuestion(
      'Can this UI be built from the registered catalog types in `catalog`? Dashboards, tables, charts, login forms, landings, checkout, pricing, forms, settings, calendars, and map/polygon workspaces are in catalog — choose high. Games and one-off apps are not — choose low.',
    ),
    motion: choiceQuestion('Which motion token should the theme adapter apply in CSS?', {
      none: 'No motion.',
      enter: 'A short fade/slide in for the widget.',
      stagger: 'Children enter in sequence.',
      live: 'Subtle pulse for live/updating data.',
    }),
    patch_hide_table: noulQuestion('Should this iterate hide the table or list?'),
    patch_tooltip: noulQuestion('Should charts show a tooltip on hover?'),
    patch_chart_bar: noulQuestion('Should the chart type become bar?'),
    patch_chart_line: noulQuestion('Should the chart type become line?'),
    patch_chart_pie: noulQuestion('Should the chart type become pie?'),
    patch_motion: noulQuestion('Should motion increase (stagger or enter)?'),
    patch_look_vivid: noulQuestion('Should the look become vivid / more colorful? Choose low for radius or rounder-corners-only requests.'),
    patch_drawer: noulQuestion('Should a details drawer open on row select?'),
  }

  for (const type of catalog) {
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

function exclusiveType(kind, named, sourceUrl, instructions) {
  const src = String(sourceUrl || '')
  if (src === 'demo:generated' || named === 'html-block') return null
  if (catalogCannotExpress(instructions)) return null
  if (isCheckoutIntent(instructions)) return 'checkout'
  if (isLandingIntent(instructions)) return 'landing-page'
  if (isPricingIntent(instructions)) return 'pricing'
  if (isFormIntent(instructions)) return 'form'
  if (isSettingsIntent(instructions)) return 'settings'
  if (isCalendarIntent(instructions)) return 'calendar'
  if (isLoginIntent(instructions)) return 'login-form'
  if (named === 'login-form' || src === DEMO_LOGIN_SOURCE) return 'login-form'
  if (named === 'form' || src === 'demo:form') return 'form'
  if (named === 'settings' || src === 'demo:settings') return 'settings'
  if (named === 'calendar' || src === 'demo:calendar') return 'calendar'
  if (kind === 'auth') return 'login-form'
  if (named === 'work-stage' || src === 'demo:workspace') return 'work-stage'
  if (kind === 'tool') return 'work-stage'
  if (kind === 'marketing' || named === 'landing-page' || src === 'demo:landing') return 'landing-page'
  if (named === 'checkout' || src === 'demo:checkout') return 'checkout'
  if (named === 'pricing' || src === 'demo:pricing') return 'pricing'
  if (kind === 'commerce') {
    if (/\bpric/.test(String(instructions || '').toLowerCase())) return 'pricing'
    return 'checkout'
  }
  return null
}

export function applyJevPatches(policy, answers, instructions = '') {
  const next = {
    ...(policy || {}),
    componentTypes: Array.isArray(policy?.componentTypes) ? [...policy.componentTypes] : [],
    chart: policy?.chart ? { ...policy.chart } : undefined,
  }
  if (noulValue(answers?.patch_hide_table, 0) >= NOUL_INCLUDE) {
    next.componentTypes = next.componentTypes.filter((type) => type !== 'table' && type !== 'list')
    if (!next.componentTypes.includes('chart')) next.componentTypes.push('chart')
  }
  if (noulValue(answers?.patch_tooltip, 0) >= NOUL_INCLUDE) {
    next.chart = { ...(next.chart || {}), tooltip: true }
    if (!next.componentTypes.includes('chart')) next.componentTypes.push('chart')
  }
  if (noulValue(answers?.patch_chart_line, 0) >= NOUL_INCLUDE) {
    next.chart = { ...(next.chart || {}), chartType: 'line' }
  } else if (noulValue(answers?.patch_chart_bar, 0) >= NOUL_INCLUDE) {
    next.chart = { ...(next.chart || {}), chartType: 'bar' }
  } else if (noulValue(answers?.patch_chart_pie, 0) >= NOUL_INCLUDE) {
    next.chart = { ...(next.chart || {}), chartType: 'pie' }
  }
  if (noulValue(answers?.patch_motion, 0) >= NOUL_INCLUDE) {
    next.motion = 'stagger'
  }
  if (
    noulValue(answers?.patch_look_vivid, 0) >= NOUL_INCLUDE
    && /\bvivid\b|\bmodern\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b/i.test(String(instructions || ''))
  ) {
    next.look = 'vivid'
    if (!next.motion || next.motion === 'none') next.motion = 'stagger'
  }
  if (noulValue(answers?.patch_drawer, 0) >= NOUL_INCLUDE) {
    next.drawer = true
  }
  return next
}

export function isJevIterate(answers, previousPolicy, instructions = '') {
  if (!previousPolicy) return false
  const intent = answers?.intent?.choice
  if (intent === 'create_dashboard' || intent === 'create_widget' || intent === 'fetch_api') return false
  const named = answers?.named_widget?.choice
  const kind = answers?.surface_kind?.choice
  const nextType = exclusiveType(kind, named, '', instructions)
  const prevType = previousPolicy?.componentTypes?.[0]
  if (nextType && prevType && nextType !== prevType) return false
  if (intent === 'iterate' || intent === 'explain') return true
  const patches = [
    'patch_hide_table',
    'patch_tooltip',
    'patch_chart_bar',
    'patch_chart_line',
    'patch_chart_pie',
    'patch_motion',
    'patch_look_vivid',
    'patch_drawer',
  ]
  return patches.some((id) => noulValue(answers?.[id], 0) >= NOUL_INCLUDE)
}

export function answersToPolicy(answers, shape, { instructions, sourceUrl, catalogTypes } = {}) {
  let presentation = answers.surface?.choice || answers.presentation?.choice
  if (presentation === 'none_implied' || !['page', 'modal', 'component'].includes(presentation)) {
    presentation = 'page'
  }

  const catalog = Array.isArray(catalogTypes) && catalogTypes.length ? catalogTypes : CATALOG_TYPES
  const named = answers.named_widget?.choice
  const kind = answers.surface_kind?.choice
  const exclusiveRaw = exclusiveType(kind, named, sourceUrl, instructions)
  const exclusive = exclusiveRaw && catalog.includes(exclusiveRaw) ? exclusiveRaw : null

  const types = []
  if (named && named !== 'none' && catalog.includes(named)) {
    types.push(named)
  }
  for (const type of catalog) {
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
    componentTypes = defaultComponentTypes(shape).filter((type) => catalog.includes(type)).slice(0, maxWidgets || 3)
  }

  if (exclusive) componentTypes = [exclusive]
  componentTypes = componentTypes.filter((type) => catalog.includes(type))
  if (!componentTypes.length) {
    componentTypes = catalog.slice(0, Math.max(1, maxWidgets || 1))
  }

  const product = PRODUCT_TYPES.includes(componentTypes[0])
  const includedFields = []
  const fields = shape.fields || []
  if (!product) {
    fields.forEach((field, i) => {
      const n = answers[`${FIELD_PREFIX}${i}`]?.noul
      if (typeof n === 'number' ? n >= NOUL_INCLUDE : true) includedFields.push(field.key)
    })
  }

  const chartTypeChoice = answers.chart_type?.choice
  const numericKey =
    fields.find((f) => f.numeric && isMoneyKey(f.key))?.key ||
    fields.find((f) => f.numeric && !isIdLikeKey(f.key))?.key ||
    null
  if (numericKey && !product && !componentTypes.includes('stat-grid')) {
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
  if (exclusive === 'login-form') title = brandFromPrompt(instructions, 'Sign in')
  else if (exclusive === 'work-stage') title = 'Workspace'
  else if (exclusive === 'landing-page') title = brandFromPrompt(instructions, 'Landing')
  else if (exclusive === 'checkout') title = brandFromPrompt(instructions, 'Checkout')
  else if (exclusive === 'pricing') title = brandFromPrompt(instructions, 'Pricing')
  else if (exclusive === 'form') title = brandFromPrompt(instructions, 'Contact')
  else if (exclusive === 'settings') title = brandFromPrompt(instructions, 'Settings')
  else if (exclusive === 'calendar') title = brandFromPrompt(instructions, 'Calendar')
  else if (numericKey) title = labelizeTitle(numericKey)
  else if (sourceUrl) {
    try {
      title = new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      title = 'Data overview'
    }
  }

  const tool = answers.tool_primitive?.choice
  const classified = classifySurface(instructions, sourceUrl)
  const stageMode = exclusive === 'work-stage'
    ? (tool === 'map' || tool === 'board' ? tool : (classified.main === 'map' ? 'map' : 'board'))
    : undefined

  let policy = {
    presentation,
    motion: motionToken(answers),
    title,
    summary: sourceUrl ? `Live data · ${shortHost(sourceUrl)}` : 'Generated layout',
    componentTypes,
    includedFields: includedFields.length ? includedFields : (product ? [] : fields.map((f) => f.key)),
    rowsPath: shape.rowsPath,
    columns: (includedFields.length ? includedFields : fields.map((f) => f.key)).map((key) => ({
      key,
      label: key,
    })),
    stageMode,
    chart:
      !product && componentTypes.includes('chart')
        ? {
            chartType,
            valueKey: numericKey,
            labelKey: stringKey,
            tooltip: true,
          }
        : undefined,
  }
  policy = applyJevPatches(policy, answers, instructions)
  policy.componentTypes = (policy.componentTypes || []).filter((type) => catalog.includes(type))
  if (!policy.componentTypes.length) policy.componentTypes = catalog.slice(0, 1)
  if (!catalog.includes('chart')) policy.chart = undefined
  return applyInstructionUpgrades(policy, instructions)
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
  catalogTypes: catalogOverride,
  pack,
  history,
  goal,
}) {
  const shape = inferShape(data)
  const model = jevModel()
  const catalogTypes = (Array.isArray(catalogOverride) && catalogOverride.length
    ? catalogOverride
    : CATALOG_TYPES).filter(Boolean)
  const questions = buildJevQuestions(shape, { catalogTypes })
  const past = neighborSummary(neighbors)
  const turnPrompt = composeTurnPrompt({ current: instructions, history, goal })
  const turnCurrent = currentTurnText(turnPrompt)
  const state = {
    prompt: turnPrompt,
    sourceUrl: sourceUrl || '',
    instructions: turnPrompt,
    designSystem: designSystem?.id || designSystem?.name || '',
    catalog: catalogTypes.length ? catalogTypes : CATALOG_TYPES,
    pack: pack
      ? { id: pack.id, accent: pack.tokens?.accent, supports: pack.supports }
      : undefined,
    shape,
    previousPolicy: previousPolicy || neighbors?.[0]?.policy || null,
    neighbors: past,
    past,
    goal: goal || '',
    history: Array.isArray(history) ? history.map((turn) => turn.text || turn).filter(Boolean).slice(-8) : [],
  }

  const ask =
    typeof askJev === 'function'
      ? askJev
      : (args) => defaultAskJev({ ...args, apiKey: typesafeApiKey || process.env.TYPESAFE_API_KEY })
  const response = await ask({ state, questions, model })
  const answers = response.answers || response
  const confidence = layoutChoiceConfidence(answers)
  const usedModel = response.model || model
  const iterate = isJevIterate(answers, previousPolicy, turnCurrent)
  const surface = classifySurface(turnPrompt, sourceUrl)
  const previousGenerated = (previousPolicy?.componentTypes || []).includes('html-block')
  const lookMotionOnly = isLookMotionOnly(turnCurrent)
  const unknown = surface.catalog === false || previousGenerated || catalogCannotExpress(turnPrompt)
  const nextExclusive = exclusiveType(surface.kind, answers?.named_widget?.choice, sourceUrl, turnPrompt)
  const prevType = previousPolicy?.componentTypes?.[0]
  const askingAgain = Boolean(previousPolicy)
    && !iterate
    && !lookMotionOnly
    && !isIteratePrompt(turnCurrent)
    && (catalogCannotExpress(turnPrompt) || !nextExclusive || nextExclusive === prevType || prevType === 'html-block')

  if ((unknown || askingAgain) && !lookMotionOnly) {
    const vivid = noulValue(answers?.patch_look_vivid, 0) >= 0.5
      || /\bvivid\b|\bmodern\b|\bcolour(?:ful)?\b|\bcolor(?:ful)?\b/i.test(String(turnCurrent || ''))
    return {
      ok: false,
      generate: true,
      confidence,
      answers: serializeAnswers(answers),
      model: usedModel,
      hints: {
        motion: motionToken(answers),
        look: vivid ? 'vivid' : (previousPolicy?.look || 'default'),
        radius: previousPolicy?.radius || '',
      },
    }
  }

  if (shouldUseLlm(answers, confidence, undefined, { surface }) && !iterate) {
    return {
      ok: false,
      generate: false,
      confidence,
      answers: serializeAnswers(answers),
      model: usedModel,
    }
  }

  const generated = answersToPolicy(answers, shape, { instructions: turnPrompt, sourceUrl, catalogTypes })
  const policy = iterate ? mergeIteratePolicy(previousPolicy, generated, turnCurrent) : generated
  const spec = applyPolicy(policy, data, sourceUrl)
  return {
    ok: true,
    spec,
    policy,
    planner: `jev:${usedModel}`,
    confidence,
    answers: serializeAnswers(answers),
    model: usedModel,
    shape,
    needsCopy: noulValue(answers?.needs_llm, 0) >= 0.5,
  }
}
