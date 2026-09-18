import { planTurn } from './plan-turn.js'

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
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
    } = req.body || {}

    if (!message && !url && !instructions) {
      return res.status(400).json({ error: 'message or url is required' })
    }

    try {
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
      })
      res.json(result)
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
}
