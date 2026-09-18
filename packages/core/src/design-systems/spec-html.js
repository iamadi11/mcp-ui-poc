/**
 * Shared spec → HTML renderer. Each design system supplies a theme (tokens, fonts,
 * extra CSS); the component markup is shared so every system supports the same
 * catalog the AI planner targets.
 *
 * Component types: stat-grid, table, list, key-value, chart (bar|line|pie),
 * text, badge-row, alert, action-row.
 */
import { formatChartLabel } from '../layout-policy.js'


export const COMPONENT_CATALOG = [
  {
    type: 'stat-grid',
    description: 'Grid of headline metrics. props: { items: [{ label, value, hint? }] }',
  },
  {
    type: 'table',
    description:
      'Tabular records. props: { columns: [{ key, label }], rows: [object] } — rows hold raw values keyed by column key',
  },
  {
    type: 'list',
    description: 'Vertical list of records. props: { items: [{ title, subtitle?, meta? }] }',
  },
  {
    type: 'key-value',
    description: 'Detail panel for one object. props: { pairs: [{ key, value }] }',
  },
  {
    type: 'chart',
    description:
      'Visualization. props: { chartType: "bar"|"line"|"pie", values: [number], labels: [string], tooltip?: boolean }',
  },
  { type: 'text', description: 'Narrative summary paragraph. props: { content }' },
  { type: 'badge-row', description: 'Row of tags/statuses. props: { items: [string] }' },
  {
    type: 'alert',
    description:
      'Status banner. props: { severity: "info"|"success"|"warning"|"error", message }',
  },
  {
    type: 'action-row',
    description:
      'Row of buttons that send an action back to the host. props: { actions: [{ label, action: "link"|"notify", url? (for link), message? (for notify) }] }',
  },
]

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function formatCell(value) {
  if (value == null) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatChartLabel(value)
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map(formatCell).filter(Boolean).join(', ')
  const scalars = Object.values(value).filter((v) => v != null && typeof v !== 'object')
  if (scalars.length) return scalars.map(String).join(', ')
  return JSON.stringify(value)
}

const PALETTE_SIZE = 6

function chartHits(values, labels, xOf, yOf, extra = '') {
  return values
    .map((v, i) => {
      const label = esc(labels[i] ?? i)
      const value = esc(String(v))
      const cx = typeof xOf === 'function' ? xOf(i).toFixed(1) : xOf[i]
      const cy = typeof yOf === 'function' ? yOf(v).toFixed(1) : yOf[i]
      return `<circle class="chart-hit" cx="${cx}" cy="${cy}" r="12" data-label="${label}" data-value="${value}" ${extra}><title>${label}: ${value}</title></circle>`
    })
    .join('')
}

function chartTooltipBox() {
  return '<div class="chart-tooltip" hidden role="tooltip"></div>'
}

function chartSvg(props, theme) {
  const values = (props.values || []).map(Number).filter((n) => Number.isFinite(n))
  const labels = props.labels || []
  if (!values.length) return '<p class="muted">No numeric data for chart.</p>'
  const colors = theme.chartColors
  const stroke = colors[0] || '#0F766E'
  const fill = colors[1] || stroke
  const tooltips = props.tooltip !== false

  if (props.chartType === 'pie') {
    const total = values.reduce((a, b) => a + b, 0) || 1
    let angle = -Math.PI / 2
    const slices = values
      .map((v, i) => {
        const start = angle
        angle += (v / total) * Math.PI * 2
        const large = angle - start > Math.PI ? 1 : 0
        const x1 = 100 + 90 * Math.cos(start)
        const y1 = 100 + 90 * Math.sin(start)
        const x2 = 100 + 90 * Math.cos(angle)
        const y2 = 100 + 90 * Math.sin(angle)
        return `<path d="M100,100 L${x1.toFixed(2)},${y1.toFixed(2)} A90,90 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${colors[i % PALETTE_SIZE]}"/>`
      })
      .join('')
    const legend = values
      .map(
        (v, i) =>
          `<span class="legend-item"><i style="background:${colors[i % PALETTE_SIZE]}"></i>${esc(labels[i] ?? i)} (${v})</span>`,
      )
      .join('')
    return `<div class="chart-wrap"${tooltips ? ' data-chart' : ''}><svg viewBox="0 0 200 200" class="pie">${slices}</svg><div class="legend">${legend}</div>${tooltips ? chartTooltipBox() : ''}</div>`
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  const w = 640
  const h = 200
  const padX = 8
  const padY = 16
  const innerW = w - padX * 2
  const innerH = h - padY * 2
  const yOf = (v) => padY + innerH - ((v - min) / span) * innerH
  const xOf = (i) =>
    values.length === 1 ? w / 2 : padX + (i / (values.length - 1)) * innerW

  const tickIdx = tickIndexes(values.length)
  const ticks = tickIdx
    .map((i) => {
      const x = (xOf(i) / w) * 100
      return `<span style="left:${x.toFixed(2)}%">${esc(labels[i] ?? i)}</span>`
    })
    .join('')

  if (props.chartType === 'line' || values.length > 8) {
    const pts = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
    const line = pts.join(' ')
    const area = `${padX},${h - padY} ${line} ${w - padX},${h - padY}`
    const dots = tooltips
      ? values
          .map(
            (v, i) =>
              `<circle class="chart-dot" cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="3.5" fill="${stroke}"/>`,
          )
          .join('') + chartHits(values, labels, xOf, yOf)
      : ''
    return `<div class="chart-wrap plot"${tooltips ? ' data-chart' : ''}><svg viewBox="0 0 ${w} ${h}" class="line" preserveAspectRatio="none" role="img" aria-label="Chart"><polygon points="${area}" fill="${fill}" opacity="0.18"/><polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg><div class="axis">${ticks}</div>${tooltips ? chartTooltipBox() : ''}</div>`
  }

  const gap = 4
  const barW = innerW / values.length
  const bars = values
    .map((v, i) => {
      const bh = Math.max(4, ((v - min) / span) * innerH)
      const x = padX + i * barW + gap / 2
      const y = padY + innerH - bh
      const label = esc(labels[i] ?? i)
      const value = esc(String(v))
      const title = tooltips ? `<title>${label}: ${value}</title>` : ''
      const data = tooltips ? ` class="chart-hit" data-label="${label}" data-value="${value}"` : ''
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, barW - gap).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${stroke}"${data}>${title}</rect>`
    })
    .join('')
  return `<div class="chart-wrap plot"${tooltips ? ' data-chart' : ''}><svg viewBox="0 0 ${w} ${h}" class="line" preserveAspectRatio="none" role="img" aria-label="Chart">${bars}</svg><div class="axis">${ticks}</div>${tooltips ? chartTooltipBox() : ''}</div>`
}

function tickIndexes(n) {
  if (n <= 4) return [...Array(n).keys()]
  return [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
}

function renderComponent(component, theme, spec = {}) {
  const props = component.props || {}
  switch (component.type) {
    case 'stat-grid': {
      const items = (props.items || [])
        .map(
          (s) =>
            `<div class="stat"><div class="stat-value">${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div>${s.hint ? `<div class="stat-hint">${esc(s.hint)}</div>` : ''}</div>`,
        )
        .join('')
      return `<div class="stat-grid">${items}</div>`
    }
    case 'table': {
      const cols = props.columns || []
      const head = cols.map((c) => `<th>${esc(c.label || c.key)}</th>`).join('')
      const body = (props.rows || [])
        .map((row, index) => {
          const hit = spec?.drawer
            ? ` class="row-hit${index === 0 ? ' is-open' : ''}" tabindex="0" data-insights="${esc(JSON.stringify(row))}"`
            : ''
          const cells = cols
            .map(
              (c) =>
                `<td data-label="${esc(c.label || c.key)}">${esc(formatCell(row?.[c.key]))}</td>`,
            )
            .join('')
          return `<tr${hit}>${cells}</tr>`
        })
        .join('')
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
    }
    case 'list': {
      const items = (props.items || [])
        .map(
          (it) =>
            `<li><div class="li-main"><span class="li-title">${esc(it.title)}</span>${it.subtitle ? `<span class="li-sub">${esc(it.subtitle)}</span>` : ''}</div>${it.meta ? `<span class="li-meta">${esc(it.meta)}</span>` : ''}</li>`,
        )
        .join('')
      return `<ul class="record-list">${items}</ul>`
    }
    case 'key-value': {
      const pairs = (props.pairs || [])
        .map(
          (p) =>
            `<div class="kv-row"><dt>${esc(p.key)}</dt><dd>${esc(typeof p.value === 'object' && p.value !== null ? JSON.stringify(p.value) : p.value)}</dd></div>`,
        )
        .join('')
      return `<dl class="kv">${pairs}</dl>`
    }
    case 'chart':
      return chartSvg(props, theme)
    case 'text':
      return `<p class="narrative">${esc(props.content)}</p>`
    case 'badge-row': {
      const items = (props.items || []).map((b) => `<span class="badge">${esc(b)}</span>`).join('')
      return `<div class="badge-row">${items}</div>`
    }
    case 'alert': {
      const severity = ['info', 'success', 'warning', 'error'].includes(props.severity)
        ? props.severity
        : 'info'
      return `<div class="alert alert--${severity}">${esc(props.message)}</div>`
    }
    case 'action-row': {
      const buttons = (props.actions || [])
        .map((a) => {
          const action =
            a.action === 'notify'
              ? { type: 'notify', payload: { message: a.message ?? a.label } }
              : { type: 'link', payload: { url: a.url ?? '#' } }
          return `<button type="button" class="action-btn" data-action="${esc(JSON.stringify(action))}">${esc(a.label)}</button>`
        })
        .join('')
      return `<div class="action-row">${buttons}</div>`
    }
    default:
      return `<p class="muted">Unsupported component: ${esc(component.type)}</p>`
  }
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0}
body{padding:24px;max-width:960px;margin:0 auto}
.section{margin-bottom:20px}
.section-title{font-size:.95rem;font-weight:600;margin-bottom:10px;opacity:.85}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat-value{font-size:1.6rem;font-weight:700}
.stat-label{font-size:.8rem;opacity:.7;margin-top:2px}
.stat-hint{font-size:.72rem;opacity:.55;margin-top:4px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;font-weight:600;padding:8px 10px}
td{padding:8px 10px}
.record-list{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px}
.record-list li{display:flex;justify-content:space-between;align-items:center;gap:12px}
.li-main{display:flex;flex-direction:column;gap:2px}
.li-title{font-weight:600;font-size:.9rem}
.li-sub{font-size:.78rem;opacity:.65}
.li-meta{font-size:.78rem;opacity:.75;white-space:nowrap}
.kv{display:flex;flex-direction:column;gap:6px}
.kv-row{display:flex;gap:12px;font-size:.85rem}
.kv-row dt{flex:0 0 38%;font-weight:600;opacity:.75}
.kv-row dd{flex:1;word-break:break-word}
.badge-row{display:flex;flex-wrap:wrap;gap:8px}
.chart-wrap{display:flex;flex-direction:column;gap:10px;position:relative}
.chart-wrap.plot{min-height:220px}
.chart-hit{fill:transparent;cursor:crosshair}
.chart-dot{pointer-events:none}
.chart-tooltip{position:absolute;z-index:2;left:12px;top:8px;padding:4px 8px;border-radius:6px;font-size:.75rem;font-weight:500;background:#18181b;color:#fafafa;pointer-events:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.chart-tooltip[hidden]{display:none}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.8rem}
.bar-label{flex:0 0 110px;text-align:right;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:18px;border-radius:9px;overflow:hidden}
.bar{height:100%;border-radius:9px}
.bar-value{flex:0 0 48px;font-weight:600}
svg.pie{max-width:200px}
svg.line{width:100%;height:200px;display:block}
.axis{position:relative;height:28px;font-size:.72rem;opacity:.7;overflow:hidden}
.axis span{position:absolute;transform:translateX(-50%);white-space:nowrap;max-width:28%;overflow:hidden;text-overflow:ellipsis}
.legend{display:flex;flex-wrap:wrap;gap:10px;font-size:.78rem}
.legend-item i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.narrative{font-size:.9rem;line-height:1.55}
.muted{opacity:.6;font-size:.85rem}
h1{font-size:1.35rem;margin-bottom:4px}
.page-sub{font-size:.83rem;opacity:.65;margin-bottom:22px}
.modal-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}
.modal-dialog{width:100%;max-width:480px;max-height:90vh;overflow:auto}
body.modal{padding:0;max-width:none}
.alert{border-radius:8px;padding:10px 14px;font-size:.85rem;border:1px solid transparent}
.alert--info{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}
.alert--success{background:#f0fdf4;border-color:#bbf7d0;color:#14532d}
.alert--warning{background:#fffbeb;border-color:#fde68a;color:#78350f}
.alert--error{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}
@media (prefers-color-scheme: dark){
  .alert--info{background:#1e293b;border-color:#1e3a8a;color:#bfdbfe}
  .alert--success{background:#052e16;border-color:#14532d;color:#bbf7d0}
  .alert--warning{background:#3a2a05;border-color:#78350f;color:#fde68a}
  .alert--error{background:#3f1212;border-color:#7f1d1d;color:#fecaca}
}
.action-row{display:flex;flex-wrap:wrap;gap:8px}
.action-btn{cursor:pointer;border:1px solid currentColor;border-radius:6px;padding:6px 14px;font-size:.82rem;font-weight:500;background:transparent;color:inherit;font-family:inherit}
.action-btn:hover{opacity:.8}
[data-motion="enter"] .section,[data-motion="stagger"] .section{animation:mcp-enter .36s ease both}
[data-motion="stagger"] .section:nth-of-type(1){animation-delay:.05s}
[data-motion="stagger"] .section:nth-of-type(2){animation-delay:.12s}
[data-motion="stagger"] .section:nth-of-type(3){animation-delay:.18s}
[data-motion="stagger"] .section:nth-of-type(4){animation-delay:.24s}
[data-motion="stagger"] .section:nth-of-type(5){animation-delay:.3s}
[data-motion="stagger"] tbody tr{animation:mcp-enter .32s ease both}
[data-motion="stagger"] tbody tr:nth-child(1){animation-delay:.06s}
[data-motion="stagger"] tbody tr:nth-child(2){animation-delay:.1s}
[data-motion="stagger"] tbody tr:nth-child(3){animation-delay:.14s}
[data-motion="stagger"] tbody tr:nth-child(4){animation-delay:.18s}
[data-motion="stagger"] tbody tr:nth-child(5){animation-delay:.22s}
[data-motion="stagger"] tbody tr:nth-child(6){animation-delay:.26s}
[data-motion="stagger"] .stat{animation:mcp-enter .32s ease both}
[data-motion="live"] .stat-value{animation:mcp-live 1.6s ease-in-out infinite}
@keyframes mcp-enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes mcp-live{0%,100%{opacity:1}50%{opacity:.72}}
.dash{display:block}
body[data-drawer] .dash{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,32%);gap:16px;align-items:start}
.insights-drawer{border:1px solid color-mix(in srgb, currentColor 18%, transparent);border-radius:8px;padding:12px 14px;position:sticky;top:12px;min-height:140px}
.insights-drawer h2{font-size:.9rem;margin:0 0 10px;font-weight:600}
.row-hit{cursor:pointer}
.row-hit:hover,.row-hit.is-open{outline:1px solid color-mix(in srgb, currentColor 28%, transparent)}
.row-hit:focus-visible{outline:2px solid #0F766E}
@media (max-width: 720px){
  body{padding:12px;max-width:none}
  .stat-grid{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
  .bar-label{flex-basis:72px}
  body[data-drawer] .dash{grid-template-columns:1fr}
  .insights-drawer{position:fixed;inset:auto 0 0 0;max-height:70vh;overflow:auto;border-radius:12px 12px 0 0;z-index:5;background:inherit;box-shadow:0 -8px 24px rgba(0,0,0,.2)}
  .table-wrap{overflow:visible}
  table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  table, tbody, tr, td{display:block;width:100%}
  tbody tr{border:1px solid color-mix(in srgb, currentColor 16%, transparent);border-radius:8px;padding:8px 10px;margin-bottom:8px}
  td{display:flex;justify-content:space-between;gap:12px;padding:4px 0}
  td::before{content:attr(data-label);font-weight:600;opacity:.7;flex:0 0 42%}
}
@media (prefers-reduced-motion: reduce){
  [data-motion] .section,[data-motion] .stat-value,[data-motion] tbody tr,[data-motion] .stat{animation:none}
}
`

const ACTION_SCRIPT = `
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.action-btn')
  if (!btn) return
  try {
    window.parent.postMessage(JSON.parse(btn.dataset.action), '*')
  } catch {}
})
document.addEventListener('pointerover', function (e) {
  var hit = e.target.closest('.chart-hit')
  if (!hit) return
  var wrap = hit.closest('[data-chart]')
  var tip = wrap && wrap.querySelector('.chart-tooltip')
  if (!tip) return
  tip.hidden = false
  tip.textContent = (hit.getAttribute('data-label') || '') + ': ' + (hit.getAttribute('data-value') || '')
})
document.addEventListener('pointermove', function (e) {
  var wrap = e.target.closest('[data-chart]')
  var tip = wrap && wrap.querySelector('.chart-tooltip')
  if (!tip || tip.hidden) return
  var box = wrap.getBoundingClientRect()
  var x = Math.min(box.width - 8, Math.max(8, e.clientX - box.left + 12))
  var y = Math.max(8, e.clientY - box.top - 28)
  tip.style.left = x + 'px'
  tip.style.top = y + 'px'
})
document.addEventListener('pointerout', function (e) {
  var hit = e.target.closest('.chart-hit')
  if (!hit) return
  var related = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.chart-hit')
  if (related === hit) return
  var tip = hit.closest('[data-chart]') && hit.closest('[data-chart]').querySelector('.chart-tooltip')
  if (tip) tip.hidden = true
})
function flattenRecord(row, prefix) {
  var out = []
  if (!row || typeof row !== 'object') return out
  Object.keys(row).forEach(function (k) {
    var key = prefix ? prefix + '.' + k : k
    var v = row[k]
    if (v && typeof v === 'object' && !Array.isArray(v)) out = out.concat(flattenRecord(v, key))
    else out.push([key, v])
  })
  return out
}
function fillDrawer(row) {
  var body = document.getElementById('insights-body')
  if (!body) return
  var pairs = flattenRecord(row)
  body.innerHTML = pairs.map(function (pair) {
    var val = pair[1] == null ? '' : String(pair[1])
    return '<div class="kv-row"><dt>' + pair[0] + '</dt><dd>' + val.replace(/</g,'') + '</dd></div>'
  }).join('')
}
function openRow(tr) {
  if (!tr || !tr.dataset.insights) return
  document.querySelectorAll('.row-hit.is-open').forEach(function (el) { el.classList.remove('is-open') })
  tr.classList.add('is-open')
  try { fillDrawer(JSON.parse(tr.dataset.insights)) } catch {}
}
document.addEventListener('click', function (e) {
  var tr = e.target.closest('.row-hit')
  if (tr) openRow(tr)
})
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  var tr = e.target.closest('.row-hit')
  if (!tr) return
  e.preventDefault()
  openRow(tr)
})
var firstHit = document.querySelector('.row-hit')
if (firstHit) openRow(firstHit)
`

function bodyAttrs(spec, extraClass = '') {
  const motion = spec?.motion && spec.motion !== 'none' ? spec.motion : ''
  const cls = [extraClass, motion ? `motion-${motion}` : ''].filter(Boolean).join(' ')
  const parts = []
  if (cls) parts.push(`class="${cls}"`)
  if (motion) parts.push(`data-motion="${esc(motion)}"`)
  if (spec?.drawer) parts.push('data-drawer')
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function drawerMarkup(spec) {
  if (!spec?.drawer) return ''
  return `<aside class="insights-drawer card" id="insights-drawer"><h2>Insights</h2><dl class="kv" id="insights-body"><p class="muted">Select a row for more detail.</p></dl></aside>`
}

/** "component" mode: a single bare component, no page chrome — for inline embedding. */
function renderComponentOnly(spec, theme) {
  const first = (spec.components || [])[0]
  const body = first
    ? `<section class="section card">${first.title ? `<div class="section-title">${esc(first.title)}</div>` : ''}${renderComponent(first, theme, spec)}</section>`
    : '<p class="muted">No component to render.</p>'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Component')}</title>
${theme.head || ''}
<style>
*{box-sizing:border-box;margin:0}
body{padding:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}
${BASE_CSS.split('\n').filter((rule) => !/^body\{|^\.modal|^body\.modal/.test(rule)).join('\n')}
${theme.css}
</style>
</head>
<body${bodyAttrs(spec)}>
${body}
<script>${ACTION_SCRIPT}</script>
</body>
</html>`
}

export function renderSpecHtml(spec, theme) {
  if (spec.presentation === 'component') return renderComponentOnly(spec, theme)

  const visible = spec.drawer
    ? (spec.components || []).filter((c) => c.type !== 'key-value')
    : spec.components || []
  const sections = visible
    .map(
      (c) =>
        `<section class="section card">${c.title ? `<div class="section-title">${esc(c.title)}</div>` : ''}${renderComponent(c, theme, spec)}</section>`,
    )
    .join('\n')
  const header = `<header><h1>${esc(spec.title || 'Generated UI')}</h1>${spec.summary ? `<p class="page-sub">${esc(spec.summary)}</p>` : ''}</header>`
  const isModal = spec.presentation === 'modal'
  const main = `${header}\n${sections}`
  const body = isModal
    ? `<div class="modal-backdrop"><div class="modal-dialog">${main}</div></div>`
    : `<div class="dash"><div class="dash-main">${main}</div>${drawerMarkup(spec)}</div>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Generated UI')}</title>
${theme.head || ''}
<style>${BASE_CSS}${theme.css}</style>
</head>
<body${bodyAttrs(spec, isModal ? 'modal' : '')}>
${body}
<script>${ACTION_SCRIPT}</script>
</body>
</html>`
}
