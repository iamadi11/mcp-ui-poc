import { randomBytes } from 'node:crypto'
import { upsertUser } from './mongo.js'
import { setCache, getCache, deleteCache } from './store.js'
import {
  clearSessionCookie,
  publicOrigin,
  readSession,
  revokeSession,
  sessionConfigured,
  writeSession,
} from './session.js'

export function oauthConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && sessionConfigured(),
  )
}

export function registerAuthRoutes(app) {
  app.get('/api/auth/me', async (req, res) => {
    const user = await readSession(req)
    res.json({
      user: user ? { githubId: user.githubId, login: user.login } : null,
      oauth: oauthConfigured(),
    })
  })

  app.get('/api/auth/github', async (req, res) => {
    if (!oauthConfigured()) {
      return res.status(503).json({ error: 'GitHub OAuth is not configured' })
    }
    const state = randomBytes(16).toString('hex')
    await setCache(`oauth-state:${state}`, { at: Date.now() }, 600)
    const redirect = `${publicOrigin(req)}/api/auth/github/callback`
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID)
    url.searchParams.set('redirect_uri', redirect)
    url.searchParams.set('scope', 'read:user')
    url.searchParams.set('state', state)
    res.redirect(url.toString())
  })

  app.get('/api/auth/github/callback', async (req, res) => {
    const { code, state } = req.query
    const next = '/'
    if (!oauthConfigured()) return res.redirect(`${next}?auth=error`)
    const st = await getCache(`oauth-state:${state}`)
    await deleteCache(`oauth-state:${state}`)
    if (!code || !st) return res.redirect(`${next}?auth=error`)

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${publicOrigin(req)}/api/auth/github/callback`,
        }),
      })
      const tokenBody = await tokenRes.json()
      const access = tokenBody.access_token
      if (!access) return res.redirect(`${next}?auth=error`)

      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${access}`, 'User-Agent': 'mcp-ui-studio', Accept: 'application/json' },
      })
      const gh = await userRes.json()
      const githubId = gh.id
      const login = gh.login
      if (!githubId) return res.redirect(`${next}?auth=error`)

      await upsertUser({ githubId, login })
      await writeSession(res, { githubId, login })
      res.redirect(`${next}?auth=ok`)
    } catch {
      res.redirect(`${next}?auth=error`)
    }
  })

  app.post('/api/auth/logout', async (req, res) => {
    await revokeSession(req)
    clearSessionCookie(res)
    res.json({ ok: true })
  })
}
