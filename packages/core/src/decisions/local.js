import { ROUTING_QUESTION_IDS, DECISION_IO } from './schema.js'

/**
 * Stub for a future ONNX/WASM on-device model.
 * Same I/O as Jev: { state, questions } → { answers, confidence }.
 * First replacement target: intent routing, then include_* questions.
 */
export const localAdapter = {
  id: 'local',
  io: DECISION_IO,
  questionIds: ROUTING_QUESTION_IDS,
  async decide() {
    const error = new Error('LocalAdapter is a stub — train from turns+ratings export, then load ONNX/WASM')
    error.code = 'LOCAL_ADAPTER_UNAVAILABLE'
    throw error
  },
  isAvailable() {
    return false
  },
}
