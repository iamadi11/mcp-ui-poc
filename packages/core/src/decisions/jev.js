import { jevAvailable, jevModel } from '../jev/planner.js'

async function defaultAskJev({ state, questions, model, apiKey }) {
  const { TypeSafeClient } = await import('@typesafe-ai/sdk')
  const client = new TypeSafeClient({
    apiKey: apiKey || process.env.TYPESAFE_API_KEY,
    defaultModel: model,
  })
  return client.systemOne({ state, questions, model })
}

/** TypeSafe System One — one fan-out of typed questions, no prose. */
export const jevAdapter = {
  id: 'jev',
  async decide({ state, questions, model, apiKey, askJev }) {
    const ask =
      typeof askJev === 'function'
        ? askJev
        : (args) => defaultAskJev({ ...args, apiKey })
    const response = await ask({
      state,
      questions,
      model: model || jevModel(),
    })
    return {
      answers: response.answers || response,
      confidence: response.confidence,
      model: response.model || model || jevModel(),
    }
  },
  isAvailable(apiKey) {
    return jevAvailable(apiKey)
  },
}
