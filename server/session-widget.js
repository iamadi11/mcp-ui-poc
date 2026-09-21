import { randomUUID } from 'node:crypto'
import { createUIResource } from '@mcp-ui/server'
import { getDesignSystem, applyPolicy } from 'ui-compose-kit'
import { saveSessionWidget, loadSessionWidget } from './store.js'
import { fetchEndpointData } from './data-source.js'
import { assertGeneratedHtmlWithinLimit } from './generated-html-limit.js'

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

function withLook(spec, look) {
  const next = look === 'vivid' ? 'vivid' : look === 'default' ? 'default' : spec?.look
  return { ...spec, look: next === 'vivid' ? 'vivid' : 'default' }
}

export function renderWidgetPayload({
  spec,
  policy,
  themeId,
  themePack,
  motion,
  look,
  sourceUrl = '',
  decisionId,
  plannerLabel = 'Restored',
} = {}) {
  if (!spec) {
    const err = new Error('No widget spec to restore')
    err.status = 400
    throw err
  }
  const ds = getDesignSystem(themeId || 'shadcn')
  const nextSpec = withLook({ ...spec, motion: motion || spec.motion || 'none' }, look)
  const html = ds.render(nextSpec, themePack || undefined)
  assertGeneratedHtmlWithinLimit(html)
  const componentId = decisionId || `turn-${randomUUID()}`
  const resource = createUIResource({
    uri: `ui://endpoint/${componentId}`,
    content: { type: 'rawHtml', htmlString: html },
    encoding: 'text',
  })
  return {
    ...resource,
    componentId,
    spec: nextSpec,
    policy: policy || null,
    html,
    themeId: ds.id,
    themePack: themePack || null,
    motion: nextSpec.motion,
    look: nextSpec.look,
    sourceUrl: sourceUrl || '',
    meta: {
      plannerLabel,
      decisionId: componentId,
      designSystem: ds.id,
      motion: nextSpec.motion,
      source: isHttpUrl(sourceUrl) ? { url: sourceUrl } : null,
    },
  }
}

export async function persistRenderedSession(sessionId, payload, extras = {}) {
  if (!sessionId || !payload) return
  const current = await loadSessionWidget(sessionId)
  await saveSessionWidget(sessionId, {
    decisionId: payload.componentId,
    spec: payload.spec,
    policy: extras.policy !== undefined ? extras.policy : payload.policy,
    themeId: payload.themeId,
    themePack: payload.themePack || extras.themePack || current?.themePack,
    motion: payload.motion,
    sourceUrl: extras.sourceUrl !== undefined ? extras.sourceUrl : payload.sourceUrl,
    html: payload.html,
    dataSnapshot: extras.dataSnapshot !== undefined ? extras.dataSnapshot : current?.dataSnapshot,
    history: extras.history !== undefined ? extras.history : current?.history,
    goal: extras.goal !== undefined ? extras.goal : current?.goal,
  })
}

export async function restoreSessionWidget(sessionId, draft) {
  if (!sessionId) {
    const err = new Error('sessionId is required')
    err.status = 400
    throw err
  }
  const payload = renderWidgetPayload({
    spec: draft?.spec,
    policy: draft?.policy,
    themeId: draft?.themeId,
    themePack: draft?.themePack,
    motion: draft?.motion,
    look: draft?.look,
    sourceUrl: draft?.sourceUrl,
    decisionId: draft?.decisionId,
    plannerLabel: 'Restored',
  })
  await persistRenderedSession(sessionId, payload)
  return payload
}

export async function customizeSessionWidget(sessionId, patch = {}) {
  if (!sessionId) {
    const err = new Error('sessionId is required')
    err.status = 400
    throw err
  }
  const current = await loadSessionWidget(sessionId)
  if (!current?.spec) {
    const err = new Error('No widget in this session to customize')
    err.status = 400
    throw err
  }

  let policy = current.policy
  let spec = current.spec
  let sourceUrl = patch.sourceUrl !== undefined ? patch.sourceUrl : current.sourceUrl
  let dataSnapshot = current.dataSnapshot

  if (isHttpUrl(sourceUrl) && sourceUrl !== current.sourceUrl && policy) {
    const { data } = await fetchEndpointData({ url: sourceUrl, method: 'GET' })
    spec = applyPolicy(policy, data, sourceUrl)
    dataSnapshot = undefined
  }

  const payload = renderWidgetPayload({
    spec,
    policy,
    themeId: patch.themeId || current.themeId,
    themePack: patch.themePack || current.themePack,
    motion: patch.motion || current.motion,
    look: patch.look,
    sourceUrl,
    plannerLabel: 'Customized',
  })
  await persistRenderedSession(sessionId, payload, { policy, sourceUrl, dataSnapshot })
  return payload
}
