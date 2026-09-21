import { useEffect, useMemo, useRef } from 'react'
import { UIResourceRenderer } from '@mcp-ui/client'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STAGE_COPY = {
  fetching: 'Fetching data',
  designing: 'Designing layout',
  rendering: 'Rendering',
}

function widgetHtml(result) {
  if (typeof result?.html === 'string' && result.html.trim()) return result.html
  const nested = result?.resource?.text
    || result?.resource?.resource?.text
    || result?.resource?.contents?.[0]?.text
  return typeof nested === 'string' ? nested : ''
}

function looksLikeMissingKey(error) {
  return /add (a )?(typesafe|anthropic) key|no anthropic key configured|no typesafe key/i.test(String(error || ''))
}

export function CanvasPreview({
  result,
  busy,
  stage,
  showSkeleton,
  error,
  onPublish,
  onTryAgain,
  onOpenSettings,
  missingKey,
  keysReady = false,
  fromEnv = false,
  onUIAction,
}) {
  const copy = STAGE_COPY[stage] || (busy ? 'Designing layout' : '')
  const html = useMemo(() => widgetHtml(result), [result])
  const hasWidget = Boolean(html || result?.resource)
  const frameRef = useRef(null)
  const hostRef = useRef(null)
  const src = useMemo(() => {
    if (!html) return ''
    return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  }, [html])
  const showMissingKey = Boolean(keysReady) && !fromEnv && missingKey && !hasWidget && !busy && !error
  const keyError = Boolean(error && looksLikeMissingKey(error) && !fromEnv)
  const coverPreview = busy && !hasWidget

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src)
  }, [src])

  useEffect(() => {
    function onMessage(event) {
      const data = event?.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'notify' || data.type === 'link') onUIAction?.(data)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onUIAction])

  useEffect(() => {
    const node = frameRef.current
    const host = hostRef.current
    if (!node || !host) return undefined
    const paint = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (width < 8 || height < 8) return
      node.style.width = `${width}px`
      node.style.height = `${height}px`
      void node.offsetWidth
    }
    paint()
    node.addEventListener('load', paint)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null
    if (observer) observer.observe(host)
    const id = requestAnimationFrame(() => {
      paint()
      requestAnimationFrame(paint)
    })
    return () => {
      node.removeEventListener('load', paint)
      observer?.disconnect()
      cancelAnimationFrame(id)
    }
  }, [src, result?.componentId])

  return (
    <section className={`canvas-preview${hasWidget ? ' has-widget' : ' is-empty'}`} aria-label="Preview" aria-busy={busy}>
      <header className="canvas-toolbar">
        <span className="studio-pane-label">Canvas</span>
        {busy && copy && hasWidget ? (
          <p className="stream-status" role="status">{copy}</p>
        ) : null}
        <Button type="button" size="sm" disabled={!hasWidget || busy} onClick={onPublish}>
          <Upload />
          Publish
        </Button>
      </header>
      {error ? (
        <div className="canvas-error" role="alert">
          <p>Couldn’t build this UI</p>
          <p className="muted">{error}</p>
          <div className="canvas-error-actions">
            <Button type="button" size="sm" onClick={onTryAgain}>Try again</Button>
            {keyError ? (
              <Button type="button" size="sm" variant="outline" onClick={onOpenSettings}>Settings</Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {showMissingKey ? (
        <div className="canvas-error" role="status">
          <p>Add a TypeSafe key to generate</p>
          <Button type="button" size="sm" onClick={onOpenSettings}>Open Settings</Button>
        </div>
      ) : null}
      <div className="preview-frame">
        {coverPreview && showSkeleton ? <div className="preview-skeleton" role="status" aria-label={copy || 'Generating'} /> : null}
        {coverPreview && copy ? (
          <p className="stream-status" role="status">
            {copy}
          </p>
        ) : null}
        {html ? (
          <div className="preview-widget-host" ref={hostRef}>
            <iframe
              ref={frameRef}
              key={src || result?.componentId}
              title="Widget preview"
              className="preview-widget"
              src={src}
              sandbox="allow-scripts allow-forms"
              onLoad={() => {
                const node = frameRef.current
                const host = hostRef.current
                if (!node || !host) return
                const width = host.clientWidth
                const height = host.clientHeight
                if (width < 8 || height < 8) return
                node.style.width = `${width}px`
                node.style.height = `${height}px`
                requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
              }}
            />
          </div>
        ) : result?.resource ? (
          <div className="preview-widget-host" ref={hostRef}>
            <UIResourceRenderer
              resource={result.resource}
              onUIAction={onUIAction}
              htmlProps={{ style: { width: '100%', height: '100%', minHeight: '28rem', border: 'none' } }}
            />
          </div>
        ) : (
          !busy && !showMissingKey && !error && (
            <div className="preview-empty">
              <p className="preview-empty-title">Describe a UI</p>
              <p className="chat-empty">See it live. Talk to change it. Share an embed.</p>
            </div>
          )
        )}
      </div>
    </section>
  )
}
