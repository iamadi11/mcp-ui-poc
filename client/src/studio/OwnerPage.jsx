import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OwnerPage({ publicId, typesafeKey }) {
  const [widget, setWidget] = useState(null)
  const [error, setError] = useState(null)
  const [themeId, setThemeId] = useState('shadcn')
  const [motion, setMotion] = useState('none')
  const [look, setLook] = useState('default')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/widgets/${publicId}`, { credentials: 'include' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Widget not found')
    setWidget(body)
    setThemeId(body.themeId || 'shadcn')
    setMotion(body.motion || 'none')
    setLook(body.look === 'vivid' ? 'vivid' : 'default')
    setSourceUrl(body.sourceUrl || '')
  }, [publicId])

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/widgets/${publicId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(typesafeKey ? { 'x-typesafe-api-key': typesafeKey } : {}) },
        body: JSON.stringify({ themeId, motion, look, sourceUrl }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 401) {
        if (body.oauth && body.loginUrl) {
          window.location.href = body.loginUrl
          return
        }
        throw new Error(body.error || 'Sign in with GitHub to edit')
      }
      if (!res.ok) throw new Error(body.error || 'Save failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const restore = async (v) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/widgets/${publicId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreVersion: v }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Restore failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setSaving(false)
    }
  }

  const live = widget?.currentVersion
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="owner-page">
      <p><a className="text-btn" href="/">Back to Studio</a></p>
      <h1>Customize widget</h1>
      <p className="muted">
        <code>{publicId}</code>
        {widget?.isOwner ? ' · you own this' : ' · sign in with GitHub to edit'}
      </p>
      {error ? <p className="studio-error">{error}</p> : null}
      <div className="owner-form">
        <Label htmlFor="theme">Theme adapter</Label>
        <select id="theme" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          <option value="shadcn">Studio (shadcn)</option>
          <option value="material">Material</option>
          <option value="plain">Editorial</option>
          <option value="glass">Glass</option>
        </select>
        <Label htmlFor="look">Color</Label>
        <select id="look" value={look} onChange={(e) => setLook(e.target.value)}>
          <option value="default">Teal</option>
          <option value="vivid">Vivid</option>
        </select>
        <Label htmlFor="motion">Motion token</Label>
        <select id="motion" value={motion} onChange={(e) => setMotion(e.target.value)}>
          <option value="none">none</option>
          <option value="enter">enter</option>
          <option value="stagger">stagger</option>
          <option value="live">live</option>
        </select>
        <Label htmlFor="source">Data source URL</Label>
        <Input id="source" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
        <Button type="button" onClick={save} disabled={saving || Boolean(widget?.owner && !widget.isOwner)}>
          Save as new live version
        </Button>
      </div>
      {widget?.versions?.length ? (
        <div className="owner-versions">
          <h2 className="settings-panel__title">Published versions</h2>
          <p className="muted">/e/{publicId} serves the live version. Pin with ?v= so an embed never moves.</p>
          <ul className="history-list">
            {widget.versions.map((item) => (
              <li key={item.v}>
                <div className={`history-item ${item.v === live ? 'history-item-on' : ''}`}>
                  <span className="history-title">
                    v{item.v}
                    {item.v === live ? ' · live' : ''}
                    {item.look === 'vivid' ? ' · vivid' : ''}
                    {item.motion && item.motion !== 'none' ? ` · ${item.motion}` : ''}
                  </span>
                  <span className="history-time">
                    {item.themeId} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </span>
                  <div className="owner-version-actions">
                    <a className="text-btn" href={`/e/${publicId}?v=${item.v}`}>
                      Open pin
                    </a>
                    {item.v !== live ? (
                      <button type="button" className="text-btn" disabled={saving} onClick={() => restore(item.v)}>
                        Make live
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>
        Live embed: <a href={`/e/${publicId}`}>{origin}/e/{publicId}</a>
        {live ? ` (v${live})` : ''}
      </p>
    </div>
  )
}
