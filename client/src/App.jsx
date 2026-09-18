import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { Studio } from './studio/Studio.jsx'
import { OwnerPage } from './studio/OwnerPage.jsx'
import { SettingsPanel } from './SettingsPanel.jsx'

function routeFromPath(pathname) {
  const owner = pathname.match(/^\/w\/([^/]+)/)
  if (owner) return { name: 'owner', publicId: owner[1] }
  return { name: 'studio' }
}

function App() {
  const [health, setHealth] = useState({ state: 'checking' })
  const [notifications, setNotifications] = useState([])
  const [typesafeKey, setTypesafeKey] = useState('')
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname))
  const [auth, setAuth] = useState({ user: null, oauth: false })

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then(setAuth)
      .catch(() => {})
  }, [])

  const pushToast = useCallback((message, type = 'info', dismissMs = 5000) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
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
    [pushToast],
  )

  const payload = health.state === 'ok' ? health.payload : null
  const ai = payload?.ai
  const jev = payload?.jev
  const store = payload?.store
  const sessionJev = Boolean(typesafeKey.trim())
  const isProd = import.meta.env.PROD

  let healthMeta = ''
  if (payload) {
    const jevBit = jev?.available
      ? `Jev: ${jev.model}`
      : sessionJev
        ? 'Jev: session key'
        : 'Jev: paste a TypeSafe key'
    const llmBit = ai?.available ? `LLM: ${ai.model}` : 'LLM: off'
    healthMeta = [jevBit, llmBit, `store: ${store || 'unknown'}`, payload.mongo ? `mongo: ${payload.mongo}` : null]
      .filter(Boolean)
      .join(' · ')
  }

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

      <header className="app-header">
        <div className="brand">
          <p className="kicker">MCP UI studio</p>
          <h1>Chat a widget. Publish a URL.</h1>
        </div>
        <div
          className={`server-status ${
            health.state === 'ok' ? 'status-ok' : health.state === 'error' ? 'status-error' : 'status-checking'
          }`}
          role="status"
          aria-live="polite"
        >
          {health.state === 'checking' && <span>Checking API…</span>}
          {health.state === 'ok' && (
            <span>
              API connected
              {healthMeta ? <span className="status-meta">{healthMeta}</span> : null}
            </span>
          )}
          {health.state === 'error' && (
            <span>
              {isProd ? `Cannot reach API (${health.message}).` : `Cannot reach API (${health.message}). Run npm run dev.`}
              <button type="button" className="text-btn" onClick={() => checkHealth()}>
                Retry
              </button>
            </span>
          )}
        </div>
        {auth.oauth && !auth.user ? (
          <a className="text-btn" href="/api/auth/github">
            Sign in with GitHub
          </a>
        ) : null}
        {auth.user ? <span className="status-meta">@{auth.user.login}</span> : null}
        <SettingsPanel typesafeKey={typesafeKey} onTypesafeKeyChange={setTypesafeKey} />
      </header>

      <main className="app-main">
        {route.name === 'owner' ? (
          <OwnerPage publicId={route.publicId} typesafeKey={typesafeKey} />
        ) : (
          <Studio typesafeKey={typesafeKey} onUIAction={handleUIAction} decisionStore={store} />
        )}
      </main>
    </div>
  )
}

export default App
