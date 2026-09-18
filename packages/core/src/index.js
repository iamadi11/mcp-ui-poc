export { planUI, heuristicPlan, aiAvailable, verifyApiKey, hydrateSpec } from './planner.js'
export { sampleData } from './sample-data.js'
export { demoPayload, payloadForDemoSource, emptySourceSpec, DEMO_CHECKOUT_SOURCE } from './demo-payload.js'
export { uiSpecSchema, componentSchema, propsSchema } from './schema.js'
export { inferShape, fingerprint, shapeHash, normalizeInstructions, findRows, getPath, zipSeriesObject } from './shape.js'
export { applyPolicy, extractPolicy, isIdLikeKey, isTimeLikeKey, sampleRows, formatChartLabel } from './layout-policy.js'
export { isIteratePrompt, applyInstructionUpgrades, mergeIteratePolicy, selectReplayPolicy } from './iterate.js'
export { jevAvailable, jevModel, verifyJevKey, buildJevQuestions } from './jev/planner.js'
export {
  jevAdapter,
  heuristicAdapter,
  llmAdapter,
  localAdapter,
  shouldUseLlm,
  motionToken,
  ROUTING_QUESTION_IDS,
  DECISION_IO,
} from './decisions/index.js'

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
