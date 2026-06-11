/**
 * LLM adapter registry.
 *
 * An LLM adapter provides:
 *  - `id`, `name`, `envKey` — identity + the env var that supplies its default API key
 *  - `isAvailable(apiKey?)` — true if the adapter can run (env key or passed key)
 *  - `verifyApiKey(apiKey)` -> { valid, model?, error? } — cheap auth check
 *  - `generateStructured({ apiKey, model, system, userContent, schema, maxTokens })` -> parsed object
 */

const adapters = new Map()

export function registerLLMAdapter(adapter) {
  if (
    !adapter?.id ||
    typeof adapter.isAvailable !== 'function' ||
    typeof adapter.generateStructured !== 'function'
  ) {
    throw new Error('LLM adapter requires id, isAvailable(), generateStructured()')
  }
  adapters.set(adapter.id, adapter)
}

export function getLLMAdapter(id) {
  const adapter = adapters.get(id)
  if (!adapter) throw new Error(`Unknown LLM provider: ${id}. Registered: ${[...adapters.keys()].join(', ')}`)
  return adapter
}

export function listLLMAdapters() {
  return [...adapters.values()].map((a) => ({
    id: a.id,
    name: a.name,
    available: a.isAvailable(),
  }))
}
