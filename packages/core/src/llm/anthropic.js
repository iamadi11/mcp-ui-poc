/**
 * Anthropic LLM adapter. Uses structured outputs (`messages.parse` +
 * `output_config: {format:{type:'json_schema', schema}}`).
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let client = null
async function getClient(apiKey) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  if (apiKey) return new Anthropic({ apiKey })
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
  return client
}

function isAvailable(apiKey) {
  return Boolean(apiKey || process.env.ANTHROPIC_API_KEY)
}

async function verifyApiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    await new Anthropic({ apiKey }).models.list({ limit: 1 })
    return { valid: true, model: MODEL }
  } catch (error) {
    return { valid: false, error: error?.status === 401 ? 'Invalid API key' : error.message }
  }
}

async function generateStructured({ apiKey, system, userContent, schema, maxTokens = 16000 }) {
  const anthropic = await getClient(apiKey)
  if (!anthropic) throw new Error('Anthropic adapter unavailable: no API key configured')

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
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
