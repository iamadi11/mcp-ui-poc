/**
 * OpenAI LLM adapter. Uses structured outputs via
 * `response_format: {type:'json_schema', json_schema:{name, schema, strict:true}}`.
 */

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

let client = null
async function getClient(apiKey) {
  const { default: OpenAI } = await import('openai')
  if (apiKey) return new OpenAI({ apiKey })
  if (!process.env.OPENAI_API_KEY) return null
  if (!client) client = new OpenAI()
  return client
}

function isAvailable(apiKey) {
  return Boolean(apiKey || process.env.OPENAI_API_KEY)
}

async function verifyApiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
  try {
    const { default: OpenAI } = await import('openai')
    await new OpenAI({ apiKey }).models.list()
    return { valid: true, model: MODEL }
  } catch (error) {
    return { valid: false, error: error?.status === 401 ? 'Invalid API key' : error.message }
  }
}

async function generateStructured({ apiKey, system, userContent, schema, maxTokens = 16000 }) {
  const openai = await getClient(apiKey)
  if (!openai) throw new Error('OpenAI adapter unavailable: no API key configured')

  const userText = Array.isArray(userContent)
    ? userContent.map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n')
    : userContent

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'ui_spec', schema, strict: true },
    },
  })

  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error('AI planner returned no parseable spec')
  return JSON.parse(content)
}

export const openaiAdapter = {
  id: 'openai',
  name: 'OpenAI (GPT)',
  envKey: 'OPENAI_API_KEY',
  model: MODEL,
  isAvailable,
  verifyApiKey,
  generateStructured,
}
