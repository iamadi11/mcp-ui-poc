import { planTurn } from './plan-turn.js'
import { restoreSessionWidget, customizeSessionWidget } from './session-widget.js'
import { getWidget, saveWidget, archiveStudioChat } from './mongo.js'
import { readSession } from './session.js'
import { versionOf } from './widgets.js'
import { runWithGoogleMapsKey } from 'ui-compose-kit'

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function isWidgetOwner(widget, user) {
  if (!widget?.ownerGithubId) return true
  return Boolean(user && user.githubId === widget.ownerGithubId)
}

export function registerChatRoutes(app, { generateLimiter }) {
  app.post('/api/chat/turn', generateLimiter, async (req, res) => {
    const wantsStream =
      String(req.get('accept') || '').includes('text/event-stream') || req.body?.stream === true

    const apiKey = req.get('x-anthropic-api-key') || undefined
    const typesafeApiKey = req.get('x-typesafe-api-key') || undefined
    const {
      message,
      url,
      method,
      headers,
      body,
      instructions,
      designSystem,
      llmProvider,
      sessionId,
      fresh,
      rebuild,
      themePack,
      history,
      goal,
    } = req.body || {}

    if (!message && !url && !instructions) {
      return res.status(400).json({ error: 'message or url is required' })
    }

    try {
      const run = () => runWithGoogleMapsKey(req.get('x-google-maps-api-key'), async () => {
        if (wantsStream) {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache, no-transform')
          res.setHeader('Connection', 'keep-alive')
          res.flushHeaders?.()
          const result = await planTurn({
            message,
            url,
            method,
            headers,
            body,
            instructions,
            designSystem,
            llmProvider,
            apiKey,
            typesafeApiKey,
            sessionId,
            onEvent: (event, data) => writeSse(res, event, data),
            fresh: Boolean(fresh),
            rebuild: Boolean(rebuild),
            themePack,
            history,
            goal,
          })
          writeSse(res, 'done', { decisionId: result.componentId })
          res.end()
          return
        }

        const result = await planTurn({
          message,
          url,
          method,
          headers,
          body,
          instructions,
          designSystem,
          llmProvider,
          apiKey,
          typesafeApiKey,
          sessionId,
          fresh: Boolean(fresh),
          rebuild: Boolean(rebuild),
          themePack,
          history,
          goal,
        })
        res.json(result)
      })
      await run()
    } catch (error) {
      const status = error.status || 500
      const message = error.message || 'Turn failed'
      if (wantsStream) {
        if (!res.headersSent) {
          return res.status(status).json({ error: message })
        }
        writeSse(res, 'error', { error: message })
        res.end()
        return
      }
      if (status >= 500) console.error('Error on chat turn:', error)
      res.status(status).json({ error: message })
    }
  })

  app.post('/api/chat/restore', generateLimiter, async (req, res) => {
    try {
      const payload = await runWithGoogleMapsKey(req.get('x-google-maps-api-key'), () =>
        restoreSessionWidget(req.body?.sessionId, req.body?.widget),
      )
      res.json(payload)
    } catch (error) {
      const status = error.status || 500
      if (status >= 500) console.error('Error restoring session widget:', error)
      res.status(status).json({ error: error.message || 'Restore failed' })
    }
  })

  app.post('/api/chat/customize', generateLimiter, async (req, res) => {
    try {
      const sessionId = req.body?.sessionId
      const payload = await runWithGoogleMapsKey(req.get('x-google-maps-api-key'), () =>
        customizeSessionWidget(sessionId, {
          themeId: req.body?.themeId,
          themePack: req.body?.themePack,
          motion: req.body?.motion,
          look: req.body?.look,
          sourceUrl: req.body?.sourceUrl,
        }),
      )

      const publicId = req.body?.publicId
      if (!publicId) return res.json(payload)

      const widget = await getWidget(publicId)
      if (!widget) return res.json(payload)
      const user = await readSession(req)
      if (!isWidgetOwner(widget, user)) {
        return res.json({ ...payload, published: false, error: 'Only the owner can update the live URL' })
      }

      const latest = versionOf(widget)
      const v = (widget.currentVersion || latest?.v || 0) + 1
      const versions = [
        ...(widget.versions || []),
        {
          v,
          policy: payload.policy || latest?.policy,
          spec: payload.spec,
          themeId: payload.themeId,
          themePack: payload.themePack || latest?.themePack,
          motion: payload.motion,
          sourceUrl: payload.sourceUrl || '',
          createdAt: new Date().toISOString(),
        },
      ]
      await saveWidget({ ...widget, currentVersion: v, versions })
      res.json({ ...payload, publicId, version: v, published: true })
    } catch (error) {
      const status = error.status || 500
      if (status >= 500) console.error('Error customizing session widget:', error)
      res.status(status).json({ error: error.message || 'Customize failed' })
    }
  })

  app.post('/api/chat/archive', generateLimiter, async (req, res) => {
    try {
      const saved = await archiveStudioChat(req.body || {})
      if (!saved.sessionId && saved.reason) {
        return res.status(400).json({ error: saved.reason })
      }
      res.json(saved)
    } catch (error) {
      const status = error.status || 500
      if (status >= 500) console.error('Error archiving studio chat:', error)
      res.status(status).json({ error: error.message || 'Archive failed' })
    }
  })
}
