/**
 * Shared spec → HTML renderer. Each design system supplies a theme (tokens, fonts,
 * extra CSS); the component markup is shared so every system supports the same
 * catalog the AI planner targets.
 *
 * Component types: stat-grid, table, list, key-value, chart (bar|line|pie),
 * text, badge-row.
 */

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
      'Visualization. props: { chartType: "bar"|"line"|"pie", values: [number], labels: [string] }',
  },
  { type: 'text', description: 'Narrative summary paragraph. props: { content }' },
  { type: 'badge-row', description: 'Row of tags/statuses. props: { items: [string] }' },
]

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const PALETTE_SIZE = 6

function chartSvg(props, theme) {
  const values = (props.values || []).map(Number).filter((n) => Number.isFinite(n))
  const labels = props.labels || []
  if (!values.length) return '<p class="muted">No numeric data for chart.</p>'
  const colors = theme.chartColors

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
    return `<div class="chart-wrap"><svg viewBox="0 0 200 200" class="pie">${slices}</svg><div class="legend">${legend}</div></div>`
  }

  const max = Math.max(...values)
  if (props.chartType === 'line') {
    const w = 420
    const h = 160
    const step = values.length > 1 ? w / (values.length - 1) : w
    const pts = values
      .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 10)).toFixed(1)}`)
      .join(' ')
    const ticks = labels
      .map((l, i) => `<span style="left:${((i * step) / w) * 100}%">${esc(l)}</span>`)
      .join('')
    return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" class="line" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${colors[0]}" stroke-width="3" stroke-linecap="round"/></svg><div class="axis">${ticks}</div></div>`
  }

  // bar (default)
  const bars = values
    .map((v, i) => {
      const pct = Math.max(2, (v / max) * 100)
      return `<div class="bar-row"><span class="bar-label">${esc(labels[i] ?? i)}</span><div class="bar-track"><div class="bar" style="width:${pct}%;background:${colors[i % PALETTE_SIZE]}"></div></div><span class="bar-value">${v}</span></div>`
    })
    .join('')
  return `<div class="chart-wrap bars">${bars}</div>`
}

function renderComponent(component, theme) {
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
        .map(
          (row) =>
            `<tr>${cols
              .map((c) => {
                const v = row?.[c.key]
                return `<td>${esc(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)}</td>`
              })
              .join('')}</tr>`,
        )
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
.chart-wrap{display:flex;flex-direction:column;gap:10px}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.8rem}
.bar-label{flex:0 0 110px;text-align:right;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:18px;border-radius:9px;overflow:hidden}
.bar{height:100%;border-radius:9px}
.bar-value{flex:0 0 48px;font-weight:600}
svg.pie{max-width:200px}
svg.line{width:100%;height:160px}
.axis{position:relative;height:18px;font-size:.7rem;opacity:.65}
.axis span{position:absolute;transform:translateX(-50%)}
.legend{display:flex;flex-wrap:wrap;gap:10px;font-size:.78rem}
.legend-item i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px}
.narrative{font-size:.9rem;line-height:1.55}
.muted{opacity:.6;font-size:.85rem}
h1{font-size:1.35rem;margin-bottom:4px}
.page-sub{font-size:.83rem;opacity:.65;margin-bottom:22px}
.modal-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.45)}
.modal-dialog{width:100%;max-width:480px;max-height:90vh;overflow:auto}
body.modal{padding:0;max-width:none}
`

export function renderSpecHtml(spec, theme) {
  const sections = (spec.components || [])
    .map(
      (c) =>
        `<section class="section card">${c.title ? `<div class="section-title">${esc(c.title)}</div>` : ''}${renderComponent(c, theme)}</section>`,
    )
    .join('\n')
  const header = `<header><h1>${esc(spec.title || 'Generated UI')}</h1>${spec.summary ? `<p class="page-sub">${esc(spec.summary)}</p>` : ''}</header>`
  const isModal = spec.presentation === 'modal'
  const body = isModal
    ? `<div class="modal-backdrop"><div class="modal-dialog">${header}${sections}</div></div>`
    : `${header}\n${sections}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Generated UI')}</title>
${theme.head || ''}
<style>${BASE_CSS}${theme.css}</style>
</head>
<body${isModal ? ' class="modal"' : ''}>
${body}
</body>
</html>`
}
