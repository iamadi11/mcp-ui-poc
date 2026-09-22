/**
 * OpenAI-compatible LLM adapter. Works with OpenAI, Ollama, Groq, OpenRouter,
 * vLLM, LM Studio, etc. via OPENAI_BASE_URL.
 *
 * Structured outputs use
 * `response_format: {type:'json_schema', json_schema:{name, schema, strict:true}}`
 * when the upstream supports it; some local models may need JSON-mode prompts.
 */

import { userContentToText, verifyApiKeyError, llmAbortSignal, mapLlmTimeoutError } from './shared.js'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

function baseUrl() {
  const raw = String(process.env.OPENAI_BASE_URL || '').trim()
  return raw ? raw.replace(/\/$/, '') : undefined
}

function resolveApiKey(apiKey) {
  if (apiKey) return apiKey
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  // Ollama and many local servers accept any non-empty key.
  if (baseUrl()) return process.env.OPENAI_API_KEY || 'local'
  return null
}

let client = null
let clientKey = null
let clientBase = null

async function getClient(apiKey) {
  const { default: OpenAI } = await import('openai')
  const key = resolveApiKey(apiKey)
  if (!key) return null
  const root = baseUrl()
  if (apiKey) {
    const opts = { apiKey: key }
    if (root) opts.baseURL = root
    return new OpenAI(opts)
  }
  if (!client || clientKey !== key || clientBase !== root) {
    const opts = { apiKey: key }
    if (root) opts.baseURL = root
    client = new OpenAI(opts)
    clientKey = key
    clientBase = root
  }
  return client
}

function isAvailable(apiKey) {
  return Boolean(apiKey || process.env.OPENAI_API_KEY || baseUrl())
}

async function verifyApiKey(apiKey) {
  const key = resolveApiKey(apiKey)
  if (!key) return { valid: false, error: 'No API key provided' }
  try {
    const { default: OpenAI } = await import('openai')
    const opts = { apiKey: key }
    const root = baseUrl()
    if (root) opts.baseURL = root
    await new OpenAI(opts).models.list()
    return { valid: true, model: MODEL }
  } catch (error) {
    return verifyApiKeyError(error)
  }
}

async function generateStructured({ apiKey, system, userContent, schema, maxTokens = 16000 }) {
  const openai = await getClient(apiKey)
  if (!openai) throw new Error('OpenAI-compatible adapter unavailable: set OPENAI_API_KEY or OPENAI_BASE_URL')

  const userText = userContentToText(userContent)
  const model = process.env.OPENAI_MODEL || MODEL

  try {
    const response = await openai.chat.completions.create(
      {
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'ui_spec', schema, strict: true },
        },
      },
      { signal: llmAbortSignal() },
    )

    const content = response.choices?.[0]?.message?.content
    if (!content) throw new Error('AI planner returned no parseable spec')
    return JSON.parse(content)
  } catch (error) {
    throw mapLlmTimeoutError(error)
  }
}

export const openaiAdapter = {
  id: 'openai',
  name: 'OpenAI-compatible (Ollama / Groq / OpenRouter / GPT)',
  envKey: 'OPENAI_API_KEY',
  model: MODEL,
  baseUrl: baseUrl(),
  isAvailable,
  verifyApiKey,
  generateStructured,
}
