import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { Studio } from './studio/Studio.jsx'
import { OwnerPage } from './studio/OwnerPage.jsx'
import { isSafeHttpUrl } from './safeUrl.js'

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

  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = (attempt = 0) => {
      fetch('/api/health')
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((payload) => {
          if (!cancelled) setHealth({ state: 'ok', payload })
        })
        .catch(() => {
          if (cancelled) return
          if (attempt < 2) setTimeout(() => load(attempt + 1), 400)
          else setHealth({ state: 'error' })
        })
    }
    load()
    return () => {
      cancelled = true
    }
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
        const url = action.payload.url
        if (!isSafeHttpUrl(url)) {
          pushToast('Blocked an unsafe link from the generated UI.', 'error')
          return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [pushToast],
  )

  const jevFromEnv = Boolean(health.payload?.jevFromEnv ?? health.payload?.jev?.fromEnv)
  const aiFromEnv = Boolean(health.payload?.aiFromEnv ?? health.payload?.ai?.fromEnv)
  const jevAvailable = jevFromEnv || Boolean(health.payload?.jev?.available)
  const aiAvailable = aiFromEnv || Boolean(health.payload?.ai?.available)
  const mapsFromEnv = Boolean(health.payload?.maps?.configured)
  const keysUnknown = health.state !== 'ok'

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
      <main className="app-main">
        {route.name === 'owner' ? (
          <OwnerPage publicId={route.publicId} typesafeKey={typesafeKey} />
        ) : (
          <Studio
            typesafeKey={typesafeKey}
            onTypesafeKeyChange={setTypesafeKey}
            onUIAction={handleUIAction}
            jevAvailable={jevAvailable}
            aiAvailable={aiAvailable}
            jevFromEnv={jevFromEnv}
            aiFromEnv={aiFromEnv}
            mapsFromEnv={mapsFromEnv}
            keysUnknown={keysUnknown}
          />
        )}
      </main>
    </div>
  )
}

export default App
