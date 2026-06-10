import { useCallback, useEffect, useState } from 'react'
import { UIResourceRenderer } from '@mcp-ui/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorFromResponse } from './apiError'

const SAMPLE_ENDPOINTS = [
  { label: 'Users', url: 'https://jsonplaceholder.typicode.com/users' },
  { label: 'Posts', url: 'https://jsonplaceholder.typicode.com/posts' },
  { label: 'GitHub repo', url: 'https://api.github.com/repos/idosal/mcp-ui' },
  {
    label: 'Weather',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&hourly=temperature_2m',
  },
]

function Spinner() {
  return (
    <svg
      className="btn-spinner"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function PreviewSkeleton() {
  return (
    <div className="preview-skeleton" role="status" aria-label="Generating UI">
      <div className="preview-skeleton__bar w-1/3" />
      <div className="preview-skeleton__grid">
        <div className="preview-skeleton__block" />
        <div className="preview-skeleton__block" />
        <div className="preview-skeleton__block" />
      </div>
      <div className="preview-skeleton__bar w-full" />
      <div className="preview-skeleton__bar w-5/6" />
      <div className="preview-skeleton__bar w-2/3" />
      <span className="sr-only">Fetching data and composing UI…</span>
    </div>
  )
}

export function EndpointToUI({ onUIAction }) {
  const [designSystems, setDesignSystems] = useState([])
  const [designSystem, setDesignSystem] = useState('')
  const [url, setUrl] = useState(SAMPLE_ENDPOINTS[0].url)
  const [method, setMethod] = useState('GET')
  const [headersText, setHeadersText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [showSpec, setShowSpec] = useState(false)

  useEffect(() => {
    fetch('/api/design-systems')
      .then((r) => r.json())
      .then((body) => {
        const list = body.designSystems || []
        setDesignSystems(list)
        const active = list.find((s) => s.active)
        if (active) setDesignSystem(active.id)
      })
      .catch(() => {})
  }, [])

  const handleGenerate = useCallback(async () => {
    setError(null)
    let headers
    if (headersText.trim()) {
      try {
        headers = JSON.parse(headersText)
      } catch {
        setError('Headers must be valid JSON, e.g. {"Authorization": "Bearer …"}')
        return
      }
    }
    setLoading(true)
    setResult(null)
    setShowSpec(false)
    try {
      const res = await fetch('/api/render-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method,
          headers,
          instructions: instructions.trim() || undefined,
          designSystem: designSystem || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw await errorFromResponse(res, body)
      setResult(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [url, method, headersText, instructions, designSystem])

  const selectedSystem = designSystems.find((s) => s.id === designSystem)

  return (
    <div className="space-y-6">
      <Card className="builder-card">
        <CardHeader>
          <CardTitle>Endpoint → UI</CardTitle>
          <CardDescription>
            Fetch · analyse · compose. The AI layer picks components from the registered design
            system and returns an MCP UI resource.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger aria-label="HTTP method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT'].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-url">Endpoint URL</Label>
              <Input
                id="endpoint-url"
                className="font-mono text-[13px]"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && url) handleGenerate()
                }}
                placeholder="https://api.example.com/v1/orders"
                inputMode="url"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="sample-chips" role="group" aria-label="Sample endpoints">
            <span className="sample-chips__label">Try:</span>
            {SAMPLE_ENDPOINTS.map((s) => (
              <button
                key={s.url}
                type="button"
                className={`sample-chip ${url === s.url ? 'sample-chip--active' : ''}`}
                onClick={() => setUrl(s.url)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Design system</Label>
              <Select value={designSystem} onValueChange={setDesignSystem}>
                <SelectTrigger aria-label="Design system">
                  <SelectValue placeholder="Registered design systems" />
                </SelectTrigger>
                <SelectContent>
                  {designSystems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSystem && (
                <p className="field-hint">{selectedSystem.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint-headers">Headers (JSON, optional)</Label>
              <Input
                id="endpoint-headers"
                className="font-mono text-[13px]"
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder='{"Authorization": "Bearer …"}'
                spellCheck={false}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint-instructions">Instructions for the AI layer (optional)</Label>
            <Input
              id="endpoint-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. focus on geographic distribution, chart by company"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-end">
          {error && (
            <p className="builder-inline-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="button"
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading || !url}
          >
            {loading ? (
              <>
                <Spinner /> Fetching + analysing…
              </>
            ) : (
              'Generate UI'
            )}
          </Button>
        </CardFooter>
      </Card>

      {loading && <PreviewSkeleton />}

      {!loading && result?.resource && (
        <div className="generated-ui">
          <div className="generated-ui__head">
            <h3>Generated UI</h3>
            <div className="meta-chips" aria-label="Generation metadata">
              <span className="meta-chip" title="Design system used">
                {result.meta?.designSystem}
              </span>
              <span className="meta-chip" title="Planner that designed the layout">
                {result.meta?.planner}
              </span>
              <span className="meta-chip" title="Bytes fetched from the endpoint">
                {result.meta?.source?.bytes ?? '?'} B
              </span>
            </div>
          </div>
          <div className="endpoint-preview-frame">
            <UIResourceRenderer
              resource={result.resource}
              onUIAction={onUIAction}
              htmlProps={{ style: { width: '100%', minHeight: 520, border: 'none' } }}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowSpec((v) => !v)}>
            {showSpec ? 'Hide UI spec' : 'Show UI spec (AI output)'}
          </Button>
          {showSpec && (
            <pre className="spec-json" aria-label="UI spec JSON">
              {JSON.stringify(result.spec, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
