/**
 * LayoutPolicy is the value-independent decision: which widgets, fields, and
 * chart type. applyPolicy fills props from live data; extractPolicy reverse-maps
 * an LLM/heuristic spec so those decisions can be replayed.
 */
import { findRows, getPath, inferShape, rowsFromValue } from './shape.js'
import { DEMO_LOGIN_SOURCE, DEMO_LANDING_SOURCE, DEMO_CHECKOUT_SOURCE, DEMO_PRICING_SOURCE, DEMO_FORM_SOURCE, DEMO_SETTINGS_SOURCE, DEMO_CALENDAR_SOURCE, DEMO_GENERATED_SOURCE } from './demo-payload.js'
import { DEMO_WORKSPACE_SOURCE } from './surface.js'

const MAX_ROWS = 24
const MAX_CHART = 24
const MAX_LIST = 12
const MAX_KV = 30
const MAX_TEXT = 280

function labelize(key) {
  return String(key)
    .replace(/_2m$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isScalarField(field) {
  return Boolean(field && field.type !== 'object' && field.type !== 'array')
}

function isScalarValue(value) {
  return value == null || typeof value !== 'object'
}

export function isTimeLikeKey(key) {
  return /^(time|timestamp|datetime|date|hour|day|month|period)$/i.test(String(key)) || /time/i.test(String(key))
}

export function sampleRows(rows, max = MAX_CHART) {
  if (!Array.isArray(rows) || rows.length <= max) return rows || []
  if (max <= 1) return [rows[rows.length - 1]]
  const last = rows.length - 1
  const out = []
  let prev = -1
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i / (max - 1)) * last)
    if (idx === prev) continue
    out.push(rows[idx])
    prev = idx
  }
  return out
}

export function formatChartLabel(value) {
  const s = String(value ?? '')
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ms = Date.parse(s)
    if (!Number.isNaN(ms)) {
      return new Date(ms).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        hour12: true,
      })
    }
  }
  return s.length > 22 ? `${s.slice(0, 20)}…` : s
}

function formatNum(n) {
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export function isMoneyKey(key) {
  const s = String(key || '')
  return /^(price|total|subtotal|tax|shipping|amount|cost|fee|revenue|aov)$/i.test(s)
    || /(price|amount|total)$/i.test(s)
}

export function formatMoney(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

function displayValue(key, value) {
  if (typeof value === 'number' && isMoneyKey(key)) return formatMoney(value)
  return stringifyValue(value)
}

function findSummaryEntries(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  for (const key of ['totals', 'summary', 'metrics']) {
    const value = data[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const preferred = ['items', 'subtotal', 'shipping', 'tax', 'total']
    const entries = Object.entries(value).filter(([, item]) => item == null || typeof item !== 'object')
    if (entries.length < 2) continue
    entries.sort((a, b) => {
      const ai = preferred.indexOf(String(a[0]).toLowerCase())
      const bi = preferred.indexOf(String(b[0]).toLowerCase())
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    return entries
  }
  return null
}

function inferredTableTitle(shape) {
  const keys = (shape.fields || []).map((field) => String(field.key).toLowerCase())
  if (keys.includes('product') || keys.includes('sku')) return 'Cart'
  if (keys.includes('qty') && keys.some((key) => key.includes('price'))) return 'Cart'
  return 'Records'
}

const GENERIC_TITLES = new Set([
  'Checkout', 'Landing', 'Sign in', 'Data overview', 'Contact', 'Settings',
  'Calendar', 'Pricing', 'Workspace', 'Plans', 'App', 'Studio', 'Tic-tac-toe', 'Game',
])

function brandedName(policy, data, fallback) {
  const title = String(policy?.title || '').trim()
  const store = typeof data?.store === 'string' ? data.store.trim() : ''
  if (title && !GENERIC_TITLES.has(title)) return title
  if (store && !GENERIC_TITLES.has(store)) return store
  return title || store || fallback
}

function policyExclusive(policy) {
  const types = Array.isArray(policy?.componentTypes) ? policy.componentTypes : []
  const exclusive = [
    'login-form',
    'work-stage',
    'landing-page',
    'checkout',
    'pricing',
    'form',
    'settings',
    'calendar',
    'html-block',
  ]
  return exclusive.find((type) => types.includes(type)) || null
}

function wantsLoginForm(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'login-form'
  return String(sourceUrl || '') === DEMO_LOGIN_SOURCE
}

function wantsWorkStage(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'work-stage'
  return String(sourceUrl || '') === DEMO_WORKSPACE_SOURCE
}

function wantsLanding(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'landing-page'
  return String(sourceUrl || '') === DEMO_LANDING_SOURCE
}

function wantsCheckout(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'checkout'
  return String(sourceUrl || '') === DEMO_CHECKOUT_SOURCE
}

function wantsPricing(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'pricing'
  return String(sourceUrl || '') === DEMO_PRICING_SOURCE
}

function wantsForm(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'form'
  return String(sourceUrl || '') === DEMO_FORM_SOURCE
}

function wantsSettings(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'settings'
  return String(sourceUrl || '') === DEMO_SETTINGS_SOURCE
}

function wantsCalendar(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'calendar'
  return String(sourceUrl || '') === DEMO_CALENDAR_SOURCE
}

function wantsHtmlBlock(policy, sourceUrl) {
  const exclusive = policyExclusive(policy)
  if (exclusive) return exclusive === 'html-block'
  return String(sourceUrl || '') === DEMO_GENERATED_SOURCE && Boolean(policy?.html)
}

function hostTitle(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function pageTitle(policy, data, sourceUrl) {
  const store = typeof data?.store === 'string' ? data.store.trim() : ''
  const channel = typeof data?.channel === 'string' ? data.channel.trim() : ''
  if (store && /checkout|cart/i.test(channel)) return `${store} checkout`
  if (store && /workspace/i.test(channel)) return store
  if (store && /sign in|login/i.test(channel)) return store
  if (store && /landing/i.test(channel)) return store
  if (store && /form/i.test(channel)) return store
  if (store && /settings/i.test(channel)) return store
  if (store && /calendar/i.test(channel)) return store
  if (store && /generated/i.test(channel)) return store
  if (store && (!policy?.title || policy.title === 'Data overview')) return store
  if (policy?.title && policy.title !== 'Data overview') return policy.title
  const host = sourceUrl ? hostTitle(sourceUrl) : ''
  return host || 'Dashboard'
}

function pageSummary(policy, data, sourceUrl) {
  if (typeof data?.notice === 'string' && data.notice.trim()) return data.notice.trim()
  const summary = policy?.summary || ''
  const weak = !summary || summary === 'Generated layout' || /^View of /.test(summary)
  if (!weak) return summary
  const host = sourceUrl ? hostTitle(sourceUrl) : ''
  if (host) return `Live data · ${host}`
  return summary || ''
}

function stringifyValue(value) {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function includedKeys(policy, shape) {
  const scalar = (shape.fields || []).filter(isScalarField).map((f) => f.key)
  const listed = Array.isArray(policy.includedFields) ? policy.includedFields.filter(Boolean) : []
  const base = listed.length ? listed : scalar.length ? scalar : (shape.fields || []).map((f) => f.key)
  if (!scalar.length) return base
  return base.filter((key) => scalar.includes(key))
}

function resolveRows(policy, data, shape) {
  const path = policy.rowsPath != null ? policy.rowsPath : shape.rowsPath
  if (path != null) {
    const raw = getPath(data, path)
    const rows = rowsFromValue(raw)
    if (rows) return { rows, rowsPath: path }
  }
  const found = findRows(data)
  return { rows: found.rows, rowsPath: found.rowsPath }
}

export function isIdLikeKey(key) {
  const s = String(key)
  return /^(id|_id|uuid|pk|key|userid)$/i.test(s) || /(_id|Id)$/.test(s)
}

function pickNumericKey(keys, shape, rows) {
  const preferred = (list) => list.find((k) => isMoneyKey(k)) || list.find((k) => !isIdLikeKey(k)) || null
  const numeric = (shape.fields || []).filter((f) => f.numeric).map((f) => f.key)
  const fromKeys = keys.filter((k) => numeric.includes(k))
  if (fromKeys.length) return preferred(fromKeys)
  if (Array.isArray(rows) && rows[0] && typeof rows[0] === 'object') {
    const fromRows = Object.keys(rows[0]).filter((k) => typeof rows[0][k] === 'number')
    if (fromRows.length) return preferred(fromRows)
  }
  return preferred(numeric)
}

function pickStringKey(keys, shape, rows) {
  const strings = new Set(
    (shape.fields || []).filter((f) => f.string).map((f) => f.key),
  )
  const fromKeys = keys.find((k) => strings.has(k))
  if (fromKeys) return fromKeys
  if (Array.isArray(rows) && rows[0] && typeof rows[0] === 'object') {
    return Object.keys(rows[0]).find((k) => typeof rows[0][k] === 'string') || null
  }
  return (shape.fields || []).find((f) => f.string)?.key || null
}

function buildStatGrid(policy, data, shape) {
  const summary = findSummaryEntries(data)
  if (summary) {
    return {
      type: 'stat-grid',
      props: {
        items: summary.slice(0, 5).map(([key, value]) => ({
          label: labelize(key),
          value: displayValue(key, value),
        })),
      },
    }
  }
  const { rows } = resolveRows(policy, data, shape)
  const keys = includedKeys(policy, shape)
  const items = []
  if (Array.isArray(rows) && rows.length) {
    const numericKey = pickNumericKey(keys, shape, rows)
    const nums = numericKey
      ? rows.map((row) => Number(row?.[numericKey])).filter((n) => Number.isFinite(n))
      : []
    if (nums.length) {
      const timeLike = isTimeLikeKey(pickStringKey(keys, shape, rows) || '')
      if (timeLike) {
        items.push({ label: 'High', value: formatNum(Math.max(...nums)), hint: labelize(numericKey) })
        items.push({ label: 'Low', value: formatNum(Math.min(...nums)) })
        items.push({ label: 'Hours', value: String(rows.length) })
      } else {
        items.push({ label: 'Records', value: String(rows.length) })
        items.push({
          label: 'Latest',
          value: formatNum(nums[nums.length - 1]),
          hint: labelize(numericKey),
        })
        items.push({ label: 'Low', value: formatNum(Math.min(...nums)) })
        items.push({ label: 'High', value: formatNum(Math.max(...nums)) })
      }
    } else {
      items.push({ label: 'Records', value: String(rows.length) })
    }
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of keys.slice(0, 6)) {
      if (!(key in data)) continue
      const value = data[key]
      if (typeof value === 'object') continue
      items.push({ label: labelize(key), value: stringifyValue(value) })
    }
  }
  if (!items.length) items.push({ label: 'Records', value: '0' })
  return { type: 'stat-grid', props: { items } }
}

function humanizeColumn(col) {
  const key = col?.key
  const label = col?.label
  if (label && String(label) !== String(key)) return { key, label: String(label) }
  return { key, label: labelize(key) }
}

function buildTable(policy, data, shape) {
  const { rows, rowsPath } = resolveRows(policy, data, shape)
  const keys = includedKeys(policy, shape)
  const allowed = new Set(keys)
  const columns = (
    Array.isArray(policy.columns) && policy.columns.length
      ? policy.columns
      : keys.map((key) => ({ key, label: labelize(key) }))
  )
    .map(humanizeColumn)
    .filter((col) => col.key && allowed.has(col.key))
  const cols = columns.length ? columns : keys.map((key) => ({ key, label: labelize(key) }))
  const tableTitle = policy.tableTitle && policy.tableTitle !== 'Records'
    ? policy.tableTitle
    : inferredTableTitle(shape)
  const totalRows = Array.isArray(rows) ? rows.length : 0
  const truncated = totalRows > MAX_ROWS
  return {
    type: 'table',
    title: tableTitle,
    props: {
      columns: cols,
      rows: Array.isArray(rows)
        ? rows.slice(0, MAX_ROWS).map((row) => {
          if (!row || typeof row !== 'object') return row
          const next = { ...row }
          for (const col of cols) {
            if (isMoneyKey(col.key) && typeof next[col.key] === 'number') {
              next[col.key] = formatMoney(next[col.key])
            }
          }
          return next
        })
        : [],
      rowsPath: rowsPath ?? '',
      truncated,
      total: totalRows,
    },
  }
}

function buildChart(policy, data, shape) {
  const { rows } = resolveRows(policy, data, shape)
  const keys = includedKeys(policy, shape)
  const picked = pickNumericKey(keys, shape, rows)
  const fromPolicy = policy.chart?.valueKey && !isIdLikeKey(policy.chart.valueKey)
    ? policy.chart.valueKey
    : null
  const valueKey = (picked && isMoneyKey(picked) ? picked : null) || fromPolicy || picked
  if (!valueKey) return null
  const labelKey = policy.chart?.labelKey || pickStringKey(keys, shape, rows)
  const timeSeries = isTimeLikeKey(labelKey || '')
  const chartType = timeSeries
    ? 'line'
    : policy.chart?.chartType || 'bar'
  const allRows = Array.isArray(rows) ? rows : []
  const slice = sampleRows(allRows, MAX_CHART)
  const truncated = allRows.length > slice.length
  return {
    type: 'chart',
    title: labelize(valueKey),
    props: {
      chartType,
      tooltip: policy.chart?.tooltip !== false,
      values: slice.map((row) => Number(row?.[valueKey]) || 0),
      labels: slice.map((row, i) => formatChartLabel(labelKey ? row?.[labelKey] : i)),
      truncated,
      total: allRows.length,
      sampled: slice.length,
    },
  }
}

function buildList(policy, data, shape) {
  const { rows } = resolveRows(policy, data, shape)
  const keys = includedKeys(policy, shape)
  const titleKey = policy.list?.titleKey || pickStringKey(keys, shape, rows) || keys[0]
  const subtitleKey = policy.list?.subtitleKey || keys.find((k) => k !== titleKey) || null
  const metaKey = policy.list?.metaKey || pickNumericKey(keys, shape, rows)
  const slice = Array.isArray(rows) ? rows.slice(0, MAX_LIST) : []
  return {
    type: 'list',
    title: policy.listTitle || 'Items',
    props: {
      items: slice.map((row) => ({
        title: stringifyValue(row?.[titleKey] ?? ''),
        ...(subtitleKey ? { subtitle: stringifyValue(row?.[subtitleKey] ?? '') } : {}),
        ...(metaKey ? { meta: stringifyValue(row?.[metaKey] ?? '') } : {}),
      })),
    },
  }
}

function buildKeyValue(policy, data, shape) {
  const keys = includedKeys(policy, shape)
  let source = data
  if (Array.isArray(data)) source = data[0]
  else {
    const { rows } = resolveRows(policy, data, shape)
    if (rows?.[0]) source = rows[0]
  }
  const entries =
    source && typeof source === 'object' && !Array.isArray(source)
      ? (keys.length ? keys : Object.keys(source))
          .map((key) => [key, source[key]])
          .filter(([, value]) => isScalarValue(value))
      : []
  return {
    type: 'key-value',
    title: policy.kvTitle || 'Details',
    props: {
      pairs: entries.slice(0, MAX_KV).map(([key, value]) => ({
        key,
        value: stringifyValue(value),
      })),
    },
  }
}

function buildText(policy, data, sourceUrl) {
  if (policy.text) {
    return { type: 'text', props: { content: String(policy.text).slice(0, MAX_TEXT) } }
  }
  return {
    type: 'text',
    props: {
      content: sourceUrl ? `Live records from ${sourceUrl}` : 'Generated from the API response.',
    },
  }
}

function buildBadgeRow(policy, data, shape) {
  const { rows } = resolveRows(policy, data, shape)
  const keys = includedKeys(policy, shape)
  const field = policy.badgeField || pickStringKey(keys, shape, rows)
  const values = []
  if (Array.isArray(rows) && field) {
    for (const row of rows) {
      const v = stringifyValue(row?.[field])
      if (v && !values.includes(v)) values.push(v)
      if (values.length >= 12) break
    }
  } else if (Array.isArray(policy.badges)) {
    values.push(...policy.badges)
  }
  return { type: 'badge-row', props: { items: values.length ? values : keys.slice(0, 6) } }
}

function buildAlert(policy) {
  return {
    type: 'alert',
    props: {
      severity: policy.alert?.severity || 'info',
      message: policy.alert?.message || 'Review the generated layout.',
    },
  }
}

function buildActionRow(policy, sourceUrl) {
  const url = policy.actionUrl || sourceUrl
  return {
    type: 'action-row',
    props: {
      actions: [{ label: 'Open source', action: 'link', url: url || '#' }],
    },
  }
}

function fieldInputType(value) {
  const type = String(value || 'text').toLowerCase()
  if (type === 'email' || type === 'password' || type === 'text' || type === 'checkbox') return type
  if (type === 'bool' || type === 'boolean') return 'checkbox'
  return 'text'
}

function requiredFlag(value) {
  if (value === true || value === 'Yes' || value === 'yes') return true
  if (value === false || value === 'No' || value === 'no') return false
  return Boolean(value)
}

function buildLoginForm(policy, data) {
  const brand = brandedName(policy, data, 'Sign in')
  const rows = Array.isArray(data?.items) ? data.items : []
  const fields = rows.length
    ? rows.map((row, i) => ({
        name: String(row.field || row.name || `field${i}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `field${i}`,
        label: String(row.field || row.label || `Field ${i + 1}`),
        type: fieldInputType(row.type),
        required: requiredFlag(row.required),
      }))
    : [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Password', type: 'password', required: true },
      ]
  return {
    type: 'login-form',
    props: {
      brand,
      kicker: 'Account',
      subtitle: typeof data?.notice === 'string' && data.notice.trim()
        ? data.notice.trim()
        : `Sign in to ${brand}`,
      submitLabel: 'Sign in',
      fields,
    },
  }
}

function buildLandingPage(policy, data) {
  const brand = brandedName(policy, data, 'Studio')
  const rows = Array.isArray(data?.items) ? data.items : []
  const sections = rows.length
    ? rows.map((row) => ({
        kind: String(row.block || row.kind || 'block').toLowerCase(),
        copy: String(row.copy || row.title || ''),
        cta: String(row.cta || ''),
      }))
    : [
        { kind: 'hero', copy: `Welcome to ${brand}`, cta: 'Get started' },
        { kind: 'proof', copy: 'Built for teams that ship UI faster.', cta: '' },
      ]
  const hero = sections.find((s) => s.kind === 'hero') || sections[0]
  return {
    type: 'landing-page',
    props: {
      brand,
      kicker: brand,
      headline: hero?.copy || `Welcome to ${brand}`,
      cta: hero?.cta || 'Get started',
      sections: sections.filter((s) => s !== hero),
    },
  }
}

function buildCheckout(policy, data) {
  const brand = brandedName(policy, data, 'Checkout')
  const rows = Array.isArray(data?.items) ? data.items : []
  const lines = rows.map((row) => ({
    product: String(row.product || row.name || 'Item'),
    detail: [row.color, row.size].filter(Boolean).join(' · '),
    qty: Number(row.qty) || 1,
    price: row.price,
  }))
  const totals = data?.totals && typeof data.totals === 'object' ? data.totals : {}
  return {
    type: 'checkout',
    props: {
      brand,
      kicker: 'Checkout',
      subtitle: typeof data?.notice === 'string' ? data.notice : '',
      lines,
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
      },
    },
  }
}

function buildPricing(policy, data) {
  const brand = (typeof data?.store === 'string' && data.store.trim()) || policy?.title || 'Pricing'
  const rows = Array.isArray(data?.items) ? data.items : []
  const plans = rows.map((row, i) => ({
    name: String(row.plan || row.name || `Plan ${i + 1}`),
    price: row.price,
    perks: String(row.perks || row.copy || ''),
    featured: i === 1,
  }))
  return {
    type: 'pricing',
    props: {
      brand,
      kicker: 'Plans',
      subtitle: typeof data?.notice === 'string' ? data.notice : `Plans for ${brand}`,
      plans,
    },
  }
}

function buildForm(policy, data) {
  const brand = (typeof data?.store === 'string' && data.store.trim()) || policy?.title || 'Contact'
  const rows = Array.isArray(data?.items) ? data.items : []
  const fields = rows.length
    ? rows.map((row, i) => ({
        name: String(row.field || row.name || `field${i}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `field${i}`,
        label: String(row.field || row.label || `Field ${i + 1}`),
        type: fieldInputType(row.type),
        required: requiredFlag(row.required),
      }))
    : [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'message', label: 'Message', type: 'text', required: true },
      ]
  return {
    type: 'form',
    props: {
      brand,
      kicker: brand,
      subtitle: typeof data?.notice === 'string' ? data.notice : `Send a note to ${brand}`,
      submitLabel: 'Send',
      fields,
    },
  }
}

function buildSettings(policy, data) {
  const brand = (typeof data?.store === 'string' && data.store.trim()) || policy?.title || 'Settings'
  const rows = Array.isArray(data?.items) ? data.items : []
  const groups = []
  const byGroup = new Map()
  for (const row of rows) {
    const group = String(row.group || 'General')
    if (!byGroup.has(group)) {
      byGroup.set(group, [])
      groups.push(group)
    }
    byGroup.get(group).push({
      name: String(row.field || row.name || 'field')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || 'field',
      label: String(row.field || row.label || 'Field'),
      type: fieldInputType(row.type),
      required: requiredFlag(row.required),
    })
  }
  const sections = groups.length
    ? groups.map((name) => ({ name, fields: byGroup.get(name) || [] }))
    : [
        { name: 'Profile', fields: [{ name: 'display_name', label: 'Display name', type: 'text', required: true }] },
        { name: 'Notifications', fields: [{ name: 'product_emails', label: 'Product emails', type: 'checkbox', required: false }] },
      ]
  return {
    type: 'settings',
    props: {
      brand,
      kicker: 'Account',
      subtitle: typeof data?.notice === 'string' ? data.notice : 'Manage your account.',
      sections,
    },
  }
}

function buildCalendar(policy, data) {
  const title =
    (typeof data?.store === 'string' && data.store.trim())
    || (policy?.title && policy.title !== 'Data overview' ? policy.title : '')
    || 'Calendar'
  const rows = Array.isArray(data?.items) ? data.items : []
  const events = rows.map((row) => ({
    title: String(row.title || row.name || 'Event'),
    when: String(row.subtitle || row.when || ''),
    duration: String(row.meta || row.duration || ''),
  }))
  return {
    type: 'calendar',
    props: {
      title,
      kicker: 'Week',
      subtitle: typeof data?.notice === 'string' ? data.notice : '',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      events,
    },
  }
}

function buildHtmlBlock(policy, data) {
  const title = brandedName(policy, data, 'Widget')
  return {
    type: 'html-block',
    props: {
      title,
      kicker: policy?.kicker || 'Generated',
      subtitle: typeof data?.notice === 'string' ? data.notice : '',
      html: String(policy?.html || ''),
      css: String(policy?.css || ''),
      script: String(policy?.script || ''),
    },
  }
}

function buildWorkStage(policy, data) {
  const title =
    (typeof data?.store === 'string' && data.store.trim())
    || (policy?.title && policy.title !== 'Data overview' ? policy.title : '')
    || 'Workspace'
  const mode = data?.mode === 'map' || policy?.stageMode === 'map' ? 'map' : 'board'
  const tools = Array.isArray(data?.tools) && data.tools.length
    ? data.tools.map((tool) => String(tool))
    : (mode === 'map' ? ['select', 'polygon', 'delete'] : ['select', 'note', 'delete'])
  const rows = Array.isArray(data?.items) ? data.items : []
  const layers = rows.map((row) => ({
    name: String(row.title || row.name || row.block || 'Layer'),
    kind: String(row.subtitle || row.kind || row.copy || ''),
    status: String(row.meta || row.status || ''),
  }))
  return {
    type: 'work-stage',
    props: {
      mode,
      title,
      kicker: mode === 'map' ? 'Map layer' : 'Workspace',
      subtitle: typeof data?.notice === 'string' ? data.notice.trim() : '',
      tools,
      layers,
    },
  }
}

const BUILDERS = {
  'stat-grid': buildStatGrid,
  table: buildTable,
  chart: buildChart,
  list: buildList,
  'key-value': buildKeyValue,
  text: buildText,
  'badge-row': buildBadgeRow,
  alert: buildAlert,
  'action-row': buildActionRow,
  'login-form': buildLoginForm,
  'work-stage': buildWorkStage,
  'landing-page': buildLandingPage,
  checkout: buildCheckout,
  pricing: buildPricing,
  form: buildForm,
  settings: buildSettings,
  calendar: buildCalendar,
  'html-block': buildHtmlBlock,
}

export function applyPolicy(policy, data, sourceUrl = '') {
  const shape = inferShape(data)
  const presentation = ['page', 'modal', 'component'].includes(policy?.presentation)
    ? policy.presentation
    : 'page'
  if (wantsLoginForm(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || `Sign in to ${data?.store || 'your account'}`,
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'auth',
      components: [buildLoginForm(policy, data)],
    }
  }
  if (wantsLanding(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Landing',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'landing',
      components: [buildLandingPage(policy, data)],
    }
  }
  if (wantsCheckout(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Checkout',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'checkout',
      components: [buildCheckout(policy, data)],
    }
  }
  if (wantsPricing(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Pricing',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'pricing',
      components: [buildPricing(policy, data)],
    }
  }
  if (wantsForm(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Form',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'form',
      components: [buildForm(policy, data)],
    }
  }
  if (wantsSettings(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Settings',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'settings',
      components: [buildSettings(policy, data)],
    }
  }
  if (wantsHtmlBlock(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Generated from your prompt.',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'generated',
      components: [buildHtmlBlock(policy, data)],
    }
  }
  if (wantsCalendar(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Calendar',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'calendar',
      components: [buildCalendar(policy, data)],
    }
  }
  if (wantsWorkStage(policy, sourceUrl)) {
    return {
      title: pageTitle(policy, data, sourceUrl),
      summary: pageSummary(policy, data, sourceUrl) || 'Workspace',
      presentation,
      motion: policy?.motion || 'none',
      look: policy?.look === 'vivid' ? 'vivid' : 'default',
      radius: policy?.radius || '',
      drawer: false,
      shell: 'workspace',
      components: [buildWorkStage(policy, data)],
    }
  }
  const types = Array.isArray(policy?.componentTypes) && policy.componentTypes.length
    ? policy.componentTypes
    : defaultComponentTypes(shape)

  const RANK = {
    'login-form': 0,
    form: 0,
    settings: 0,
    calendar: 0,
    'landing-page': 0,
    checkout: 0,
    pricing: 0,
    'html-block': 0,
    'work-stage': 0,
    'stat-grid': 1,
    alert: 2,
    chart: 3,
    table: 4,
    list: 5,
    'key-value': 6,
    'badge-row': 7,
    text: 8,
    'action-row': 9,
  }
  const ordered = [...types].sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9))

  const components = ordered
    .map((type) => {
      const builder = BUILDERS[type]
      if (!builder) return null
      if (type === 'text') return builder(policy, data, sourceUrl)
      if (type === 'alert') return builder(policy)
      if (type === 'action-row') return builder(policy, sourceUrl)
      return builder(policy, data, shape)
    })
    .filter(Boolean)

  if (!components.length) {
    components.push(buildText(policy, data, sourceUrl))
  }

  return {
    title: pageTitle(policy, data, sourceUrl),
    summary: pageSummary(policy, data, sourceUrl) || `View of ${sourceUrl || 'endpoint data'}`,
    presentation,
    motion: policy?.motion || 'none',
    look: policy?.look === 'vivid' ? 'vivid' : 'default',
    radius: policy?.radius || '',
    drawer: Boolean(policy?.drawer),
    components,
  }
}

export function defaultComponentTypes(shape) {
  if (shape.kind === 'array') {
    const types = ['stat-grid', 'table']
    if ((shape.fields || []).some((f) => f.numeric && !isIdLikeKey(f.key))) types.push('chart')
    return types
  }
  if (shape.kind === 'object') return ['key-value']
  return ['text']
}

function matchRowsPath(spec, data) {
  const table = (spec.components || []).find((c) => c.type === 'table')
  if (table?.props?.rowsPath != null && table.props.rowsPath !== undefined) {
    if ('rowsPath' in (table.props || {})) return table.props.rowsPath
  }
  const found = findRows(data)
  return found.rowsPath
}

function inferChartBinding(chartProps, rows) {
  const chartType = chartProps?.chartType || 'bar'
  if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== 'object') {
    return { chartType, valueKey: null, labelKey: null }
  }
  const values = chartProps?.values || []
  const labels = chartProps?.labels || []
  const keys = Object.keys(rows[0])
  const valueKey =
    keys.find((key) =>
      values.length
        ? rows.slice(0, values.length).every((row, i) => Number(row[key]) === Number(values[i]))
        : typeof rows[0][key] === 'number',
    ) || keys.find((key) => typeof rows[0][key] === 'number') || null
  const labelKey =
    keys.find((key) =>
      labels.length
        ? rows.slice(0, labels.length).every((row, i) => String(row[key]) === String(labels[i]))
        : typeof rows[0][key] === 'string',
    ) || keys.find((key) => typeof rows[0][key] === 'string') || null
  return { chartType, valueKey, labelKey }
}

export function extractPolicy(spec, data) {
  const shape = inferShape(data)
  const components = spec?.components || []
  const rowsPath = matchRowsPath({ components }, data)
  const { rows } = rowsPath == null ? { rows: null } : { rows: getPath(data, rowsPath) }
  const rowList = Array.isArray(rows) ? rows : Array.isArray(data) ? data : null

  const table = components.find((c) => c.type === 'table')
  const chart = components.find((c) => c.type === 'chart')
  const list = components.find((c) => c.type === 'list')
  const alert = components.find((c) => c.type === 'alert')
  const action = components.find((c) => c.type === 'action-row')
  const text = components.find((c) => c.type === 'text')
  const badges = components.find((c) => c.type === 'badge-row')
  const kv = components.find((c) => c.type === 'key-value')

  const columns = table?.props?.columns || []
  const chartBinding = inferChartBinding(chart?.props, rowList)
  const included = new Set(columns.map((c) => c.key).filter(Boolean))
  if (chartBinding.valueKey) included.add(chartBinding.valueKey)
  if (chartBinding.labelKey) included.add(chartBinding.labelKey)
  for (const pair of kv?.props?.pairs || []) {
    if (pair?.key) included.add(pair.key)
  }

  const listItem = list?.props?.items?.[0]
  const listBinding = {}
  if (listItem && rowList?.[0]) {
    const sample = rowList[0]
    for (const [key, value] of Object.entries(sample)) {
      if (listItem.title != null && String(value) === String(listItem.title)) listBinding.titleKey = key
      if (listItem.subtitle != null && String(value) === String(listItem.subtitle)) {
        listBinding.subtitleKey = key
      }
      if (listItem.meta != null && String(value) === String(listItem.meta)) listBinding.metaKey = key
    }
  }

  return {
    presentation: spec?.presentation || 'page',
    motion: spec?.motion || 'none',
    look: spec?.look === 'vivid' ? 'vivid' : 'default',
    radius: spec?.radius || '',
    drawer: Boolean(spec?.drawer),
    title: spec?.title || 'Data overview',
    summary: spec?.summary || '',
    componentTypes: components.map((c) => c.type).filter(Boolean),
    includedFields: included.size ? [...included] : (shape.fields || []).map((f) => f.key),
    rowsPath: rowsPath,
    columns,
    tableTitle: table?.title,
    chart: chart
      ? { ...chartBinding, tooltip: chart.props?.tooltip !== false }
      : undefined,
    list: Object.keys(listBinding).length ? listBinding : undefined,
    listTitle: list?.title,
    kvTitle: kv?.title,
    alert: alert
      ? { severity: alert.props?.severity || 'info', message: alert.props?.message || '' }
      : undefined,
    actionUrl: action?.props?.actions?.find((a) => a.action === 'link')?.url,
    text: text?.props?.content,
    badges: badges?.props?.items,
    badgeField: undefined,
    html: components.find((c) => c.type === 'html-block')?.props?.html,
    css: components.find((c) => c.type === 'html-block')?.props?.css,
    script: components.find((c) => c.type === 'html-block')?.props?.script,
    kicker: components.find((c) => c.type === 'html-block')?.props?.kicker,
  }
}
