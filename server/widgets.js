import { randomBytes } from 'node:crypto'
import { getDesignSystem, applyPolicy } from 'ui-compose-kit'
import { getWidget, saveWidget } from './mongo.js'
import { loadSessionWidget } from './store.js'
import { readSession } from './session.js'
import { oauthConfigured } from './auth.js'
import { fetchEndpointData } from './data-source.js'
import { assertGeneratedHtmlWithinLimit } from './generated-html-limit.js'

function newPublicId() {
  return randomBytes(9).toString('base64url')
}

function versionOf(widget, requested) {
  const versions = widget?.versions || []
  if (!versions.length) return null
  if (requested == null || requested === '') return versions[versions.length - 1]
  const n = Number(requested)
  return versions.find((v) => v.v === n) || versions[versions.length - 1]
}

function embedSnippet(origin, publicId, v) {
  const src = `${origin}/e/${publicId}${v ? `?v=${v}` : ''}`
  return `<iframe src="${src}" title="MCP UI widget" loading="lazy" style="width:100%;min-height:420px;border:0"></iframe>`
}

export function registerWidgetRoutes(app, { generateLimiter }) {
  app.post('/api/widgets', generateLimiter, async (req, res) => {
    const user = await readSession(req)
    if (oauthConfigured() && !user) {
      return res.status(401).json({
        error: 'Sign in with GitHub to publish',
        loginUrl: '/api/auth/github',
        oauth: true,
      })
    }

    const sessionId = req.body?.sessionId
    const decisionId = req.body?.decisionId
    const draft = await loadSessionWidget(sessionId)
    if (!draft?.spec) {
      return res.status(400).json({ error: 'No widget in this session to publish. Generate one first.' })
    }

    const existingId = req.body?.publicId
    const existing = existingId ? await getWidget(existingId) : null
    if (existing?.ownerGithubId && user && existing.ownerGithubId !== user.githubId) {
      return res.status(403).json({ error: 'Only the owner can republish this widget' })
    }
    if (existing?.ownerGithubId && !user) {
      return res.status(401).json({
        error: 'Sign in with GitHub to publish',
        loginUrl: '/api/auth/github',
        oauth: oauthConfigured(),
      })
    }

    const publicId = existing?.publicId || newPublicId()
    const versions = existing?.versions ? [...existing.versions] : []
    const v = (versions[versions.length - 1]?.v || 0) + 1
    const themeId = req.body?.themeId || draft.themeId || 'shadcn'
    const motion = req.body?.motion || draft.motion || 'none'
    const spec = { ...draft.spec, motion }
    const html = getDesignSystem(themeId).render(spec)
    assertGeneratedHtmlWithinLimit(html)

    versions.push({
      v,
      policy: draft.policy,
      spec,
      themeId,
      motion,
      sourceUrl: draft.sourceUrl || '',
      createdAt: new Date().toISOString(),
    })

    const widget = {
      publicId,
      ownerGithubId: user?.githubId ?? null,
      ownerLogin: user?.login ?? null,
      currentVersion: v,
      versions,
      decisionId: decisionId || draft.decisionId,
    }
    const saved = await saveWidget(widget)
    const origin = req.body?.origin || ''
    res.json({
      publicId,
      version: v,
      embedUrl: `/e/${publicId}`,
      ownerUrl: `/w/${publicId}`,
      snippet: embedSnippet(origin, publicId, v),
      stored: saved.backend || 'memory',
      anonymous: !user,
    })
  })

  app.get('/api/widgets/:publicId', async (req, res) => {
    const widget = await getWidget(req.params.publicId)
    if (!widget) return res.status(404).json({ error: 'Widget not found' })
    const user = await readSession(req)
    const ver = versionOf(widget, req.query.v)
    res.json({
      publicId: widget.publicId,
      version: ver?.v,
      currentVersion: widget.currentVersion,
      themeId: ver?.themeId,
      motion: ver?.motion,
      spec: ver?.spec,
      sourceUrl: ver?.sourceUrl,
      owner: widget.ownerLogin,
      isOwner: Boolean(user && user.githubId === widget.ownerGithubId),
    })
  })

  app.patch('/api/widgets/:publicId', generateLimiter, async (req, res) => {
    const widget = await getWidget(req.params.publicId)
    if (!widget) return res.status(404).json({ error: 'Widget not found' })
    const user = await readSession(req)
    if (widget.ownerGithubId) {
      if (!user) {
        return res.status(401).json({ error: 'Sign in with GitHub to edit', loginUrl: '/api/auth/github' })
      }
      if (widget.ownerGithubId !== user.githubId) {
        return res.status(403).json({ error: 'Only the owner can customize this widget' })
      }
    }

    const latest = versionOf(widget)
    const themeId = req.body?.themeId || latest.themeId || 'shadcn'
    const motion = req.body?.motion || latest.motion || 'none'
    let policy = latest.policy
    if (typeof req.body?.density === 'number' && policy) {
      const maxWidgets = req.body.density < 0.75 ? 1 : req.body.density < 1.75 ? 3 : 5
      policy = { ...policy, componentTypes: (policy.componentTypes || []).slice(0, maxWidgets) }
    }

    let spec = latest.spec
    let sourceUrl = req.body?.sourceUrl ?? latest.sourceUrl
    if (req.body?.sourceUrl && req.body.sourceUrl !== latest.sourceUrl && policy) {
      const { data } = await fetchEndpointData({ url: req.body.sourceUrl, method: 'GET' })
      spec = applyPolicy(policy, data, req.body.sourceUrl)
      sourceUrl = req.body.sourceUrl
    }
    spec = { ...spec, motion }

    const html = getDesignSystem(themeId).render(spec)
    assertGeneratedHtmlWithinLimit(html)
    const v = (widget.currentVersion || 0) + 1
    const versions = [
      ...(widget.versions || []),
      { v, policy, spec, themeId, motion, sourceUrl, createdAt: new Date().toISOString() },
    ]
    await saveWidget({ ...widget, currentVersion: v, versions })
    res.json({ publicId: widget.publicId, version: v, spec, themeId, motion, sourceUrl })
  })
}

export { versionOf, embedSnippet }
