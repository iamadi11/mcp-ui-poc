import { getLLMAdapter } from '../llm/registry.js'

const LLM_MAX_TOKENS = 4096

/** Rare fallback: structured spec from shape + instruction excerpt, never full payloads. */
export const llmAdapter = {
  id: 'llm',
  maxTokens: LLM_MAX_TOKENS,
  async generate({ apiKey, llmProvider, system, userContent, schema }) {
    const provider = llmProvider || process.env.LLM_PROVIDER || 'anthropic'
    const adapter = getLLMAdapter(provider)
    const spec = await adapter.generateStructured({
      apiKey,
      system,
      userContent,
      schema,
      maxTokens: LLM_MAX_TOKENS,
    })
    return { spec, planner: `${adapter.id}:${adapter.model}` }
  },
  isAvailable(apiKey, llmProvider) {
    try {
      return getLLMAdapter(llmProvider || process.env.LLM_PROVIDER || 'anthropic').isAvailable(apiKey)
    } catch {
      return false
    }
  },
}
