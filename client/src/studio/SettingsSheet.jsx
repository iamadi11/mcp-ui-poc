import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { readApiKey, writeApiKey, readGoogleMapsKey, writeGoogleMapsKey } from '../storage.js'

export function SettingsSheet({
  open,
  onOpenChange,
  typesafeKey = '',
  onTypesafeKeyChange = () => {},
  pack,
  onPack,
  initialTab = 'keys',
  jevFromEnv = false,
  aiFromEnv = false,
  mapsFromEnv = false,
}) {
  const [tab, setTab] = useState(initialTab)
  const [key, setKey] = useState(() => readApiKey())
  const [status, setStatus] = useState(() => (readApiKey() ? 'checking' : 'none'))
  const [jevStatus, setJevStatus] = useState('none')
  const [mapsKey, setMapsKey] = useState(() => readGoogleMapsKey())
  const [mapsStatus, setMapsStatus] = useState(() => (readGoogleMapsKey() ? 'saved' : 'none'))
  const [cssText, setCssText] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState(null)
  const [packError, setPackError] = useState('')
  const [starters, setStarters] = useState([])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

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
      setJevStatus(jevFromEnv ? 'env' : 'none')
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
  }, [jevFromEnv])

  useEffect(() => {
    const stored = readApiKey()
    if (stored) verify(stored)
    else setStatus(aiFromEnv ? 'env' : 'none')
  }, [verify, aiFromEnv])

  useEffect(() => {
    if (typesafeKey) verifyJev(typesafeKey)
    else setJevStatus(jevFromEnv ? 'env' : 'none')
  }, [typesafeKey, verifyJev, jevFromEnv])

  useEffect(() => {
    fetch('/api/design-packs')
      .then((r) => r.json())
      .then((body) => setStarters(body.packs || []))
      .catch(() => {})
  }, [])

  const previewPack = async (payload) => {
    setPackError('')
    try {
      const res = await fetch('/api/design-packs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not preview')
      setPreview(body)
      onPack(body.pack)
    } catch (err) {
      setPackError(err instanceof Error ? err.message : 'Could not preview')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Paste a key for this browser, or use keys from `.env.local` on the local server.</SheetDescription>
        </SheetHeader>
        <div className="flex gap-2 px-4">
          <Button type="button" size="sm" variant={tab === 'keys' ? 'secondary' : 'ghost'} onClick={() => setTab('keys')}>
            Keys
          </Button>
          <Button type="button" size="sm" variant={tab === 'look' ? 'secondary' : 'ghost'} onClick={() => setTab('look')}>
            Connect your look
          </Button>
        </div>
        {tab === 'keys' ? (
          <div className="flex flex-col gap-6 p-4">
            <section className="flex flex-col gap-2">
              <Label htmlFor="typesafe-api-key">TypeSafe / Jev key</Label>
              <p className="text-sm text-muted-foreground">Optional. The server uses `.env.local` when this field is empty.</p>
              <Input
                id="typesafe-api-key"
                type="password"
                value={typesafeKey}
                onChange={(e) => onTypesafeKeyChange(e.target.value)}
                placeholder="apikey…"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-sm text-muted-foreground" role="status">
                {jevStatus === 'connected'
                  ? 'Connected.'
                  : jevStatus === 'invalid'
                    ? 'TypeSafe rejected this key.'
                    : jevStatus === 'error'
                      ? 'Could not verify this key.'
                      : jevFromEnv || jevStatus === 'env'
                        ? 'Connected from the server (.env.local).'
                        : jevStatus === 'checking'
                          ? 'Checking…'
                          : 'Optional here. Local servers use TYPESAFE_API_KEY from .env.local.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { onTypesafeKeyChange(''); setJevStatus(jevFromEnv ? 'env' : 'none') }}>Clear</Button>
                <Button type="button" size="sm" onClick={() => verifyJev(typesafeKey.trim())}>Verify</Button>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <Label htmlFor="anthropic-api-key">Anthropic API key</Label>
              <p className="text-sm text-muted-foreground">Optional copy and out-of-catalog generate. Kept in this tab session only (cleared when the tab closes).</p>
              <Input
                id="anthropic-api-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-sm text-muted-foreground" role="status">
                {status === 'connected'
                  ? 'Connected.'
                  : status === 'invalid'
                    ? 'Anthropic rejected this key.'
                    : status === 'error'
                      ? 'Could not verify this key.'
                      : status === 'env' || aiFromEnv
                        ? 'Connected from the server (.env.local).'
                        : status === 'checking'
                          ? 'Checking…'
                          : 'Optional copy and generate. Local servers use ANTHROPIC_API_KEY from .env.local.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { writeApiKey(''); setKey(''); setStatus(aiFromEnv ? 'env' : 'none') }}>Clear</Button>
                <Button type="button" size="sm" onClick={() => { writeApiKey(key.trim()); verify(key.trim()) }}>Save</Button>
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <Label htmlFor="google-maps-api-key">Google Maps API key</Label>
              <p className="text-sm text-muted-foreground">Browser key for map workspaces. Kept in this tab session only. Never stored on the widget.</p>
              <Input
                id="google-maps-api-key"
                type="password"
                value={mapsKey}
                onChange={(e) => { setMapsKey(e.target.value); setMapsStatus('none') }}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-sm text-muted-foreground" role="status">
                {mapsStatus === 'saved'
                  ? 'Saved for this tab session.'
                  : mapsFromEnv
                    ? 'Using GOOGLE_MAPS_API_KEY from the server (.env.local).'
                    : 'Optional unless you generate a map.'}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { writeGoogleMapsKey(''); setMapsKey(''); setMapsStatus('none') }}>Clear</Button>
                <Button type="button" size="sm" onClick={() => { writeGoogleMapsKey(mapsKey.trim()); setMapsStatus(mapsKey.trim() ? 'saved' : 'none') }}>Save</Button>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <p className="text-sm text-muted-foreground">Starter packs, paste CSS variables, or upload tokens.json. Live sample of login and landing — no Jev call.</p>
            <div className="flex flex-wrap gap-2">
              {starters.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={pack?.id === item.id ? 'secondary' : 'outline'}
                  onClick={() => previewPack({ starter: item.id })}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            <Label htmlFor="pack-css">Paste CSS variables</Label>
            <textarea
              id="pack-css"
              className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
              value={cssText}
              onChange={(e) => setCssText(e.target.value)}
              placeholder=":root { --background: #fff; --primary: #0F766E; --radius: 8px; }"
            />
            <Button type="button" size="sm" variant="outline" disabled={!cssText.trim()} onClick={() => previewPack({ css: cssText })}>
              Preview CSS
            </Button>
            <Label htmlFor="pack-json">tokens.json</Label>
            <textarea
              id="pack-json"
              className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{"tokens":{"accent":"#b45309"}}'
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={!jsonText.trim()} onClick={() => previewPack({ tokensJson: jsonText })}>
                Preview JSON
              </Button>
              <label className="inline-flex items-center">
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const text = await file.text()
                    setJsonText(text)
                    previewPack({ tokensJson: text })
                  }}
                />
                <span className="text-sm text-primary underline-offset-4 hover:underline">Upload JSON</span>
              </label>
            </div>
            {packError ? <p className="text-sm text-destructive">{packError}</p> : null}
            {preview ? (
              <div className="grid gap-3">
                <iframe title="Login sample" className="h-48 w-full rounded-md border border-border" srcDoc={preview.loginHtml} />
                <iframe title="Landing sample" className="h-48 w-full rounded-md border border-border" srcDoc={preview.landingHtml} />
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
