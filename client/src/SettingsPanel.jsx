import { useCallback, useEffect, useState } from 'react'
import { readApiKey, writeApiKey } from './storage.js'

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M14.5 9.5a4 4 0 1 0-3.86 4l-1.04 1.04H8v1.5H6.5V17.5H4V15l4.86-4.86A4 4 0 0 1 14.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="6.5" r="1.25" fill="currentColor" />
    </svg>
  )
}

function combinedFab(jevStatus, anthStatus) {
  if (jevStatus === 'checking' || anthStatus === 'checking') {
    return { status: 'checking', label: 'Checking keys…' }
  }
  if (jevStatus === 'connected') {
    return { status: 'connected', label: 'Jev connected' }
  }
  if (anthStatus === 'connected') {
    return { status: 'connected', label: 'Connected to Claude' }
  }
  if (jevStatus === 'invalid' || anthStatus === 'invalid') {
    return { status: 'invalid', label: 'Key invalid' }
  }
  if (jevStatus === 'error' || anthStatus === 'error') {
    return { status: 'error', label: 'Could not verify' }
  }
  return { status: 'none', label: 'API keys' }
}

export function SettingsPanel({ typesafeKey = '', onTypesafeKeyChange = () => {} }) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(() => readApiKey())
  const [status, setStatus] = useState(() => (readApiKey() ? 'checking' : 'none'))
  const [jevStatus, setJevStatus] = useState('none')

  const verify = useCallback(async (apiKey) => {
    if (!apiKey) {
      setStatus('none')
      return
    }
    setStatus('checking')
    try {
      const res = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-anthropic-api-key': apiKey },
        body: '{}',
      })
      const body = await res.json().catch(() => ({}))
      setStatus(body.valid ? 'connected' : 'invalid')
    } catch {
      setStatus('error')
    }
  }, [])

  const verifyJev = useCallback(async (apiKey) => {
    if (!apiKey) {
      setJevStatus('none')
      return
    }
    setJevStatus('checking')
    try {
      const res = await fetch('/api/verify-jev-key', {
        method: 'POST',
        headers: { 'x-typesafe-api-key': apiKey },
      })
      const body = await res.json().catch(() => ({}))
      setJevStatus(body.valid ? 'connected' : 'invalid')
    } catch {
      setJevStatus('error')
    }
  }, [])

  useEffect(() => {
    const stored = readApiKey()
    if (stored) verify(stored)
  }, [verify])

  const handleSave = () => {
    const trimmed = key.trim()
    writeApiKey(trimmed)
    verify(trimmed)
  }

  const handleClear = () => {
    writeApiKey('')
    setKey('')
    setStatus('none')
  }

  const handleVerifyJev = () => {
    const trimmed = (typesafeKey || '').trim()
    onTypesafeKeyChange(trimmed)
    verifyJev(trimmed)
  }

  const handleClearJev = () => {
    onTypesafeKeyChange('')
    setJevStatus('none')
  }

  const fab = combinedFab(jevStatus, status)

  return (
    <div className="settings-panel">
      <button
        type="button"
        className="settings-panel__fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="settings-panel-body"
        id="settings-panel-trigger"
      >
        <KeyIcon />
        <span
          className={`settings-panel__dot settings-panel__dot--${fab.status}`}
          aria-hidden="true"
        />
        <span>{fab.label}</span>
      </button>
      {open && (
        <div
          id="settings-panel-body"
          className="settings-panel__body"
          role="region"
          aria-labelledby="settings-panel-trigger"
        >
          <section className="settings-panel__section">
            <div className="settings-panel__head">
              <span className="settings-panel__title">TypeSafe / Jev key</span>
            </div>
            <p className="settings-panel__hint">
              Kept in this tab only. Not saved on this device or the server. Refresh
              clears it.
            </p>
            <label htmlFor="typesafe-api-key" className="sr-only">
              TypeSafe API key
            </label>
            <input
              id="typesafe-api-key"
              type="password"
              className="settings-panel__input"
              value={typesafeKey}
              onChange={(e) => onTypesafeKeyChange(e.target.value)}
              placeholder="apikey…"
              spellCheck={false}
              autoComplete="off"
            />
            <p
              className={`settings-panel__status settings-panel__status--${jevStatus}`}
              role="status"
              aria-live="polite"
            >
              {jevStatus === 'none' && 'No session key — Jev uses TYPESAFE_API_KEY from the server if set.'}
              {jevStatus === 'checking' && 'Checking connection…'}
              {jevStatus === 'connected' && 'Connected — this tab will send the key as a header on generate.'}
              {jevStatus === 'invalid' && 'TypeSafe rejected this key. Check it and try again.'}
              {jevStatus === 'error' && 'Could not reach the server to verify this key.'}
            </p>
            <div className="settings-panel__actions">
              <button type="button" className="settings-panel__clear" onClick={handleClearJev}>
                Clear
              </button>
              <button type="button" className="settings-panel__save" onClick={handleVerifyJev}>
                Verify
              </button>
            </div>
          </section>

          <section className="settings-panel__section">
            <div className="settings-panel__head">
              <span className="settings-panel__title">Anthropic API key</span>
            </div>
            <p className="settings-panel__hint">
              Optional LLM fallback. Saved in this browser and sent as a header —
              never stored on the server.
            </p>
            <label htmlFor="anthropic-api-key" className="sr-only">
              Anthropic API key
            </label>
            <input
              id="anthropic-api-key"
              type="password"
              className="settings-panel__input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              spellCheck={false}
              autoComplete="off"
            />
            <p
              className={`settings-panel__status settings-panel__status--${status}`}
              role="status"
              aria-live="polite"
            >
              {status === 'none' && 'No key saved — requests use the server default (if configured).'}
              {status === 'checking' && 'Checking connection…'}
              {status === 'connected' && 'Connected — your key will be used for LLM fallback.'}
              {status === 'invalid' && 'Anthropic rejected this key. Check it and try again.'}
              {status === 'error' && 'Could not reach the server to verify this key.'}
            </p>
            <div className="settings-panel__actions">
              <button type="button" className="settings-panel__clear" onClick={handleClear}>
                Clear
              </button>
              <button type="button" className="settings-panel__save" onClick={handleSave}>
                Save &amp; verify
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
