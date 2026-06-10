import { useState } from 'react'
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

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(() => readApiKey())
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    writeApiKey(key.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const handleClear = () => {
    writeApiKey('')
    setKey('')
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
        <span>{readApiKey() ? 'AI key set' : 'AI key'}</span>
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
          <input
            type="password"
            className="settings-panel__input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="settings-panel__actions">
            <button type="button" className="settings-panel__clear" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="settings-panel__save" onClick={handleSave}>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
