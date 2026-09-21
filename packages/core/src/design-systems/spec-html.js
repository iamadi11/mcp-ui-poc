/**
 * Shared spec → HTML renderer. Each design system supplies a theme (tokens, fonts,
 * extra CSS); the component markup is shared so every system supports the same
 * catalog the AI planner targets.
 *
 * Component types: stat-grid, table, list, key-value, chart (bar|line|pie),
 * text, badge-row, alert, action-row, login-form, work-stage.
 */
import { formatChartLabel } from '../layout-policy.js'
import { googleMapsKey } from '../google-maps-key.js'
import { sanitizeCss } from './pack.js'
import { sanitizeGeneratedHtml, sanitizeGeneratedScript } from '../generate-ui.js'
import { isSafeHttpUrl } from '../safe-url.js'


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
  {
    type: 'login-form',
    description:
      'Centered sign-in card. props: { brand, kicker?, subtitle?, submitLabel, fields: [{ name, label, type, required }] }. Never a table of form fields.',
  },
  {
    type: 'work-stage',
    description:
      'Product workspace (not a dashboard). props: { mode: "map"|"board", title, kicker?, subtitle?, tools: [string], layers: [{ name, kind, status }] }. Map mode uses Google Maps JS + Drawing library at render when a Maps key is present.',
  },
  {
    type: 'landing-page',
    description:
      'Marketing landing. props: { brand, kicker?, headline, cta?, sections: [{ kind, copy, cta? }] }.',
  },
  {
    type: 'checkout',
    description:
      'Checkout / cart. props: { brand, kicker?, subtitle?, lines: [{ product, detail?, qty?, price? }], totals? }.',
  },
  {
    type: 'pricing',
    description:
      'Pricing plans. props: { brand, kicker?, subtitle?, plans: [{ name, price, perks?, featured? }] }.',
  },
  {
    type: 'form',
    description:
      'Generic form. props: { brand, kicker?, subtitle?, submitLabel, fields: [{ name, label, type, required }] }.',
  },
  {
    type: 'settings',
    description:
      'Account settings. props: { brand, kicker?, subtitle?, sections: [{ name, fields: [{ name, label, type, required }] }] }.',
  },
  {
    type: 'calendar',
    description:
      'Week calendar. props: { title, kicker?, subtitle?, days: [string], events: [{ title, when, duration }] }.',
  },
  {
    type: 'html-block',
    description:
      'Haiku-generated widget. props: { title, kicker?, subtitle?, html, css?, script? }.',
  },
]

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function brandMark(brand) {
  const parts = String(brand || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(brand || 'UI').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'UI'
}

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

function chartSvg(props, theme, spec = {}) {
  const values = (props.values || []).map(Number).filter((n) => Number.isFinite(n))
  const labels = props.labels || []
  if (!values.length) return '<p class="muted">No numeric data for chart.</p>'
  const colors = spec?.look === 'vivid'
    ? ['#0F766E', '#D97706', '#E11D48', '#0284C7', '#65A30D', '#EA580C']
    : theme.chartColors
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
      const note =
        props.truncated && Number(props.total) > 0
          ? `<p class="truncation-note">Showing ${esc(String((props.rows || []).length))} of ${esc(String(props.total))} rows</p>`
          : ''
      return `<div class="table-wrap">${note}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
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
    case 'chart': {
      const chart = chartSvg(props, theme, spec)
      const note =
        props.truncated && Number(props.total) > 0
          ? `<p class="truncation-note">Showing ${esc(String(props.sampled ?? (props.values || []).length))} of ${esc(String(props.total))} points</p>`
          : ''
      return note ? `<div class="chart-truncation">${note}${chart}</div>` : chart
    }
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
          if (a.action === 'notify') {
            const action = { type: 'notify', payload: { message: a.message ?? a.label } }
            return `<button type="button" class="action-btn" data-action="${esc(JSON.stringify(action))}">${esc(a.label)}</button>`
          }
          const url = a.url ?? '#'
          if (!isSafeHttpUrl(url)) {
            const action = {
              type: 'notify',
              payload: { message: `Link blocked: only http(s) URLs are allowed.` },
            }
            return `<button type="button" class="action-btn" data-action="${esc(JSON.stringify(action))}">${esc(a.label)}</button>`
          }
          const action = { type: 'link', payload: { url } }
          return `<button type="button" class="action-btn" data-action="${esc(JSON.stringify(action))}">${esc(a.label)}</button>`
        })
        .join('')
      return `<div class="action-row">${buttons}</div>`
    }
    case 'login-form': {
      const fields = (props.fields || [])
        .map((field, i) => {
          const name = esc(field.name || `field${i}`)
          const label = esc(field.label || `Field ${i + 1}`)
          const required = field.required ? ' required' : ''
          if (field.type === 'checkbox') {
            return `<label class="auth-check"><input type="checkbox" name="${name}"/><span>${label}</span></label>`
          }
          const type = field.type === 'email' || field.type === 'password' ? field.type : 'text'
          const autocomplete = type === 'password' ? 'current-password' : type === 'email' ? 'username' : 'on'
          const reqMark = field.required ? ' <span class="auth-req">Required</span>' : ''
          return `<label class="auth-field" for="${name}">${label}${reqMark}<input id="${name}" name="${name}" type="${type}" autocomplete="${autocomplete}"${required} /></label>`
        })
        .join('')
      const action = esc(JSON.stringify({
        type: 'notify',
        payload: { message: `Demo sign-in for ${props.brand || 'this account'}. No account is created.` },
      }))
      return `<form class="auth-card" data-action="${action}">
        <div class="auth-mark" aria-hidden="true">${esc(brandMark(props.brand))}</div>
        <p class="auth-kicker">${esc(props.kicker || 'Account')}</p>
        <h1>${esc(props.brand || 'Sign in')}</h1>
        ${props.subtitle ? `<p class="auth-sub">${esc(props.subtitle)}</p>` : ''}
        ${fields}
        <button type="submit" class="auth-submit">${esc(props.submitLabel || 'Sign in')}</button>
      </form>`
    }
    case 'work-stage': {
      const mode = props.mode === 'map' ? 'map' : 'board'
      const mapsKey = mode === 'map' ? googleMapsKey() : ''
      const tools = (props.tools || []).length
        ? props.tools
        : (mode === 'map' ? ['select', 'polygon', 'delete'] : ['select', 'note', 'delete'])
      const toolBtns = tools
        .map((tool, i) => {
          const id = esc(String(tool))
          const label = esc(String(tool).replace(/-/g, ' '))
          const on = mapsKey ? tool === 'select' : i === 0
          return `<button type="button" class="work-tool${on ? ' is-on' : ''}" data-tool="${id}">${label}</button>`
        })
        .join('')
      const layers = (props.layers || [])
        .map((layer) => `<li><strong>${esc(layer.name)}</strong><span>${esc(layer.kind || '')}</span></li>`)
        .join('')
      const hint = mode === 'map'
        ? (mapsKey
          ? 'Polygon uses the Google Maps Drawing library. Close the shape to finish. Delete removes the last polygon.'
          : 'Paste a Maps browser key on the canvas to load the JavaScript API, then draw polygons.')
        : 'Note: click the board to pin a note. Delete removes the last note.'
      const kicker = mode === 'map' ? 'Google Maps SDK' : (props.kicker || 'Workspace')
      const subtitle = mapsKey
        ? 'Google Maps JavaScript API · Drawing library. Restrict the key by HTTP referrer.'
        : (mode === 'map'
          ? 'Paste a Maps JavaScript API key to load the real map. Enable the API and restrict by HTTP referrer.'
          : (props.subtitle || ''))
      const canvas = mode === 'map'
        ? `<div id="gmap" class="map-gmap" role="application" aria-label="Google Map"></div>${mapsKey ? '' : `
            <form class="map-gate" id="maps-gate">
              <p class="map-gate-title">Load the Google Maps JavaScript API</p>
              <p>This preview needs a browser key (Maps JavaScript API + Drawing library). The key stays in this iframe.</p>
              <label for="maps-key">Google Maps API key</label>
              <input id="maps-key" name="maps-key" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…" />
              <button type="submit">Load Google Maps SDK</button>
            </form>`}`
        : '<div class="board-grid" id="board-grid"></div>'
      return `<div class="work-shell" data-mode="${mode}"${mapsKey ? ' data-maps="google"' : ''}>
        <header class="work-top">
          <p class="auth-kicker">${esc(kicker)}</p>
          <h1>${esc(props.title || 'Workspace')}</h1>
          ${subtitle ? `<p class="work-sub">${esc(subtitle)}</p>` : ''}
        </header>
        <div class="work-tools" role="toolbar" aria-label="Tools">${toolBtns}</div>
        <div class="work-body">
          <div class="work-stage" id="work-stage" tabindex="0" role="application" aria-label="${mode === 'map' ? 'Map canvas' : 'Board'}">
            ${canvas}
          </div>
          <aside class="work-rail">
            <h2>Layers</h2>
            <ul class="work-layers">${layers || '<li class="muted">No layers</li>'}</ul>
            <h2>${mode === 'map' ? 'Polygons' : 'Notes'}</h2>
            <ol class="work-features" id="work-features"><li class="muted">${hint}</li></ol>
          </aside>
        </div>
      </div>`
    }
    case 'landing-page': {
      const sections = props.sections || []
      const proof = sections.filter((s) => s.kind === 'proof')
      const product = sections.filter((s) => s.kind === 'product' || s.kind === 'block')
      const footer = sections.filter((s) => s.kind === 'footer')
      const other = sections.filter((s) => !['hero', 'proof', 'product', 'block', 'footer'].includes(s.kind))
      const cta = props.cta
        ? `<button type="button" class="land-cta" data-action="${esc(JSON.stringify({ type: 'notify', payload: { message: props.cta } }))}">${esc(props.cta)}</button>`
        : ''
      const proofRow = proof.length
        ? `<div class="land-proof">${proof.map((s) => `<p>${esc(s.copy)}</p>`).join('')}</div>`
        : ''
      const productRow = [...product, ...other].map((s) => `<section class="land-section"><p>${esc(s.copy)}</p>${s.cta ? `<button type="button" class="land-text-btn" data-action="${esc(JSON.stringify({ type: 'notify', payload: { message: s.cta } }))}">${esc(s.cta)}</button>` : ''}</section>`).join('')
      const foot = footer.map((s) => `<p>${esc(s.copy)}${s.cta ? ` · <button type="button" class="land-text-btn" data-action="${esc(JSON.stringify({ type: 'notify', payload: { message: s.cta } }))}">${esc(s.cta)}</button>` : ''}</p>`).join('')
      return `<div class="land-shell">
        <header class="land-hero">
          ${props.kicker ? `<p class="auth-kicker">${esc(props.kicker)}</p>` : ''}
          <h1>${esc(props.headline || props.brand || 'Welcome')}</h1>
          ${cta}
        </header>
        ${proofRow}
        ${productRow ? `<div class="land-flow">${productRow}</div>` : ''}
        ${foot ? `<footer class="land-foot">${foot}</footer>` : ''}
      </div>`
    }
    case 'checkout': {
      const lines = (props.lines || [])
        .map((line) => `<li><div class="li-main"><strong class="li-title">${esc(line.product)}</strong>${line.detail ? `<span class="li-sub">${esc(line.detail)}</span>` : ''}</div><span class="li-meta">${esc(line.qty || 1)} × ${esc(line.price ?? '')}</span></li>`)
        .join('')
      const t = props.totals || {}
      return `<div class="check-shell">
        <header><p class="auth-kicker">${esc(props.kicker || 'Checkout')}</p><h1>${esc(props.brand || 'Checkout')}</h1>${props.subtitle ? `<p class="work-sub">${esc(props.subtitle)}</p>` : ''}</header>
        <div class="check-layout">
          <ul class="record-list check-lines">${lines}</ul>
          <aside class="check-pay">
            <dl class="kv check-totals">
              ${t.subtotal != null ? `<div class="kv-row"><dt>Subtotal</dt><dd>${esc(t.subtotal)}</dd></div>` : ''}
              ${t.shipping != null ? `<div class="kv-row"><dt>Shipping</dt><dd>${esc(t.shipping)}</dd></div>` : ''}
              ${t.tax != null ? `<div class="kv-row"><dt>Tax</dt><dd>${esc(t.tax)}</dd></div>` : ''}
              ${t.total != null ? `<div class="kv-row"><dt>Total</dt><dd>${esc(t.total)}</dd></div>` : ''}
            </dl>
            <button type="button" class="auth-submit" data-action="${esc(JSON.stringify({ type: 'notify', payload: { message: 'Demo checkout — no charge.' } }))}">Pay now</button>
          </aside>
        </div>
      </div>`
    }
    case 'pricing': {
      const plans = (props.plans || [])
        .map((plan) => `<article class="price-card${plan.featured ? ' is-featured' : ''}"><h2>${esc(plan.name)}</h2><p class="stat-value">${esc(plan.price ?? '0')}</p><p>${esc(plan.perks || '')}</p></article>`)
        .join('')
      return `<div class="price-shell">
        <header><p class="auth-kicker">${esc(props.kicker || 'Plans')}</p><h1>${esc(props.brand || 'Pricing')}</h1>${props.subtitle ? `<p class="work-sub">${esc(props.subtitle)}</p>` : ''}</header>
        <div class="price-grid">${plans}</div>
      </div>`
    }
    case 'form': {
      const fields = (props.fields || [])
        .map((field, i) => {
          const name = esc(field.name || `field${i}`)
          const label = esc(field.label || `Field ${i + 1}`)
          const required = field.required ? ' required' : ''
          const reqMark = field.required ? ' <span class="auth-req">Required</span>' : ''
          if (field.type === 'checkbox') {
            return `<label class="auth-check"><input type="checkbox" name="${name}"/><span>${label}</span></label>`
          }
          const type = field.type === 'email' ? 'email' : 'text'
          return `<label class="auth-field" for="${name}">${label}${reqMark}<input id="${name}" name="${name}" type="${type}"${required} /></label>`
        })
        .join('')
      const action = esc(JSON.stringify({
        type: 'notify',
        payload: { message: `Demo message to ${props.brand || 'this team'}. Nothing was sent.` },
      }))
      return `<form class="auth-card" data-action="${action}">
        <p class="auth-kicker">${esc(props.kicker || 'Contact')}</p>
        <h1>${esc(props.brand || 'Contact')}</h1>
        ${props.subtitle ? `<p class="auth-sub">${esc(props.subtitle)}</p>` : ''}
        ${fields}
        <button type="submit" class="auth-submit">${esc(props.submitLabel || 'Send')}</button>
      </form>`
    }
    case 'settings': {
      const sections = (props.sections || [])
        .map((section) => {
          const fields = (section.fields || [])
            .map((field, i) => {
              const name = esc(field.name || `field${i}`)
              const label = esc(field.label || 'Field')
              if (field.type === 'checkbox') {
                return `<label class="auth-check"><input type="checkbox" name="${name}"/><span>${label}</span></label>`
              }
              const type = field.type === 'email' ? 'email' : 'text'
              return `<label class="auth-field" for="${name}">${label}<input id="${name}" name="${name}" type="${type}" /></label>`
            })
            .join('')
          return `<section class="set-block"><h2>${esc(section.name || 'General')}</h2>${fields}</section>`
        })
        .join('')
      const action = esc(JSON.stringify({
        type: 'notify',
        payload: { message: 'Demo settings — nothing was saved.' },
      }))
      return `<form class="set-shell" data-action="${action}">
        <header><p class="auth-kicker">${esc(props.kicker || 'Account')}</p><h1>${esc(props.brand || 'Settings')}</h1>${props.subtitle ? `<p class="work-sub">${esc(props.subtitle)}</p>` : ''}</header>
        ${sections}
        <button type="submit" class="auth-submit">Save</button>
      </form>`
    }
    case 'calendar': {
      const days = (props.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map((day) => `<li>${esc(day)}</li>`).join('')
      const events = (props.events || [])
        .map((event) => `<li><strong>${esc(event.title)}</strong><span class="li-sub">${esc(event.when)}</span><span class="li-meta">${esc(event.duration)}</span></li>`)
        .join('')
      return `<div class="cal-shell">
        <header><p class="auth-kicker">${esc(props.kicker || 'Week')}</p><h1>${esc(props.title || 'Calendar')}</h1>${props.subtitle ? `<p class="work-sub">${esc(props.subtitle)}</p>` : ''}</header>
        <ol class="cal-days">${days}</ol>
        <ul class="record-list cal-events">${events}</ul>
      </div>`
    }
    case 'html-block': {
      const title = esc(props.title || 'Widget')
      const kicker = esc(props.kicker || 'Generated')
      return `<div class="gen-shell">
        <header><p class="auth-kicker">${kicker}</p><h1>${title}</h1>${props.subtitle ? `<p class="work-sub">${esc(props.subtitle)}</p>` : ''}</header>
        <div class="gen-body">${sanitizeGeneratedHtml(props.html)}</div>
      </div>`
    }
    default:
      return `<p class="muted">Unsupported component: ${esc(component.type)}</p>`
  }
}

const BASE_CSS = `
*{box-sizing:border-box;margin:0}
html,body{min-height:100%}
body{padding:20px 24px;max-width:none;margin:0}
.section{margin-bottom:16px}
.section-title{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.68rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;opacity:.7}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.stat-value{font-size:1.35rem;font-weight:600;font-variant-numeric:tabular-nums}
.stat-label{font-size:.78rem;opacity:.7;margin-top:2px}
.stat-hint{font-size:.72rem;opacity:.55;margin-top:4px}
.kpis .stat{background:transparent}
.kpis .stat-grid{grid-template-columns:repeat(auto-fit,minmax(9rem,11rem));justify-content:start}
.table-wrap{overflow-x:auto}
.truncation-note{font-size:.75rem;opacity:.65;margin:0 0 8px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:.02em}
.chart-truncation{display:flex;flex-direction:column;gap:0}
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
h1{font-size:1.125rem;font-weight:600;letter-spacing:-.02em;margin-bottom:4px}
.page-sub{font-size:.8rem;line-height:1.5;opacity:.7;margin-bottom:16px}
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
body.auth-page{padding:0;max-width:none}
.auth-shell{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.auth-card{width:100%;max-width:min(22rem,100%);min-width:0;display:flex;flex-direction:column;gap:14px;padding:28px 24px;border:1px solid color-mix(in srgb, currentColor 16%, transparent);border-radius:var(--pack-radius,12px);background:transparent;overflow-wrap:break-word}
.auth-kicker{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.68rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin:0}
.auth-card h1{font-size:1.35rem;letter-spacing:-.03em;margin:0}
.auth-mark{width:2.75rem;height:2.75rem;display:flex;align-items:center;justify-content:center;border-radius:var(--pack-radius,8px);background:#0F766E;color:#fff;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85rem;font-weight:600;letter-spacing:.04em}
.auth-sub{font-size:.85rem;line-height:1.5;opacity:.72;margin:0}
.auth-field{display:flex;flex-direction:column;gap:6px;font-size:.82rem;font-weight:500}
.auth-req{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.62rem;font-weight:500;letter-spacing:.04em;text-transform:uppercase;opacity:.55}
.auth-card input[type=email],.auth-card input[type=password],.auth-card input[type=text]{
  min-height:2.75rem;border:1px solid color-mix(in srgb, currentColor 18%, transparent);border-radius:6px;padding:0 12px;font:inherit;background:transparent;color:inherit
}
.auth-card input:focus{outline:2px solid #0F766E;outline-offset:1px}
.auth-check{display:flex;flex-direction:row;align-items:center;gap:8px;font-size:.82rem;font-weight:400}
.auth-check input{width:1rem;height:1rem;accent-color:#0F766E}
.auth-submit{min-height:2.75rem;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:#0F766E;color:#fff}
.auth-submit:hover{opacity:.92}
.auth-submit:focus{outline:2px solid #0F766E;outline-offset:2px}
.land-shell,.check-shell,.price-shell,.set-shell,.cal-shell{max-width:56rem;margin:0 auto;display:flex;flex-direction:column;gap:28px;min-width:0;overflow-wrap:break-word}
.land-hero{display:flex;flex-direction:column;gap:16px;padding:20px 0 12px}
.land-hero h1{font-size:clamp(1.75rem,5vw,2.75rem);letter-spacing:-.04em;max-width:16ch;text-wrap:balance;line-height:1.15}
.land-cta{align-self:flex-start;min-height:2.75rem;padding:0 1.25rem;border:0;border-radius:var(--pack-radius,8px);font:inherit;font-weight:600;cursor:pointer;background:#0F766E;color:#fff}
.land-proof{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:.9rem;opacity:.8;max-width:40rem}
.land-flow{display:flex;flex-direction:column;gap:20px;max-width:36rem}
.land-section{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.land-section p{font-size:1.05rem;line-height:1.55;margin:0}
.land-text-btn{align-self:flex-start;border:0;background:none;color:#0F766E;font:inherit;font-weight:600;cursor:pointer;padding:0;min-height:2.75rem}
.land-foot{border-top:1px solid color-mix(in srgb, currentColor 12%, transparent);padding-top:12px;font-size:.85rem;opacity:.75}
.price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:12px}
.price-card{border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:var(--pack-radius,8px);padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.price-card.is-featured{border-color:#0F766E}
.check-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
@media (min-width:640px){.check-layout{grid-template-columns:minmax(0,1.4fr) minmax(12rem,16rem);align-items:start}}
.check-lines li{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.check-lines .li-main{min-width:0}
.check-pay{display:flex;flex-direction:column;gap:12px;min-width:0;border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:var(--pack-radius,8px);padding:16px}
.check-totals{margin-top:0}
.set-block{display:flex;flex-direction:column;gap:10px;padding-bottom:16px;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent)}
.set-block h2{font-size:.9rem;margin:0}
.cal-days{list-style:none;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.cal-days li{border:1px solid color-mix(in srgb, currentColor 14%, transparent);border-radius:var(--pack-radius,8px);padding:10px 8px;text-align:center;font-size:.82rem;font-weight:600}
.cal-events li{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center}
.gen-shell{max-width:56rem;margin:0 auto;display:flex;flex-direction:column;gap:20px;min-width:0}
.gen-body{min-width:0}
[data-motion="stagger"] .gen-shell > header,[data-motion="enter"] .gen-shell > header,[data-motion="stagger"] .gen-body > *{animation:mcp-enter .36s ease both}
[data-look="vivid"] .auth-card{border-color:#0F766E}
[data-look="vivid"] .auth-submit,[data-look="vivid"] .land-cta{background:#0F766E;box-shadow:0 8px 24px #0F766E33}
[data-look="vivid"] .auth-kicker{color:#0F766E;opacity:1}
[data-look="vivid"] .check-pay{border-color:#0F766E}
[data-look="vivid"] .check-lines li{border-left:3px solid #0F766E;padding-left:10px}
[data-look="vivid"] .land-hero h1,[data-look="vivid"] .check-shell h1,[data-look="vivid"] .auth-card h1{letter-spacing:-.04em}
[data-motion="stagger"] .check-shell > header,[data-motion="enter"] .check-shell > header{animation:mcp-enter .4s ease both}
[data-motion="live"] .check-totals .kv-row:last-child dd{animation:mcp-live 1.6s ease-in-out infinite}
body.work-page{padding:0;max-width:none}
.work-shell{min-height:100vh;display:flex;flex-direction:column}
.work-top{padding:16px 20px 8px}
.work-sub{font-size:.82rem;line-height:1.5;opacity:.7;margin:6px 0 0;max-width:42rem}
.work-tools{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 12px;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent)}
.work-tool{min-height:2.25rem;padding:0 12px;border:1px solid color-mix(in srgb, currentColor 18%, transparent);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:.8rem;font-weight:500;text-transform:capitalize;cursor:pointer}
.work-tool.is-on{background:#0F766E;border-color:#0F766E;color:#fff}
.work-body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 16.5rem;min-height:0}
.work-stage{position:relative;min-height:22rem;overflow:hidden;cursor:crosshair;background:#0B3B4A}
.map-gmap{position:absolute;inset:0;width:100%;height:100%;min-height:22rem}
.map-gate{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:24px;max-width:28rem;margin:auto;background:rgba(15,23,42,.92);color:#E2E8F0}
.map-gate-title{font-size:1.05rem;font-weight:600;margin:0}
.map-gate p{margin:0;font-size:.85rem;line-height:1.5;opacity:.88}
.map-gate label{font-size:.8rem;font-weight:500}
.map-gate input{min-height:2.75rem;border:1px solid color-mix(in srgb, #E2E8F0 22%, transparent);border-radius:6px;padding:0 12px;font:inherit;background:#0F172A;color:#E2E8F0}
.map-gate input:focus{outline:2px solid #2DD4BF;outline-offset:1px}
.map-gate button{min-height:2.75rem;border:0;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;background:#0F766E;color:#fff}
.map-svg{width:100%;height:100%;display:block;min-height:22rem}
.map-water{fill:#0B3B4A}
.map-land{fill:#134E4A}
.map-grid line{stroke:rgba(255,255,255,.12);stroke-width:1}
#map-shapes polygon{fill:rgba(45,212,191,.35);stroke:#2DD4BF;stroke-width:2}
#map-draft polyline{fill:none;stroke:#F8FAFC;stroke-width:2;stroke-dasharray:4 4}
.board-grid{min-height:22rem;height:100%;background-image:linear-gradient(rgba(148,163,184,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.18) 1px,transparent 1px);background-size:24px 24px;position:relative}
.board-note{position:absolute;max-width:11rem;padding:8px 10px;border:1px solid color-mix(in srgb, currentColor 18%, transparent);border-radius:6px;background:#F8F9FB;color:#0F172A;font-size:.8rem;line-height:1.4}
.work-rail{border-left:1px solid color-mix(in srgb, currentColor 12%, transparent);padding:14px 16px;overflow:auto}
.work-rail h2{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;opacity:.65;margin:0 0 8px}
.work-layers,.work-features{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:8px}
.work-layers li,.work-features li{display:flex;justify-content:space-between;gap:8px;font-size:.8rem}
@media (max-width: 720px){
  .work-body{grid-template-columns:1fr}
  .work-rail{border-left:0;border-top:1px solid color-mix(in srgb, currentColor 12%, transparent)}
}
[data-motion="enter"] .section,[data-motion="stagger"] .section{animation:mcp-enter .36s ease both}
[data-motion="enter"] .auth-card,[data-motion="stagger"] .auth-card{animation:mcp-enter .4s ease both}
[data-motion="stagger"] .land-hero,[data-motion="stagger"] .land-section,[data-motion="stagger"] .land-proof,[data-motion="stagger"] .check-layout > *,[data-motion="stagger"] .price-card,[data-motion="stagger"] .set-block,[data-motion="stagger"] .cal-days,[data-motion="stagger"] .cal-events{animation:mcp-enter .36s ease both}
[data-motion="stagger"] .land-section:nth-of-type(1),[data-motion="stagger"] .price-card:nth-child(1),[data-motion="stagger"] .set-block:nth-of-type(1){animation-delay:.08s}
[data-motion="stagger"] .land-section:nth-of-type(2),[data-motion="stagger"] .price-card:nth-child(2),[data-motion="stagger"] .set-block:nth-of-type(2){animation-delay:.16s}
[data-motion="stagger"] .land-section:nth-of-type(3),[data-motion="stagger"] .price-card:nth-child(3),[data-motion="stagger"] .set-block:nth-of-type(3){animation-delay:.24s}
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
[data-look="vivid"] .stat{border-left:4px solid #0F766E}
[data-look="vivid"] .stat:nth-child(1){border-left-color:#0F766E}
[data-look="vivid"] .stat:nth-child(2){border-left-color:#D97706}
[data-look="vivid"] .stat:nth-child(3){border-left-color:#0284C7}
[data-look="vivid"] .stat:nth-child(4){border-left-color:#EA580C}
[data-look="vivid"] .stat:nth-child(5){border-left-color:#E11D48}
[data-look="vivid"] .stat-value{color:#0F766E}
[data-look="vivid"] .stat:nth-child(2) .stat-value{color:#B45309}
[data-look="vivid"] .stat:nth-child(3) .stat-value{color:#0369A1}
[data-look="vivid"] .stat:nth-child(4) .stat-value{color:#C2410C}
[data-look="vivid"] .stat:nth-child(5) .stat-value{color:#BE123C}
[data-look="vivid"] .badge{background:#0F766E14;border-color:#0F766E55;color:#0F766E}
[data-look="vivid"] th{color:#0F766E}
@media (prefers-color-scheme: dark){
  [data-look="vivid"] .stat-value{color:#2DD4BF}
  [data-look="vivid"] .stat:nth-child(2) .stat-value{color:#FBBF24}
  [data-look="vivid"] .stat:nth-child(3) .stat-value{color:#7DD3FC}
  [data-look="vivid"] .stat:nth-child(4) .stat-value{color:#FDBA74}
  [data-look="vivid"] .stat:nth-child(5) .stat-value{color:#FDA4AF}
  [data-look="vivid"] .badge{background:#0F766E33;border-color:#2DD4BF55;color:#99F6E4}
  [data-look="vivid"] th{color:#5EEAD4}
}
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
  [data-motion] .section,[data-motion] .stat-value,[data-motion] tbody tr,[data-motion] .stat,[data-motion] .auth-card,[data-motion] .land-hero,[data-motion] .land-section,[data-motion] .check-layout > *,[data-motion] .price-card{animation:none}
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
document.addEventListener('submit', function (e) {
  var form = e.target.closest('.auth-card')
  if (!form) return
  e.preventDefault()
  try {
    window.parent.postMessage(JSON.parse(form.dataset.action), '*')
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

const WORK_SCRIPT = `
window.initMcpGoogleMap = function () {
  var el = document.getElementById('gmap')
  if (!el || el.getAttribute('data-ready') === '1') return
  if (!window.google || !google.maps || !google.maps.Map || !google.maps.drawing) return
  el.setAttribute('data-ready', '1')
  var list = document.getElementById('work-features')
  var overlays = []
  var map = new google.maps.Map(el, {
    center: { lat: 37.7749, lng: -122.4194 },
    zoom: 12,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false
  })
  var drawing = new google.maps.drawing.DrawingManager({
    drawingMode: null,
    drawingControl: false,
    polygonOptions: {
      fillColor: '#0F766E',
      fillOpacity: 0.35,
      strokeColor: '#0F766E',
      strokeWeight: 2,
      editable: true,
      clickable: true
    }
  })
  drawing.setMap(map)
  function markTool(next) {
    document.querySelectorAll('.work-tool').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-tool') === next)
    })
  }
  function setTool(next) {
    markTool(next)
    if (next === 'polygon') drawing.setDrawingMode(google.maps.drawing.OverlayType.POLYGON)
    else drawing.setDrawingMode(null)
  }
  function listPolygons() {
    if (!list) return
    if (!overlays.length) {
      list.innerHTML = '<li class="muted">Polygon: draw on Google Maps. Delete removes the last shape.</li>'
      return
    }
    list.innerHTML = overlays.map(function (shape, i) {
      var path = shape.getPath ? shape.getPath() : null
      var n = path ? path.getLength() : 0
      var start = ''
      if (path && n) {
        var p = path.getAt(0)
        start = p.lat().toFixed(4) + ', ' + p.lng().toFixed(4)
      }
      return '<li><strong>Polygon ' + (i + 1) + '</strong><span>' + n + ' pts · ' + start + '</span></li>'
    }).join('')
  }
  google.maps.event.addListener(drawing, 'overlaycomplete', function (e) {
    if (e.type !== google.maps.drawing.OverlayType.POLYGON) {
      if (e.overlay) e.overlay.setMap(null)
      return
    }
    overlays.push(e.overlay)
    setTool('select')
    listPolygons()
  })
  document.querySelectorAll('.work-tool').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-tool')
      if (next === 'delete') {
        var last = overlays.pop()
        if (last) last.setMap(null)
        listPolygons()
        setTool('select')
        return
      }
      setTool(next)
    })
  })
  setTool('select')
  listPolygons()
}
window.loadMcpGoogleMaps = function (key) {
  var trimmed = String(key || '').trim()
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(trimmed)) return false
  if (document.getElementById('mcp-gmaps-sdk')) {
    if (window.google && google.maps) window.initMcpGoogleMap()
    return true
  }
  var script = document.createElement('script')
  script.id = 'mcp-gmaps-sdk'
  script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(trimmed) + '&libraries=drawing&callback=initMcpGoogleMap'
  script.async = true
  script.defer = true
  document.head.appendChild(script)
  return true
}
;(function () {
  var gate = document.getElementById('maps-gate')
  if (!gate) return
  gate.addEventListener('submit', function (evt) {
    evt.preventDefault()
    var input = document.getElementById('maps-key')
    var ok = window.loadMcpGoogleMaps(input && input.value)
    if (!ok) {
      if (input) input.setAttribute('aria-invalid', 'true')
      return
    }
    gate.hidden = true
  })
})()
;(function () {
  var shell = document.querySelector('.work-shell')
  if (!shell) return
  if (document.getElementById('gmap')) return
  var mode = shell.getAttribute('data-mode') || 'board'
  var tool = 'select'
  var draft = []
  var shapes = []
  var notes = []
  var list = document.getElementById('work-features')
  function setTool(next) {
    tool = next
    document.querySelectorAll('.work-tool').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-tool') === tool)
    })
  }
  function renderList(items, empty) {
    if (!list) return
    if (!items.length) {
      list.innerHTML = '<li class="muted">' + empty + '</li>'
      return
    }
    list.innerHTML = items.map(function (item) {
      return '<li><strong>' + item[0] + '</strong><span>' + item[1] + '</span></li>'
    }).join('')
  }
  document.querySelectorAll('.work-tool').forEach(function (btn) {
    btn.addEventListener('click', function () { setTool(btn.getAttribute('data-tool')) })
  })
  if (mode === 'map') {
    var svg = document.querySelector('.map-svg')
    var shapesG = document.getElementById('map-shapes')
    var draftG = document.getElementById('map-draft')
    if (!svg || !shapesG) return
    function svgPoint(evt) {
      var pt = svg.createSVGPoint()
      pt.x = evt.clientX
      pt.y = evt.clientY
      var ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      return pt.matrixTransform(ctm.inverse())
    }
    function toLngLat(p) {
      var lng = (-122.52 + (p.x / 800) * 0.28).toFixed(5)
      var lat = (37.82 - (p.y / 520) * 0.16).toFixed(5)
      return lng + ', ' + lat
    }
    function paint() {
      shapesG.innerHTML = shapes.map(function (shape) {
        return '<polygon points="' + shape.map(function (p) { return p.x + ',' + p.y }).join(' ') + '"/>'
      }).join('')
      if (draft.length) {
        draftG.innerHTML = '<polyline points="' + draft.map(function (p) { return p.x + ',' + p.y }).join(' ') + '"/>'
      } else draftG.innerHTML = ''
      renderList(shapes.map(function (shape, i) {
        return ['Polygon ' + (i + 1), shape.length + ' pts · ' + toLngLat(shape[0])]
      }), 'Add a Google Maps API key in Settings. Demo canvas: click to add vertices, Enter to close.')
    }
    function closeDraft() {
      if (draft.length < 3) return
      shapes.push(draft.slice())
      draft = []
      paint()
    }
    svg.addEventListener('click', function (evt) {
      if (tool === 'delete') {
        shapes.pop()
        draft = []
        paint()
        return
      }
      if (tool !== 'polygon') return
      var p = svgPoint(evt)
      if (draft.length > 2) {
        var first = draft[0]
        var dx = p.x - first.x
        var dy = p.y - first.y
        if (dx * dx + dy * dy < 140) {
          closeDraft()
          return
        }
      }
      draft.push(p)
      paint()
    })
    svg.addEventListener('dblclick', function (evt) {
      evt.preventDefault()
      closeDraft()
    })
    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') closeDraft()
      if (evt.key === 'Escape') { draft = []; paint() }
    })
    paint()
    return
  }
  var board = document.getElementById('board-grid')
  if (!board) return
  function paintNotes() {
    board.querySelectorAll('.board-note').forEach(function (el) { el.remove() })
    notes.forEach(function (note) {
      var el = document.createElement('div')
      el.className = 'board-note'
      el.style.left = note.x + 'px'
      el.style.top = note.y + 'px'
      el.textContent = note.text
      board.appendChild(el)
    })
    renderList(notes.map(function (note, i) {
      return ['Note ' + (i + 1), note.text]
    }), 'Note: click the board to pin a note.')
  }
  board.addEventListener('click', function (evt) {
    if (tool === 'delete') {
      notes.pop()
      paintNotes()
      return
    }
    if (tool !== 'note') return
    var box = board.getBoundingClientRect()
    notes.push({
      x: Math.max(8, evt.clientX - box.left - 20),
      y: Math.max(8, evt.clientY - box.top - 12),
      text: 'Note ' + (notes.length + 1),
    })
    paintNotes()
  })
  paintNotes()
})()
`

function bodyAttrs(spec, extraClass = '') {
  const motion = spec?.motion && spec.motion !== 'none' ? spec.motion : ''
  const look = spec?.look === 'vivid' ? 'vivid' : ''
  const radius = spec?.radius ? String(spec.radius) : ''
  const cls = [extraClass, motion ? `motion-${motion}` : '', look ? `look-${look}` : ''].filter(Boolean).join(' ')
  const parts = []
  if (cls) parts.push(`class="${cls}"`)
  if (motion) parts.push(`data-motion="${esc(motion)}"`)
  if (look) parts.push(`data-look="${esc(look)}"`)
  if (radius) parts.push(`data-radius="${esc(radius)}" style="--pack-radius:${esc(radius)}"`)
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
body{padding:0;font-family:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif}
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

function isLoginSpec(spec) {
  return (spec.components || []).some((c) => c.type === 'login-form' || c.type === 'form')
}

function isWorkSpec(spec) {
  return (spec.components || []).some((c) => c.type === 'work-stage')
}

function productShellType(spec) {
  const types = ['landing-page', 'checkout', 'pricing', 'settings', 'calendar', 'html-block']
  return (spec.components || []).find((c) => types.includes(c.type))?.type || null
}

export function renderSpecHtml(spec, theme) {
  if (spec.presentation === 'component') return renderComponentOnly(spec, theme)

  if (isLoginSpec(spec)) {
    const form = (spec.components || []).find((c) => c.type === 'login-form' || c.type === 'form')
    const main = `<div class="auth-shell">${renderComponent(form, theme, spec)}</div>`
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Sign in')}</title>
${theme.head || ''}
<style>${BASE_CSS}${theme.css}</style>
</head>
<body${bodyAttrs(spec, 'auth-page')}>
${main}
<script>${ACTION_SCRIPT}</script>
</body>
</html>`
  }

  const productType = productShellType(spec)
  if (productType) {
    const node = (spec.components || []).find((c) => c.type === productType)
    const main = renderComponent(node, theme, spec)
    const extraCss = productType === 'html-block' ? sanitizeCss(node?.props?.css || '') : ''
    const extraScript = productType === 'html-block' ? sanitizeGeneratedScript(node?.props?.script || '') : ''
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || productType)}</title>
${theme.head || ''}
<style>${BASE_CSS}${theme.css}${extraCss}</style>
</head>
<body${bodyAttrs(spec, 'product-page')}>
${main}
<script>${ACTION_SCRIPT}${extraScript}</script>
</body>
</html>`
  }

  if (isWorkSpec(spec)) {
    const stage = (spec.components || []).find((c) => c.type === 'work-stage')
    const main = renderComponent(stage, theme, spec)
    const mapsKey = stage?.props?.mode === 'map' ? googleMapsKey() : ''
    const mapsTag = mapsKey
      ? `<script src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&libraries=drawing&callback=initMcpGoogleMap" async defer></script>`
      : ''
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.title || 'Workspace')}</title>
${theme.head || ''}
<style>${BASE_CSS}${theme.css}</style>
</head>
<body${bodyAttrs(spec, 'work-page')}>
${main}
<script>${ACTION_SCRIPT}${WORK_SCRIPT}</script>
${mapsTag}
</body>
</html>`
  }

  const visible = spec.drawer
    ? (spec.components || []).filter((c) => c.type !== 'key-value')
    : spec.components || []
  const sections = visible
    .map((c) => {
      const kind = c.type === 'stat-grid' ? 'kpis' : 'card'
      return `<section class="section ${kind}">${c.title ? `<div class="section-title">${esc(c.title)}</div>` : ''}${renderComponent(c, theme, spec)}</section>`
    })
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
