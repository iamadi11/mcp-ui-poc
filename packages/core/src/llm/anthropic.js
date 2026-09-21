/**
 * Anthropic LLM adapter. Uses structured outputs (`messages.parse` +
 * `output_config: {format:{type:'json_schema', schema}}`).
 */

import { verifyApiKeyError } from './shared.js'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

let client = null
async function getClient(apiKey) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const key = typeof apiKey === 'string' ? apiKey.trim() : apiKey
  if (key) return new Anthropic({ apiKey: key })
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
  return client
}

function isAvailable(apiKey) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : apiKey
  return Boolean(key || process.env.ANTHROPIC_API_KEY)
}

async function verifyApiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    await new Anthropic({ apiKey }).models.list({ limit: 1 })
    return { valid: true, model: MODEL }
  } catch (error) {
    return verifyApiKeyError(error)
  }
}

async function generateStructured({ apiKey, system, userContent, schema, maxTokens = 4096, thinking } = {}) {
  const anthropic = await getClient(apiKey)
  if (!anthropic) throw new Error('Anthropic adapter unavailable: no API key configured')

  const thinkingBudget = Math.min(1024, Math.max(0, Number(maxTokens) - 2048))
  const enableThinking = thinking === true || (thinking !== false && thinkingBudget >= 1024)
  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: enableThinking ? { type: 'enabled', budget_tokens: thinkingBudget } : { type: 'disabled' },
    system,
    messages: [{ role: 'user', content: userContent }],
    output_config: { format: { type: 'json_schema', schema } },
  })

  let parsed = response.parsed_output
  if (!parsed) {
    const textBlock = response.content.find((b) => b.type === 'text')
    parsed = textBlock ? JSON.parse(textBlock.text) : null
  }
  if (!parsed) throw new Error('AI planner returned no parseable spec')
  return parsed
}

export const anthropicAdapter = {
  id: 'anthropic',
  name: 'Anthropic (Claude)',
  envKey: 'ANTHROPIC_API_KEY',
  model: MODEL,
  isAvailable,
  verifyApiKey,
  generateStructured,
}
