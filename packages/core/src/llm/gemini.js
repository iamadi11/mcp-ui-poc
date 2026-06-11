/**
 * Google Gemini LLM adapter. Uses `@google/genai` with
 * `responseMimeType:'application/json'` + `responseSchema`.
 *
 * Gemini's schema dialect is a stricter OpenAPI subset: it doesn't accept
 * `additionalProperties` or `anyOf` keys with JSON-Schema-only semantics, so
 * `sanitizeSchemaForGemini` strips/flattens those recursively before sending.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

/** Strip JSON-Schema keywords Gemini's OpenAPI-subset schema doesn't support. */
export function sanitizeSchemaForGemini(schema) {
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini)
  if (!schema || typeof schema !== 'object') return schema

  const { additionalProperties, anyOf, ...rest } = schema
  void additionalProperties

  if (anyOf) {
    // Gemini supports anyOf, but each branch must itself be sanitized.
    return { ...sanitizeSchemaForGemini(rest), anyOf: anyOf.map(sanitizeSchemaForGemini) }
  }

  const out = { ...rest }
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, sanitizeSchemaForGemini(v)])
    )
  }
  if (out.items) out.items = sanitizeSchemaForGemini(out.items)
  return out
}

let client = null
async function getClient(apiKey) {
  const { GoogleGenAI } = await import('@google/genai')
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) return null
  if (apiKey) return new GoogleGenAI({ apiKey })
  if (!client) client = new GoogleGenAI({ apiKey: key })
  return client
}

function isAvailable(apiKey) {
  return Boolean(apiKey || process.env.GEMINI_API_KEY)
}

async function verifyApiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' }
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey })
    await ai.models.list()
    return { valid: true, model: MODEL }
  } catch (error) {
    return { valid: false, error: error?.status === 401 ? 'Invalid API key' : error.message }
  }
}

async function generateStructured({ apiKey, system, userContent, schema, maxTokens = 16000 }) {
  const ai = await getClient(apiKey)
  if (!ai) throw new Error('Gemini adapter unavailable: no API key configured')

  const userText = Array.isArray(userContent)
    ? userContent.map((c) => (typeof c === 'string' ? c : c.text || '')).join('\n')
    : userContent

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userText,
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseSchema: sanitizeSchemaForGemini(schema),
      maxOutputTokens: maxTokens,
    },
  })

  const text = response.text
  if (!text) throw new Error('AI planner returned no parseable spec')
  return JSON.parse(text)
}

export const geminiAdapter = {
  id: 'gemini',
  name: 'Google (Gemini)',
  envKey: 'GEMINI_API_KEY',
  model: MODEL,
  isAvailable,
  verifyApiKey,
  generateStructured,
}
