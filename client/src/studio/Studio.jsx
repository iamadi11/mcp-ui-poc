import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, ThumbsDown, ThumbsUp, Copy, Upload, MessageSquarePlus, MessageSquare, Library } from 'lucide-react'
import { UIResourceRenderer } from '@mcp-ui/client'
import { Button } from '@/components/ui/button'
import { errorFromResponse } from '../apiError'
import { readApiKey } from '../storage.js'
import { readSse } from './sse.js'
import { ExamplesPanel } from './ExamplesPanel.jsx'

const SAMPLE_URLS = [
  { label: 'Users', url: 'https://jsonplaceholder.typicode.com/users' },
  { label: 'Posts', url: 'https://jsonplaceholder.typicode.com/posts' },
  { label: 'Weather', url: 'https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&hourly=temperature_2m' },
]

const CREATE_STARTERS = [
  { label: 'Dashboard', value: 'Create a dashboard from this API' },
  { label: 'Table', value: 'Show as a table' },
  { label: 'Chart', value: 'Show as a bar chart' },
  { label: 'Embed widget', value: 'Single embeddable component' },
]

const ITERATE_STARTERS = [
  { label: 'Add tooltip', value: 'add tooltip on the chart' },
  { label: 'Hide table', value: 'hide the table' },
  { label: 'Bar chart', value: 'make it a bar chart' },
  { label: 'Chart only', value: 'show only the chart' },
]

const STEP_LABELS = {
  routed: 'Routed',
  fetching: 'Fetch',
  planned: 'Plan',
  render: 'Render',
}

function upsertStep(steps, step, data) {
  const rec = { step, ...data }
  const index = steps.findIndex((item) => item.step === step)
  if (index === -1) return [...steps, rec]
  const next = [...steps]
  next[index] = rec
  return next
}

function MetricsCard({ steps, totalMs, planner, pending }) {
  if (!steps.length && !pending) return null
  return (
    <div className="metrics-card" aria-label="Turn timings">
      {steps.map((item) => {
        const label = STEP_LABELS[item.step] || item.step
        let detail = ''
        if (item.status === 'start') detail = '…'
        else if (item.skipped) detail = 'skipped'
        else if (typeof item.ms === 'number') detail = `${item.ms}ms`
        const extra = [
          item.plannerLabel,
          typeof item.jevConfidence === 'number' ? `${Math.round(item.jevConfidence * 100)}%` : null,
          item.bytes != null ? `${item.bytes} B` : null,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={item.step} className="metrics-row">
            <span className="metrics-step">{label}</span>
            <span className="metrics-ms">{detail}</span>
            {extra ? <span className="metrics-extra">{extra}</span> : null}
          </div>
        )
      })}
      {totalMs != null ? (
        <div className="metrics-row metrics-total">
          <span className="metrics-step">Total</span>
          <span className="metrics-ms">{totalMs}ms</span>
          {planner ? <span className="metrics-extra">{planner}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

function newSessionId() {
  try {
    const id = globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}`
    sessionStorage.setItem('mcp-studio-session', id)
    return id
  } catch {
    return `s-${Date.now()}`
  }
}

function sessionId() {
  try {
    const existing = sessionStorage.getItem('mcp-studio-session')
    if (existing) return existing
    return newSessionId()
  } catch {
    return `s-${Date.now()}`
  }
}

function authHeaders(typesafeKey) {
  const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  const anth = readApiKey()
  if (anth) headers['x-anthropic-api-key'] = anth
  if (typesafeKey?.trim()) headers['x-typesafe-api-key'] = typesafeKey.trim()
  return headers
}

export function Studio({ typesafeKey = '', onUIAction, decisionStore }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [urlChip, setUrlChip] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [rating, setRating] = useState(null)
  const [auth, setAuth] = useState({ user: null, oauth: false })
  const [publish, setPublish] = useState(null)
  const [copied, setCopied] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState([])
  const listRef = useRef(null)
  const inFlight = useRef(false)
  const [sid, setSid] = useState(() => sessionId())
  const [pane, setPane] = useState('chat')

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then(setAuth)
      .catch(() => {})
  }, [])

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' })
  }, [messages, status])

  const send = useCallback(
    async (text, opts = {}) => {
      const message = (text ?? draft).trim()
      const url = String(opts.url ?? urlChip).trim()
      const session = opts.sessionId || sid
      if (!message || inFlight.current) return
      inFlight.current = true
      setDraft('')
      setError(null)
      setPublish(null)
      setRating(null)
      setLiveMetrics([])
      setBusy(true)
      setStatus('routed')
      setMessages((prev) => [...prev, { role: 'user', text: message }])
      try {
        const res = await fetch('/api/chat/turn', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(typesafeKey),
          body: JSON.stringify({
            message,
            url: url || undefined,
            sessionId: session,
            stream: true,
          }),
        })
        if (!res.ok) throw await errorFromResponse(res)
        const rendered = await readSse(res, (event, data) => {
          if (event === 'routed' || event === 'fetching' || event === 'planned' || event === 'render') {
            setLiveMetrics((prev) => upsertStep(prev, event, data || {}))
            if (event === 'fetching' && data?.status === 'start') setStatus('fetching')
            else if (event === 'planned' && data?.status === 'start') setStatus('planning')
            else if (event === 'planned') setStatus(`planned · ${data.plannerLabel || data.planner || ''}`)
            else setStatus(event)
          }
          if (event === 'rendered') {
            setResult(data)
            const src = data.meta?.source?.url
            if (src) setUrlChip((cur) => cur || src)
            const steps = data.meta?.timings || []
            setLiveMetrics(steps)
            setStatus(`rendered · ${data.meta?.plannerLabel || ''} · ${data.meta?.totalMs ?? data.meta?.latencyMs ?? '?'}ms`)
            setMessages((prev) => [
              ...prev,
              {
                role: 'metrics',
                steps,
                totalMs: data.meta?.totalMs ?? data.meta?.latencyMs,
                planner: data.meta?.plannerLabel,
              },
            ])
          }
          if (event === 'error') {
            const msg = data.error || 'Turn failed'
            setError(msg)
            setMessages((prev) => [...prev, { role: 'assistant', text: msg }])
          }
        })
        if (rendered) setResult(rendered)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Turn failed'
        setError(msg)
        setMessages((prev) => [...prev, { role: 'assistant', text: msg }])
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [draft, sid, typesafeKey, urlChip],
  )

  const runExample = useCallback(
    (example) => {
      if (!example?.prompt || inFlight.current) return
      const nextSid = newSessionId()
      setSid(nextSid)
      setMessages([])
      setDraft('')
      setStatus('')
      setError(null)
      setResult(null)
      setRating(null)
      setPublish(null)
      setLiveMetrics([])
      setUrlChip(example.url)
      setPane('chat')
      send(example.prompt, { url: example.url, sessionId: nextSid })
    },
    [send],
  )

  const newChat = useCallback(() => {
    if (inFlight.current) return
    setSid(newSessionId())
    setMessages([])
    setDraft('')
    setStatus('')
    setError(null)
    setResult(null)
    setRating(null)
    setPublish(null)
    setLiveMetrics([])
  }, [])

  const rate = useCallback(
    async (value) => {
      const decisionId = result?.meta?.decisionId || result?.componentId
      if (!decisionId) return
      setRating(value)
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decisionId, rating: value }),
        })
      } catch {
        /* ratings are best-effort */
      }
    },
    [result],
  )

  const publishWidget = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          decisionId: result?.componentId,
          origin: window.location.origin,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        if (body.oauth && body.loginUrl) {
          window.location.href = body.loginUrl
          return
        }
        throw new Error(body.error || 'Sign in with GitHub to publish')
      }
      if (!res.ok) throw new Error(body.error || 'Publish failed')
      setPublish(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    }
  }, [result, sid])

  const snippet = publish
    ? publish.snippet || `<iframe src="${window.location.origin}${publish.embedUrl}" title="MCP UI widget" loading="lazy" style="width:100%;min-height:420px;border:0"></iframe>`
    : ''

  return (
    <div className="studio">
      <section className="studio-chat" aria-label={pane === 'examples' ? 'Examples' : 'Chat'}>
        <div className="studio-chat-head">
          <div className="studio-tabs" role="tablist" aria-label="Studio">
            <button
              type="button"
              role="tab"
              id="studio-tab-chat"
              aria-controls="studio-panel-chat"
              aria-selected={pane === 'chat'}
              className={`studio-tab ${pane === 'chat' ? 'studio-tab-on' : ''}`}
              onClick={() => setPane('chat')}
            >
              <MessageSquare size={14} />
              Chat
            </button>
            <button
              type="button"
              role="tab"
              id="studio-tab-examples"
              aria-controls="studio-panel-examples"
              aria-selected={pane === 'examples'}
              className={`studio-tab ${pane === 'examples' ? 'studio-tab-on' : ''}`}
              onClick={() => setPane('examples')}
            >
              <Library size={14} />
              Examples
            </button>
          </div>
          {pane === 'chat' ? (
            <Button type="button" variant="outline" size="sm" onClick={newChat} disabled={busy}>
              <MessageSquarePlus size={14} />
              New chat
            </Button>
          ) : null}
        </div>
        {pane === 'examples' ? (
          <div id="studio-panel-examples" role="tabpanel" aria-labelledby="studio-tab-examples" className="examples-wrap">
            <ExamplesPanel onSend={runExample} busy={busy} />
          </div>
        ) : (
        <div id="studio-panel-chat" role="tabpanel" aria-labelledby="studio-tab-chat" className="chat-panel">
        <div className="studio-chips" role="list">
          {SAMPLE_URLS.map((item) => (
            <button
              key={item.url}
              type="button"
              className={`chip ${urlChip === item.url ? 'chip-on' : ''}`}
              onClick={() => setUrlChip((cur) => (cur === item.url ? '' : item.url))}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="studio-url">
          API URL
        </label>
        <input
          id="studio-url"
          className="url-paste"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck="false"
          placeholder="Paste an API URL"
          value={urlChip}
          onChange={(e) => setUrlChip(e.target.value)}
        />
        {result ? (
          <p className="iterate-hint">Editing this widget. New chat starts a fresh one.</p>
        ) : null}
        <div className="studio-chips" role="list">
          {(result ? ITERATE_STARTERS : CREATE_STARTERS).map((item) => (
            <button
              key={item.label}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => send(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chat-log" ref={listRef}>
          {messages.length === 0 && (
            <p className="chat-empty">Pin an API, then ask for a dashboard. Follow-ups upgrade this widget.</p>
          )}
          {messages.map((m, i) => (
            m.role === 'metrics' ? (
              <MetricsCard key={`metrics-${i}`} steps={m.steps || []} totalMs={m.totalMs} planner={m.planner} />
            ) : (
              <div key={`${m.role}-${i}`} className={`bubble bubble-${m.role}`}>
                {m.text}
              </div>
            )
          ))}
          {busy && liveMetrics.length && messages[messages.length - 1]?.role !== 'metrics' ? (
            <MetricsCard steps={liveMetrics} pending />
          ) : null}
        </div>
        {status ? (
          <p className="stream-status" role="status">
            {busy && <Loader2 className="spin" size={14} aria-hidden />}
            {status}
          </p>
        ) : null}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <label className="sr-only" htmlFor="studio-draft">
            Message
          </label>
          <textarea
            id="studio-draft"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask for a dashboard, then iterate: add tooltip, hide the table…"
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send">
            <Send size={16} />
            Send
          </Button>
        </form>
        </div>
        )}
      </section>

      <section className="studio-preview" aria-label="Preview">
        <header className="preview-toolbar">
          <span className="studio-pane-label">Preview</span>
          <span className="preview-meta">
            {result?.meta?.plannerLabel || '—'}
            {decisionStore ? ` · ${decisionStore}` : ''}
          </span>
          <div className="preview-actions">
            <Button type="button" variant="outline" size="sm" disabled={!result} onClick={() => rate('up')} aria-pressed={rating === 'up'}>
              <ThumbsUp size={14} />
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!result} onClick={() => rate('down')} aria-pressed={rating === 'down'}>
              <ThumbsDown size={14} />
            </Button>
            <Button type="button" size="sm" disabled={!result || busy} onClick={publishWidget}>
              <Upload size={14} />
              Publish
            </Button>
          </div>
        </header>
        {error ? <p className="studio-error">{error}</p> : null}
        {publish ? (
          <div className="publish-box">
            <code>{`${window.location.origin}${publish.embedUrl}`}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(snippet)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              <Copy size={14} />
              {copied ? 'Copied' : 'Copy iframe'}
            </Button>
            {auth.user ? <span className="muted">Owner: {auth.user.login}</span> : (
              <span className="muted">{publish.anonymous ? 'Unlisted link — GitHub optional for owner edits' : null}</span>
            )}
          </div>
        ) : null}
        <div className="preview-frame">
          {busy && !result ? <div className="preview-skeleton" role="status" aria-label="Generating" /> : null}
          {result?.resource ? (
            <UIResourceRenderer
              resource={result.resource}
              onUIAction={onUIAction}
              htmlProps={{ style: { width: '100%', minHeight: 420, border: 'none' } }}
            />
          ) : (
            !busy && <p className="chat-empty">The live widget appears here.</p>
          )}
        </div>
      </section>
    </div>
  )
}
