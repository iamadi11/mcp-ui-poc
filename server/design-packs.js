import {
  STARTER_PACKS,
  normalizePack,
  parseCssVariables,
  parseTokensJson,
  previewSpecs,
  getDesignSystem,
} from 'ui-compose-kit'

function packFromBody(body = {}) {
  if (body.css) return parseCssVariables(body.css)
  if (body.tokensJson) return parseTokensJson(body.tokensJson)
  if (body.tokens) return parseTokensJson(body)
  if (typeof body.starter === 'string' && STARTER_PACKS[body.starter]) {
    return normalizePack(STARTER_PACKS[body.starter])
  }
  return normalizePack(body.pack || body)
}

export function registerDesignPackRoutes(app, { generateLimiter }) {
  app.get('/api/design-packs', (_req, res) => {
    res.json({
      packs: Object.values(STARTER_PACKS).map((pack) => ({
        id: pack.id,
        name: pack.name,
        tokens: pack.tokens,
        supports: pack.supports,
      })),
    })
  })

  app.post('/api/design-packs/preview', generateLimiter, (req, res) => {
    try {
      const pack = packFromBody(req.body)
      const ds = getDesignSystem('shadcn')
      const samples = previewSpecs()
      res.json({
        pack,
        loginHtml: ds.render(samples.login, pack),
        landingHtml: ds.render(samples.landing, pack),
      })
    } catch (error) {
      res.status(400).json({ error: error.message || 'Could not preview pack' })
    }
  })
}
