import { useCallback, useEffect, useState } from 'react'
import './App.css'
import {
  applyGlassCss,
  readStoredGlass,
  GLASS_STORAGE_KEY,
} from './glassAppearance.js'
import { GlassControls } from './GlassControls.jsx'
import { EndpointToUI } from './EndpointToUI.jsx'

function App() {
  const [glass, setGlass] = useState(() => readStoredGlass())
  const [health, setHealth] = useState({ state: 'checking' })
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    applyGlassCss(glass)
    try {
      localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(glass))
    } catch {
      /* ignore quota */
    }
  }, [glass])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyGlassCss(glass)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [glass])

  const checkHealth = useCallback(async () => {
    setHealth({ state: 'checking' })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch('/api/health', { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setHealth({ state: 'ok', payload: await res.json() })
    } catch (err) {
      clearTimeout(timer)
      setHealth({
        state: 'error',
        message:
          err instanceof Error
            ? err.name === 'AbortError'
              ? 'Timed out after 15s'
              : err.message
            : 'Request failed',
      })
    }
  }, [])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

  const pushToast = useCallback((message, type = 'info', dismissMs = 5000) => {
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, dismissMs)
  }, [])

  const handleUIAction = useCallback(
    (action) => {
      if (action?.type === 'notify') {
        pushToast(action.payload?.message ?? 'Notification from generated UI')
      } else if (action?.type === 'link' && action.payload?.url) {
        window.open(action.payload.url, '_blank', 'noopener,noreferrer')
      }
    },
    [pushToast]
  )

  const ai = health.state === 'ok' ? health.payload?.ai : null

  return (
    <div className="app">
      {notifications.length > 0 && (
        <div className="notifications">
          {notifications.map((n) => (
            <div key={n.id} className={`notification ${n.type}`}>
              {n.message}
            </div>
          ))}
        </div>
      )}

      <header className="app-header hero">
        <p className="hero-kicker">MCP UI · mcpui.dev</p>
        <h1>
          Any endpoint, <span className="hero-accent">rendered</span>.
        </h1>
        <p className="hero-sub">
          Point at an API. Claude analyses the data and composes a UI from your
          registered design system — delivered as an MCP UI resource.
        </p>

        <div
          className={`server-status ${
            health.state === 'ok'
              ? 'status-ok'
              : health.state === 'error'
                ? 'status-error'
                : 'status-checking'
          }`}
          role="status"
          aria-live="polite"
          aria-busy={health.state === 'checking'}
        >
          {health.state === 'checking' && (
            <span className="status-label">Checking API connection…</span>
          )}
          {health.state === 'ok' && (
            <span className="status-label">
              API connected
              {ai && (
                <span className="status-meta">
                  {' · '}
                  {ai.available ? `AI planner: ${ai.model}` : 'heuristic planner (set ANTHROPIC_API_KEY)'}
                </span>
              )}
            </span>
          )}
          {health.state === 'error' && (
            <div className="status-error-body">
              <span className="status-label">
                Cannot reach API ({health.message}). Start the backend (
                <code className="status-code">npm run dev</code> from the repo root).
              </span>
              <button type="button" className="btn status-retry" onClick={() => checkHealth()}>
                Retry
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="mcp-ui-section">
          <EndpointToUI onUIAction={handleUIAction} />
        </section>
      </main>

      <GlassControls glass={glass} setGlass={setGlass} />
    </div>
  )
}

export default App
