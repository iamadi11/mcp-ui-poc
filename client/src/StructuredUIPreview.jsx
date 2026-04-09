import { useState, useMemo, useEffect, useCallback } from 'react'

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#a855f7']

function selectOptions(field) {
  const { options = [], label } = field
  if (!options.length) {
    return [{ value: '', label: `Select ${label}` }]
  }
  const first = options[0]
  if (typeof first === 'string') {
    return [{ value: '', label: `Select ${label}` }, ...options.map((opt) => ({ value: String(opt), label: String(opt) }))]
  }
  return [
    { value: '', label: `Select ${label}` },
    ...options.map((opt) => ({
      value: String(opt.value),
      label: String(opt.label ?? opt.value),
    })),
  ]
}

function StructForm({ id, config, onAction }) {
  const { title, fields = [], submitText = 'Submit' } = config

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = {}
    for (const [k, v] of fd.entries()) {
      data[k] = v
    }
    onAction({
      type: 'form-submit',
      payload: { formId: id, data, preview: 'structured' },
    })
  }

  return (
    <article className="struct-card struct-card--form">
      <h2 className="struct-title">{title}</h2>
      <form onSubmit={handleSubmit}>
        {fields.map((field) => {
          const { name, type, label, placeholder, required } = field
          const key = name
          if (type === 'select') {
            const opts = selectOptions(field)
            return (
              <div key={key} className="struct-field">
                <label htmlFor={name}>
                  {label}
                  {required ? ' *' : ''}
                </label>
                <select id={name} name={name} required={!!required}>
                  {opts.map((o) => (
                    <option key={o.value || '_empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
          if (type === 'textarea') {
            return (
              <div key={key} className="struct-field">
                <label htmlFor={name}>
                  {label}
                  {required ? ' *' : ''}
                </label>
                <textarea
                  id={name}
                  name={name}
                  placeholder={placeholder || ''}
                  required={!!required}
                  rows={4}
                />
              </div>
            )
          }
          return (
            <div key={key} className="struct-field">
              <label htmlFor={name}>
                {label}
                {required ? ' *' : ''}
              </label>
              <input
                type={type || 'text'}
                id={name}
                name={name}
                placeholder={placeholder || ''}
                required={!!required}
              />
            </div>
          )
        })}
        <div className="struct-actions">
          <button type="submit" className="struct-btn">
            {submitText}
          </button>
        </div>
      </form>
    </article>
  )
}

function normalizeChartWidgetData(data) {
  if (!data) return { values: [0], labels: ['No Data'] }
  let chartData = data
  if (data.value != null && data.label != null && !data.values) {
    chartData = {
      values: [parseInt(String(data.value).replace(/,/g, ''), 10) || 0],
      labels: [data.label],
    }
  }
  if (!chartData.values || !chartData.labels) {
    return { values: [0], labels: ['No Data'] }
  }
  return chartData
}

function StructDashboardWidget({ widget }) {
  const { type, title: wtitle, data } = widget

  if (type === 'metric') {
    return (
      <div className="struct-widget">
        <h3>{wtitle}</h3>
        <div className="struct-metric-value">{data.value}</div>
        <div className="struct-metric-label">{data.label}</div>
      </div>
    )
  }
  if (type === 'list') {
    const items = data?.items ?? []
    return (
      <div className="struct-widget">
        <h3>{wtitle}</h3>
        <ul className="struct-list">
          {items.map((item) => (
            <li key={String(item)}>{String(item)}</li>
          ))}
        </ul>
      </div>
    )
  }
  if (type === 'chart') {
    const chartData = normalizeChartWidgetData(data)
    const maxV = Math.max(1, ...chartData.values)
    return (
      <div className="struct-widget">
        <h3>{wtitle}</h3>
        <div className="struct-chart-row">
          {chartData.values.map((value, i) => (
            <div
              key={i}
              className="struct-bar"
              style={{ height: `${(value / maxV) * 160}px` }}
            >
              {value}
            </div>
          ))}
        </div>
        <div className="struct-chart-labels">
          {chartData.labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    )
  }
  return null
}

function StructDashboard({ id, config, onAction }) {
  const { title, widgets = [] } = config

  return (
    <article className="struct-card struct-card--wide">
      <h2 className="struct-title">{title}</h2>
      <div className="struct-grid">
        {widgets.map((w, i) => (
          <StructDashboardWidget key={i} widget={w} />
        ))}
      </div>
      <div className="struct-actions">
        <button
          type="button"
          className="struct-btn struct-btn--ghost"
          onClick={() =>
            onAction({ type: 'dashboard-refresh', payload: { dashboardId: id } })
          }
        >
          Refresh Dashboard
        </button>
      </div>
    </article>
  )
}

function StructChart({ id, config, onAction }) {
  const { title, type, data: rawData } = config
  const data = rawData ?? { values: [], labels: [] }
  const maxValue = useMemo(
    () => Math.max(1, ...(data.values?.length ? data.values : [0])),
    [data]
  )

  let body = null
  if (type === 'bar' && data.values?.length) {
    body = (
      <>
        <div className="struct-chart-row struct-chart-row--tall">
          {data.values.map((value, i) => (
            <div
              key={i}
              className="struct-bar"
              style={{ height: `${(value / maxValue) * 200}px` }}
            >
              {value}
            </div>
          ))}
        </div>
        <div className="struct-chart-labels">
          {data.labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </>
    )
  } else if (type === 'pie' && data.values?.length) {
    const total = data.values.reduce((s, v) => s + v, 0) || 1
    let start = 0
    const segments = data.values
      .map((value, index) => {
        const pct = (value / total) * 100
        const s = start
        start += pct
        const end = start
        return `${PIE_COLORS[index % PIE_COLORS.length]} ${s}% ${end}%`
      })
      .join(', ')
    body = (
      <>
        <div className="struct-pie-wrap">
          <div
            className="struct-pie"
            style={{ background: `conic-gradient(${segments})` }}
          />
        </div>
        <div className="struct-legend">
          {data.labels.map((label, index) => (
            <div key={label} className="struct-legend-item">
              <span
                className="struct-swatch"
                style={{
                  background: PIE_COLORS[index % PIE_COLORS.length],
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </>
    )
  }

  if (!body) {
    body = <p className="struct-empty">No chart data.</p>
  }

  return (
    <article className="struct-card">
      <h2 className="struct-title">{title}</h2>
      {body}
      <div className="struct-actions">
        <button
          type="button"
          className="struct-btn struct-btn--amber"
          onClick={() =>
            onAction({ type: 'chart-export', payload: { chartId: id } })
          }
        >
          Export Chart
        </button>
      </div>
    </article>
  )
}

/**
 * Renders MCP UI from a versioned structured envelope (JSON config), no iframe.
 */
export function StructuredUIPreview({ envelope, onAction }) {
  if (!envelope || envelope.schemaVersion !== 1) {
    return (
      <div className="struct-error">Unsupported structured UI payload.</div>
    )
  }

  const { kind, id, config } = envelope

  switch (kind) {
    case 'form':
      return <StructForm id={id} config={config} onAction={onAction} />
    case 'dashboard':
      return <StructDashboard id={id} config={config} onAction={onAction} />
    case 'chart':
      return <StructChart id={id} config={config} onAction={onAction} />
    default:
      return <div className="struct-error">Unknown UI kind: {kind}</div>
  }
}

/**
 * Normalizes API responses into { resource, structured } for preview state.
 */
export function normalizeMcpPreviewResponse(data) {
  if (data == null) return null

  if (data.type === 'resource' && data.resource) {
    return {
      resource: data.resource,
      structured: data.structured ?? null,
    }
  }

  if (data.mimeType && data.text !== undefined) {
    return {
      resource: {
        uri: data.uri,
        mimeType: data.mimeType,
        text: data.text,
      },
      structured: data.structured ?? null,
    }
  }

  return null
}

export function McpPreviewRouter({ preview, onUIAction }) {
  const [mode, setMode] = useState('structured')

  if (!preview?.resource) {
    return <div className="struct-error">No preview resource.</div>
  }

  const hasStructured = Boolean(preview.structured)

  if (!hasStructured) {
    return (
      <UIResourceIframe resource={preview.resource} onUIAction={onUIAction} />
    )
  }

  return (
    <div className="mcp-preview-router">
      <div className="mcp-preview-mode" role="group" aria-label="Preview mode">
        <label className="mcp-preview-mode__opt">
          <input
            type="radio"
            name="mcp-preview-mode"
            checked={mode === 'structured'}
            onChange={() => setMode('structured')}
          />
          Data (React)
        </label>
        <label className="mcp-preview-mode__opt">
          <input
            type="radio"
            name="mcp-preview-mode"
            checked={mode === 'html'}
            onChange={() => setMode('html')}
          />
          HTML (iframe)
        </label>
      </div>

      {mode === 'structured' ? (
        <StructuredUIPreview envelope={preview.structured} onAction={onUIAction} />
      ) : (
        <UIResourceIframe resource={preview.resource} onUIAction={onUIAction} />
      )}
    </div>
  )
}

function UIResourceIframe({ resource, onUIAction }) {
  const handleMessage = useCallback(
    (event) => {
      if (
        event.data &&
        (event.data.type === 'tool' ||
          event.data.type === 'notify' ||
          event.data.type === 'form-submit' ||
          event.data.type === 'dashboard-refresh' ||
          event.data.type === 'chart-export')
      ) {
        onUIAction(event.data)
      }
    },
    [onUIAction]
  )

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  if (resource.mimeType === 'text/html') {
    return (
      <iframe
        srcDoc={resource.text}
        className="mcp-preview-frame"
        style={{ width: '100%', height: '600px', border: 'none' }}
        title="MCP-UI Resource"
      />
    )
  }

  return <div>Unsupported resource type: {resource.mimeType}</div>
}
