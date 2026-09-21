import { useCallback, useEffect, useRef, useState } from 'react'
import { History, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorFromResponse } from '../apiError'
import { readApiKey, readGoogleMapsKey, readThemePack, writeThemePack } from '../storage.js'
import { readSse } from './sse.js'
import { ChatLog } from './ChatLog.jsx'
import { CanvasPreview } from './CanvasPreview.jsx'
import { ComposerBar } from './ComposerBar.jsx'
import { RecentsSidebar } from './RecentsSidebar.jsx'
import { SettingsSheet } from './SettingsSheet.jsx'
import { PublishDialog } from './PublishDialog.jsx'
import { DebugTrace } from './DebugTrace.jsx'
import {
  chatTitle,
  compactResult,
  loadHistory,
  upsertChat,
  writeHistory,
  appendVersion,
  makeVersion,
  sessionDraft,
  isArchived,
  archiveChatLocal,
  trainingRecord,
} from './history.js'

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function isDebugMode() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1'
  } catch {
    return false
  }
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

function chatIdFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('c')
  } catch {
    return null
  }
}

function setChatUrl(id) {
  try {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('c', id)
    else url.searchParams.delete('c')
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  } catch {
    /* ignore */
  }
}

function authHeaders(typesafeKey) {
  const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  const anth = readApiKey()
  if (anth) headers['x-anthropic-api-key'] = anth
  if (typesafeKey?.trim()) headers['x-typesafe-api-key'] = typesafeKey.trim()
  const maps = readGoogleMapsKey()
  if (maps) headers['x-google-maps-api-key'] = maps
  return headers
}

function mapStage(event, data) {
  if (event === 'stage' && data?.stage) return data.stage
  if (event === 'fetching' && !data?.skipped) return 'fetching'
  if (event === 'planned') return 'designing'
  if (event === 'render') return 'rendering'
  return null
}

export function Studio({
  typesafeKey = '',
  onTypesafeKeyChange = () => {},
  onUIAction,
  jevAvailable = false,
  aiAvailable = false,
  jevFromEnv = false,
  aiFromEnv = false,
  mapsFromEnv = false,
  keysUnknown = false,
}) {
  const boot = loadHistory()
  const linked = chatIdFromUrl()
  const bootChat = boot.chats.find((item) => item.id === linked) || boot.chats.find((item) => item.id === boot.activeId) || null
  const [messages, setMessages] = useState(() => bootChat?.messages || [])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(() => bootChat?.result || null)
  const [auth, setAuth] = useState({ user: null, oauth: false })
  const [publish, setPublish] = useState(null)
  const [copied, setCopied] = useState(false)
  const [stage, setStage] = useState('')
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [liveThoughts, setLiveThoughts] = useState([])
  const [livePath, setLivePath] = useState([])
  const [liveReason, setLiveReason] = useState('')
  const listRef = useRef(null)
  const inFlight = useRef(false)
  const lastPrompt = useRef('')
  const [sid, setSid] = useState(() => {
    if (bootChat?.id) {
      try { sessionStorage.setItem('mcp-studio-session', bootChat.id) } catch { /* ignore */ }
      return bootChat.id
    }
    return sessionId()
  })
  const [chats, setChats] = useState(() => boot.chats)
  const [publicId, setPublicId] = useState(() => bootChat?.publicId || null)
  const [recentsOpen, setRecentsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('keys')
  const [publishOpen, setPublishOpen] = useState(false)
  const [chipsOpen, setChipsOpen] = useState(true)
  const [pack, setPack] = useState(() => readThemePack())
  const debug = isDebugMode()
  const fromEnv = Boolean(jevFromEnv || aiFromEnv)
  const envKeys = fromEnv || jevAvailable || aiAvailable
  const keysReady = !keysUnknown
  const missingKey = keysReady && !envKeys && !typesafeKey.trim() && !readApiKey()

  const persist = useCallback((nextSid, nextMessages, nextResult, opts = {}) => {
    if (!nextSid) return loadHistory().chats
    if (!(nextMessages || []).length && !nextResult) return loadHistory().chats
    const prev = loadHistory().chats.find((item) => item.id === nextSid)
    let nextVersions = opts.versions || prev?.versions || []
    if (opts.recordVersion && nextResult) {
      const prompt = opts.prompt || [...(nextMessages || [])].reverse().find((m) => m.role === 'user')?.text || ''
      nextVersions = appendVersion(nextVersions, makeVersion(prompt, nextResult))
    }
    const nextPublicId = opts.publicId !== undefined ? opts.publicId : prev?.publicId || null
    const nextActive = opts.activeVersionId || nextResult?.componentId || prev?.activeVersionId || null
    const chat = {
      id: nextSid,
      title: chatTitle(nextMessages),
      messages: nextMessages || [],
      result: compactResult(nextResult),
      versions: nextVersions,
      publicId: nextPublicId,
      activeVersionId: nextActive,
      updatedAt: new Date().toISOString(),
    }
    if (isArchived(nextSid)) {
      archiveChatLocal(chat)
      return loadHistory().chats
    }
    const nextChats = upsertChat(loadHistory().chats, chat)
    setChats(nextChats)
    writeHistory({ chats: nextChats, activeId: nextSid })
    if (opts.syncState) {
      setPublicId(nextPublicId)
    }
    return nextChats
  }, [])

  useEffect(() => {
    if (!recentsOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setRecentsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [recentsOpen])

  useEffect(() => {
    setChatUrl(sid)
  }, [sid])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then(setAuth)
      .catch(() => {})
  }, [])

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' })
  }, [messages, liveThoughts, busy])

  useEffect(() => {
    if (!busy || prefersReducedMotion()) {
      setShowSkeleton(false)
      return undefined
    }
    const timer = setTimeout(() => setShowSkeleton(true), 1000)
    return () => clearTimeout(timer)
  }, [busy])

  useEffect(() => {
    const chat = loadHistory().chats.find((item) => item.id === sid)
    const draftWidget = sessionDraft(chat?.result)
    if (!sid || !draftWidget) return undefined
    let cancelled = false
    fetch('/api/chat/restore', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(typesafeKey),
      body: JSON.stringify({ sessionId: sid, widget: draftWidget }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.html) return
        setResult(body)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sid, typesafeKey])

  const send = useCallback(
    async (text, opts = {}) => {
      const message = (text ?? draft).trim()
      const session = opts.sessionId || sid
      if (!message || inFlight.current) return
      if (missingKey && !opts.force) {
        setError('Add an API key in Settings to generate')
        setSettingsTab('keys')
        setSettingsOpen(true)
        return
      }
      lastPrompt.current = message
      inFlight.current = true
      setDraft('')
      setError(null)
      setPublish(null)
      setBusy(true)
      setStage('designing')
      setChipsOpen(true)
      setLiveThoughts([{ thought: 'Working on this turn.' }])
      setLivePath([])
      setLiveReason('')
      const pending = [...messages, { role: 'user', text: message }]
      setMessages(pending)
      const turnThoughts = []
      const priorUsers = messages
        .filter((item) => item.role === 'user' && item.text)
        .slice(-8)
        .map((item) => ({ role: 'user', text: String(item.text).slice(0, 500) }))
      const goal = priorUsers[0]?.text || message
      try {
        const res = await fetch('/api/chat/turn', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(typesafeKey),
          body: JSON.stringify({
            message,
            sessionId: session,
            stream: true,
            fresh: true,
            themePack: pack || undefined,
            goal,
            history: priorUsers,
          }),
        })
        if (!res.ok) throw await errorFromResponse(res)
        const rendered = await readSse(res, (event, data) => {
          const nextStage = mapStage(event, data)
          if (nextStage) setStage(nextStage)
          if (event === 'trace' || event === 'thought') {
            const rec = data || {}
            const thought = rec.thought || rec.text || rec.reason
            if (thought) {
              turnThoughts.push({ ...rec, thought })
              setLiveThoughts([...turnThoughts])
            }
            if (Array.isArray(rec.path) && rec.path.length) {
              setLivePath(rec.path)
              if (rec.reason) setLiveReason(rec.reason)
            }
          }
          if (event === 'rendered') {
            const metaThoughts = Array.isArray(data?.meta?.thoughts) ? data.meta.thoughts : []
            for (const rec of metaThoughts) {
              const thought = rec?.thought || rec?.text
              if (thought && !turnThoughts.some((item) => item.thought === thought)) {
                turnThoughts.push({ ...rec, thought })
              }
            }
            setResult(data)
            setStage('')
            setLiveThoughts([])
            setMessages((prev) => {
              const thoughtText = turnThoughts.map((item) => item.thought).filter(Boolean).slice(-8).join('\n')
              const next = thoughtText ? [...prev, { role: 'thought', text: thoughtText }] : [...prev]
              persist(session, next, data, { recordVersion: true, syncState: true })
              return next
            })
          }
          if (event === 'error') {
            const msg = data.error || 'Turn failed'
            setError(msg)
            setLiveThoughts([])
            setMessages((prev) => {
              const thoughtText = turnThoughts.map((item) => item.thought).filter(Boolean).slice(-8).join('\n')
              const next = [
                ...(thoughtText ? [...prev, { role: 'thought', text: thoughtText }] : prev),
                { role: 'assistant', text: msg },
              ]
              persist(session, next, null)
              return next
            })
          }
        })
        if (rendered) setResult(rendered)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Turn failed'
        setError(msg)
        setLiveThoughts([])
        setMessages((prev) => [...prev, { role: 'assistant', text: msg }])
      } finally {
        inFlight.current = false
        setBusy(false)
        setStage('')
      }
    },
    [draft, messages, missingKey, pack, persist, sid, typesafeKey],
  )

  const openChat = useCallback((chat) => {
    if (!chat || inFlight.current) return
    const nextChats = persist(sid, messages, result)
    try { sessionStorage.setItem('mcp-studio-session', chat.id) } catch { /* ignore */ }
    setSid(chat.id)
    setMessages(chat.messages || [])
    setResult(chat.result || null)
    setPublicId(chat.publicId || null)
    setDraft('')
    setError(null)
    setPublish(null)
    setChipsOpen(true)
    setLiveThoughts([])
    writeHistory({ chats: nextChats, activeId: chat.id })
    setRecentsOpen(false)
  }, [messages, persist, result, sid])

  const newChat = useCallback(() => {
    if (inFlight.current) return
    const nextChats = persist(sid, messages, result)
    const nextSid = newSessionId()
    setSid(nextSid)
    setMessages([])
    setDraft('')
    setError(null)
    setResult(null)
    setPublicId(null)
    setPublish(null)
    setChipsOpen(true)
    setLiveThoughts([])
    setLivePath([])
    setLiveReason('')
    setStage('')
    setRecentsOpen(false)
    writeHistory({ chats: nextChats, activeId: nextSid })
  }, [messages, persist, result, sid])

  const resetSession = useCallback((nextChats, activeId = null) => {
    const nextSid = newSessionId()
    setSid(nextSid)
    setMessages([])
    setDraft('')
    setError(null)
    setResult(null)
    setPublicId(null)
    setPublish(null)
    writeHistory({ chats: nextChats, activeId: activeId || nextSid })
  }, [])

  const removeChat = useCallback(async (chat) => {
    if (!chat?.id || inFlight.current) return
    persist(sid, messages, result)
    const latest = chat.id === sid
      ? loadHistory().chats.find((item) => item.id === sid) || chat
      : chat
    try {
      await fetch('/api/chat/archive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingRecord(archiveChatLocal(latest))),
      })
    } catch {
      archiveChatLocal(latest)
    }
    const nextChats = loadHistory().chats.filter((item) => item.id !== chat.id)
    setChats(nextChats)
    if (chat.id === sid) resetSession(nextChats)
    else writeHistory({ chats: nextChats, activeId: sid })
  }, [messages, persist, resetSession, result, sid])

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
          publicId: publicId || undefined,
          themeId: result?.themeId || result?.meta?.designSystem,
          themePack: pack || result?.themePack,
          motion: result?.motion || result?.meta?.motion,
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
      setPublicId(body.publicId)
      setPublishOpen(true)
      persist(sid, messages, result, { publicId: body.publicId, syncState: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    }
  }, [messages, pack, persist, publicId, result, sid])

  const applyPack = useCallback(async (nextPack) => {
    setPack(nextPack)
    writeThemePack(nextPack)
    if (!result || inFlight.current) return
    setBusy(true)
    try {
      const res = await fetch('/api/chat/customize', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(typesafeKey),
        body: JSON.stringify({
          sessionId: sid,
          publicId: publicId || undefined,
          themePack: nextPack,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not apply look')
      setResult(body)
      persist(sid, messages, body, { recordVersion: true, prompt: 'Connect look', syncState: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply look')
    } finally {
      setBusy(false)
    }
  }, [messages, persist, publicId, result, sid, typesafeKey])

  const snippet = publish
    ? publish.snippet || `<iframe src="${window.location.origin}${publish.embedUrl}" title="MCP UI widget" loading="lazy" style="width:100%;min-height:420px;border:0"></iframe>`
    : ''

  return (
    <div className="studio-shell">
      <RecentsSidebar
        open={recentsOpen}
        chats={chats}
        activeId={sid}
        busy={busy}
        onOpen={openChat}
        onNew={newChat}
        onRemove={removeChat}
        onClose={() => setRecentsOpen(false)}
      />
      <div className="studio-journey">
        <header className="journey-head">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Recents" onClick={() => setRecentsOpen((v) => !v)}>
            <History />
          </Button>
          <div className="brand-copy">
            <p className="kicker">MCP UI</p>
            <h1>Studio</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {auth.oauth && !auth.user ? <a className="text-btn" href="/api/auth/github">GitHub</a> : null}
            {auth.user ? <span className="status-meta">@{auth.user.login}</span> : null}
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Settings" onClick={() => { setSettingsTab('keys'); setSettingsOpen(true) }}>
              <Settings />
            </Button>
          </div>
        </header>
        <div className={`studio-split${result || busy ? ' has-widget' : ''}`}>
          <CanvasPreview
            result={result}
            busy={busy}
            stage={stage}
            showSkeleton={showSkeleton}
            error={error}
            onPublish={publishWidget}
            onTryAgain={() => lastPrompt.current && send(lastPrompt.current, { force: true })}
            onOpenSettings={() => { setSettingsTab('keys'); setSettingsOpen(true) }}
            missingKey={missingKey && !result}
            keysReady={keysReady}
            fromEnv={fromEnv}
            onUIAction={onUIAction}
          />
          <aside className="journey-log">
            {messages.length || busy ? (
              <ChatLog messages={messages} thoughts={liveThoughts} pending={busy} listRef={listRef} />
            ) : (
              <div className="arrive-copy">
                <h2>Describe a UI</h2>
                <p>See it live. Talk to change it. Share an embed.</p>
              </div>
            )}
            {debug ? (
              <DebugTrace
                thoughts={liveThoughts}
                path={livePath}
                reason={liveReason}
                pending={busy}
              />
            ) : null}
            <ComposerBar
              draft={draft}
              onDraft={setDraft}
              onSend={send}
              busy={busy}
              empty={!result}
              result={result}
              chipsVisible={chipsOpen}
              onDismissChips={() => setChipsOpen(false)}
              onOpenLook={() => { setSettingsTab('look'); setSettingsOpen(true) }}
            />
          </aside>
        </div>
      </div>
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        typesafeKey={typesafeKey}
        onTypesafeKeyChange={onTypesafeKeyChange}
        pack={pack}
        onPack={applyPack}
        initialTab={settingsTab}
        jevFromEnv={jevFromEnv || jevAvailable}
        aiFromEnv={aiFromEnv || aiAvailable}
        mapsFromEnv={mapsFromEnv}
      />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        snippet={snippet}
        embedUrl={publish ? `${window.location.origin}/e/${publish.publicId}` : ''}
        copied={copied}
        onCopy={async () => {
          await navigator.clipboard.writeText(snippet)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      />
    </div>
  )
}
