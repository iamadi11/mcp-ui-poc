import { wrapGeneratedHtml } from './generated-html-skin.js'

function selectOptionsHtml(field) {
  const { options = [], label } = field
  if (!options.length) {
    return `<option value="">Select ${label}</option>`
  }
  const first = options[0]
  if (typeof first === 'string') {
    return [
      `<option value="">Select ${label}</option>`,
      ...options.map((opt) => `<option value="${String(opt)}">${String(opt)}</option>`),
    ].join('')
  }
  return [
    `<option value="">Select ${label}</option>`,
    ...options.map(
      (opt) =>
        `<option value="${String(opt.value)}">${String(opt.label ?? opt.value)}</option>`
    ),
  ].join('')
}

export function createFormHTML(config, formId) {
  const { title, fields, submitText = 'Submit' } = config

  const fieldsHTML = fields
    .map((field) => {
      const { name, type, label, placeholder, required, options } = field

      if (type === 'select') {
        const optionsHTML = selectOptionsHtml(field)
        return `
          <div class="gen-form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <select id="${name}" name="${name}" ${required ? 'required' : ''}>
              ${optionsHTML}
            </select>
          </div>
        `
      }
      if (type === 'textarea') {
        return `
          <div class="gen-form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <textarea id="${name}" name="${name}" placeholder="${placeholder || ''}" ${required ? 'required' : ''}></textarea>
          </div>
        `
      }
      return `
          <div class="gen-form-field">
            <label for="${name}">${label}${required ? ' *' : ''}</label>
            <input type="${type}" id="${name}" name="${name}" placeholder="${placeholder || ''}" ${required ? 'required' : ''}>
          </div>
        `
    })
    .join('')

  const inner = `
    <article class="gen-card gen-card--form">
      <h2 class="gen-title">${title}</h2>
      <form id="${formId}" onsubmit="handleFormSubmit(event, '${formId}')">
        ${fieldsHTML}
        <div class="gen-actions">
          <button type="submit" class="gen-btn">${submitText}</button>
        </div>
      </form>
    </article>
    <script>
      function handleFormSubmit(event, formId) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
          data[key] = value;
        }
        window.parent.postMessage({
          type: 'form-submit',
          payload: { formId: formId, data: data, preview: 'html' }
        }, '*');
      }
    </script>
  `

  return wrapGeneratedHtml(inner)
}

export function createDashboardHTML(config, dashboardId) {
  const { title, widgets = [] } = config

  const widgetsHTML = (widgets || [])
    .map((widget) => {
      const { type, title: wtitle, data } = widget

      if (type === 'metric') {
        return `
          <div class="gen-widget">
            <h3>${wtitle}</h3>
            <div class="gen-metric-value">${data.value}</div>
            <div class="gen-metric-label">${data.label}</div>
          </div>
        `
      }
      if (type === 'list') {
        const itemsHTML = data.items
          .map(
            (item) =>
              `<li>${String(item)}</li>`
          )
          .join('')
        return `
          <div class="gen-widget">
            <h3>${wtitle}</h3>
            <ul class="gen-list">${itemsHTML}</ul>
          </div>
        `
      }
      if (type === 'chart') {
        let chartData = data
        if (data.value && data.label && !data.values) {
          chartData = {
            chartType: data.chartType ?? 'bar',
            values: [parseInt(String(data.value).replace(/,/g, ''), 10) || 0],
            labels: [data.label],
          }
        }
        if (!chartData.values || !chartData.labels) {
          chartData = { chartType: chartData.chartType ?? 'bar', values: [0], labels: ['No Data'] }
        }
        const chartType = chartData.chartType ?? 'bar'
        const maxV = Math.max(1, ...chartData.values)
        const labels = chartData.labels
          .map((label) => `<span>${label}</span>`)
          .join('')
        let chartBody = ''
        if (chartType === 'line') {
          const pts = lineChartPolylinePoints(chartData.values)
          chartBody = `
            <div class="gen-line-chart">
              <svg class="gen-line-svg" viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label="Line chart">
                <polyline class="gen-line-poly" points="${pts}" />
              </svg>
            </div>
          `
        } else if (chartType === 'pie') {
          const total = chartData.values.reduce((sum, val) => sum + val, 0) || 1
          const segments = chartData.values
            .map((value, index) => {
              const pct = (value / total) * 100
              const start = chartData.values
                .slice(0, index)
                .reduce((s, v) => s + (v / total) * 100, 0)
              const end = start + pct
              return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`
            })
            .join(', ')
          chartBody = `
            <div class="gen-pie-wrap">
              <div class="gen-pie" style="background:conic-gradient(${segments})"></div>
            </div>
          `
        } else {
          const bars = chartData.values
            .map(
              (value) =>
                `<div class="gen-bar" style="height:${(value / maxV) * 160}px">${value}</div>`
            )
            .join('')
          chartBody = `<div class="gen-chart-row">${bars}</div>`
        }
        return `
          <div class="gen-widget">
            <h3>${wtitle}</h3>
            ${chartBody}
            <div class="gen-chart-labels">${labels}</div>
          </div>
        `
      }
      return ''
    })
    .join('')

  const inner = `
    <article class="gen-card gen-card--wide">
      <h2 class="gen-title">${title}</h2>
      <div class="gen-grid">${widgetsHTML}</div>
      <div class="gen-actions">
        <button type="button" class="gen-btn gen-btn--ghost" onclick="refreshDashboard('${dashboardId}')">Refresh Dashboard</button>
      </div>
    </article>
    <script>
      function refreshDashboard(dashboardId) {
        window.parent.postMessage({
          type: 'dashboard-refresh',
          payload: { dashboardId: dashboardId }
        }, '*');
      }
    </script>
  `

  return wrapGeneratedHtml(inner)
}

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#a855f7']

/** SVG viewBox 0 0 100 50 — y axis down; returns polyline `points` attribute value */
function lineChartPolylinePoints(values) {
  const n = values.length
  if (n === 0) return ''
  const maxV = Math.max(1, ...values)
  if (n === 1) {
    const y = 45 - (values[0] / maxV) * 35
    return `48,${y} 52,${y}`
  }
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * 100
      const y = 45 - (v / maxV) * 35
      return `${x},${y}`
    })
    .join(' ')
}

export function createChartHTML(config, chartId) {
  const { title, type, data } = config

  let chartBody = ''

  if (type === 'bar') {
    const maxValue = Math.max(1, ...data.values)
    const bars = data.values
      .map(
        (value) =>
          `<div class="gen-bar" style="height:${(value / maxValue) * 200}px">${value}</div>`
      )
      .join('')
    const labels = data.labels
      .map((label) => `<span>${label}</span>`)
      .join('')
    chartBody = `
      <div class="gen-chart-row" style="height:300px">${bars}</div>
      <div class="gen-chart-labels">${labels}</div>
    `
  } else if (type === 'pie') {
    const total = data.values.reduce((sum, val) => sum + val, 0) || 1
    const segments = data.values
      .map((value, index) => {
        const pct = (value / total) * 100
        const start = data.values
          .slice(0, index)
          .reduce((s, v) => s + (v / total) * 100, 0)
        const end = start + pct
        return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`
      })
      .join(', ')
    const legend = data.labels
      .map((label, index) => {
        const c = PIE_COLORS[index % PIE_COLORS.length]
        return `<div class="gen-legend-item"><span class="gen-swatch" style="background:${c}"></span><span>${label}</span></div>`
      })
      .join('')
    chartBody = `
      <div class="gen-pie-wrap">
        <div class="gen-pie" style="background:conic-gradient(${segments})"></div>
      </div>
      <div class="gen-legend">${legend}</div>
    `
  } else if (type === 'line' && data.values?.length) {
    const pts = lineChartPolylinePoints(data.values)
    const labels = data.labels
      .map((label) => `<span>${label}</span>`)
      .join('')
    chartBody = `
      <div class="gen-line-chart">
        <svg class="gen-line-svg" viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label="Line chart">
          <polyline class="gen-line-poly" points="${pts}" />
        </svg>
        <div class="gen-chart-labels">${labels}</div>
      </div>
    `
  }

  const inner = `
    <article class="gen-card">
      <h2 class="gen-title">${title}</h2>
      ${chartBody}
      <div class="gen-actions">
        <button type="button" class="gen-btn gen-btn--amber" onclick="exportChart('${chartId}')">Export Chart</button>
      </div>
    </article>
    <script>
      function exportChart(chartId) {
        window.parent.postMessage({
          type: 'chart-export',
          payload: { chartId: chartId }
        }, '*');
      }
    </script>
  `

  return wrapGeneratedHtml(inner)
}
