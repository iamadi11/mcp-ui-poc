import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OwnerPage({ publicId, typesafeKey }) {
  const [widget, setWidget] = useState(null)
  const [error, setError] = useState(null)
  const [themeId, setThemeId] = useState('shadcn')
  const [motion, setMotion] = useState('none')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/widgets/${publicId}`, { credentials: 'include' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Widget not found')
    setWidget(body)
    setThemeId(body.themeId || 'shadcn')
    setMotion(body.motion || 'none')
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
        body: JSON.stringify({ themeId, motion, sourceUrl }),
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

  return (
    <div className="owner-page">
      <h1>Customize widget</h1>
      <p className="muted">
        <code>{publicId}</code>
        {widget?.isOwner ? ' · you own this' : ' · sign in with GitHub to edit'}
      </p>
      {error ? <p className="studio-error">{error}</p> : null}
      <div className="owner-form">
        <Label htmlFor="theme">Theme adapter</Label>
        <select id="theme" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          <option value="shadcn">shadcn</option>
          <option value="material">material</option>
          <option value="plain">plain</option>
          <option value="glass">glass</option>
        </select>
        <Label htmlFor="motion">Motion token</Label>
        <select id="motion" value={motion} onChange={(e) => setMotion(e.target.value)}>
          <option value="none">none</option>
          <option value="enter">enter</option>
          <option value="stagger">stagger</option>
          <option value="live">live</option>
        </select>
        <Label htmlFor="source">Data source URL</Label>
        <Input id="source" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        <Button type="button" onClick={save} disabled={saving || !widget?.isOwner}>
          Save version
        </Button>
      </div>
      <p>
        Embed: <a href={`/e/${publicId}`}>/e/{publicId}</a>
        {widget?.version ? `?v=${widget.version}` : ''}
      </p>
    </div>
  )
}
