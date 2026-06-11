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

const STATUS_LABEL = {
  none: 'AI key',
  checking: 'Checking key…',
  connected: 'Connected to Claude',
  invalid: 'Key invalid',
  error: 'Could not verify',
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(() => readApiKey())
  const [status, setStatus] = useState(() => (readApiKey() ? 'checking' : 'none'))

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
          className={`settings-panel__dot settings-panel__dot--${status}`}
          aria-hidden="true"
        />
        <span>{STATUS_LABEL[status]}</span>
      </button>
      {open && (
        <div
          id="settings-panel-body"
          className="settings-panel__body"
          role="region"
          aria-labelledby="settings-panel-trigger"
        >
          <div className="settings-panel__head">
            <span className="settings-panel__title">Anthropic API key</span>
          </div>
          <p className="settings-panel__hint">
            Used client-side only. Sent with each generate request as a header so the AI
            planner runs with your own key — never stored on the server.
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
            {status === 'connected' && 'Connected — your key will be used for AI planning.'}
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
        </div>
      )}
    </div>
  )
}
