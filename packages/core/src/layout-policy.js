/**
 * LayoutPolicy is the value-independent decision: which widgets, fields, and
 * chart type. applyPolicy fills props from live data; extractPolicy reverse-maps
 * an LLM/heuristic spec so those decisions can be replayed.
 */
import { findRows, getPath, inferShape, rowsFromValue } from './shape.js'

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
  const slice = sampleRows(Array.isArray(rows) ? rows : [], MAX_CHART)
  return {
    type: 'chart',
    title: labelize(valueKey),
    props: {
      chartType,
      tooltip: policy.chart?.tooltip !== false,
      values: slice.map((row) => Number(row?.[valueKey]) || 0),
      labels: slice.map((row, i) => formatChartLabel(labelKey ? row?.[labelKey] : i)),
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
}

export function applyPolicy(policy, data, sourceUrl = '') {
  const shape = inferShape(data)
  const presentation = ['page', 'modal', 'component'].includes(policy?.presentation)
    ? policy.presentation
    : 'page'
  const types = Array.isArray(policy?.componentTypes) && policy.componentTypes.length
    ? policy.componentTypes
    : defaultComponentTypes(shape)

  const RANK = {
    'stat-grid': 0,
    alert: 1,
    chart: 2,
    table: 3,
    list: 4,
    'key-value': 5,
    'badge-row': 6,
    text: 7,
    'action-row': 8,
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
  }
}
