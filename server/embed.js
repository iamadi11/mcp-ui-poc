import { getDesignSystem } from 'ui-compose-kit'
import { getWidget } from './mongo.js'
import { versionOf } from './widgets.js'

async function sendEmbed(req, res) {
  const widget = await getWidget(req.params.publicId)
  if (!widget) return res.status(404).type('html').send('<!DOCTYPE html><title>Not found</title><p>Widget not found.</p>')
  const ver = versionOf(widget, req.query.v)
  if (!ver?.spec) return res.status(404).type('html').send('<!DOCTYPE html><title>Not found</title><p>Version not found.</p>')
  let html
  try {
    html = getDesignSystem(ver.themeId || 'shadcn').render(ver.spec)
  } catch {
    html = getDesignSystem('shadcn').render(ver.spec)
  }
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
  res.setHeader('X-Widget-Id', widget.publicId)
  if (ver.v != null) res.setHeader('X-Widget-Version', String(ver.v))
  res.type('html').send(html)
}

export function registerEmbedRoutes(app) {
  app.get('/e/:publicId', sendEmbed)
  app.get('/api/embed/:publicId', sendEmbed)
}
