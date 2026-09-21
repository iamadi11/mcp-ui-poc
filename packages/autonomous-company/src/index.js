export { loadConfig, PHASES, TASK_CATEGORIES, fingerprintTask } from './config.js'
export {
  initStore,
  loadStore,
  upsertCandidate,
  appendEvent,
  saveTask,
  loadTask,
} from './state/store.js'
export { discoverCandidates } from './discovery/engine.js'
export {
  scoreCandidate,
  challengeCandidate,
  prioritizeCandidates,
  selectNextTask,
} from './prioritization/score.js'
export { AGENTS, agentsForPhase, routeEngineerSubtype } from './agents/registry.js'
export {
  ANTI_SLOP_QUESTIONS,
  evaluateAntiSlopAnswers,
  detectSlopClaims,
} from './anti-slop/protocol.js'
export {
  gatesForCategory,
  evaluateGates,
  checkSafetyAction,
  suggestedValidationCommands,
  recordValidationResult,
  HIGH_IMPACT_ACTIONS,
} from './gates/quality.js'
export {
  boot,
  beginRun,
  runDiscovery,
  runCycle,
  activateTask,
  advancePhase,
  interruptRun,
  stopRun,
  completeTask,
  rejectTaskImplementation,
  requestHighImpact,
  getConflicts,
  buildWorkOrder,
} from './orchestration/controller.js'
export { detectFileConflicts, acquireLocks, releaseLocks } from './orchestration/conflict.js'
export {
  createResearchFinding,
  addResearchFinding,
  RESEARCH_OUTCOMES,
  CLAIM_LABELS,
} from './research/registry.js'
export {
  createImprovementProposal,
  evaluateImprovement,
  applyImprovement,
  rollbackWorkflow,
  concludeNoImprovement,
} from './improve/proposals.js'
export { formatStatus, renderStatusText } from './observability/status.js'
export { findRepoRoot } from './repo-root.js'
export {
  seedMemoryFromRepoDocs,
  consolidateMemory,
  recordDecision,
  recordLesson,
  recordFailure,
} from './memory/project.js'
