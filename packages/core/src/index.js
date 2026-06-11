export { planUI, heuristicPlan, aiAvailable, verifyApiKey } from './planner.js'
export { sampleData } from './sample-data.js'
export { uiSpecSchema, componentSchema, propsSchema } from './schema.js'

export {
  registerDesignSystem,
  setActiveDesignSystem,
  getDesignSystem,
  listDesignSystems,
} from './design-systems/registry.js'

export { registerLLMAdapter, getLLMAdapter, listLLMAdapters } from './llm/registry.js'
export { anthropicAdapter } from './llm/anthropic.js'

import { registerLLMAdapter } from './llm/registry.js'
import { anthropicAdapter } from './llm/anthropic.js'
import { openaiAdapter } from './llm/openai.js'
import { geminiAdapter } from './llm/gemini.js'

registerLLMAdapter(anthropicAdapter)
registerLLMAdapter(openaiAdapter)
registerLLMAdapter(geminiAdapter)

const envChoice = process.env.LLM_PROVIDER
if (envChoice && !['anthropic', 'openai', 'gemini'].includes(envChoice)) {
  console.warn(`Unknown LLM_PROVIDER "${envChoice}"; falling back to "anthropic"`)
}
