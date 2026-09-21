import { nowIso } from '../config.js'

/**
 * Project memory helpers — structured, dated, consolidatable.
 */

export function markAssumption(memory, { statement, evidence = null, status = 'unverified' }) {
  const entry = {
    id: `asm_${memory.assumptions.length + 1}`,
    statement,
    evidence,
    status,
    createdAt: nowIso(),
  }
  memory.assumptions = [...(memory.assumptions || []), entry]
  return entry
}

export function recordDecision(memory, { title, decision, alternatives = [], evidence = [], date = nowIso() }) {
  const entry = { title, decision, alternatives, evidence, date }
  memory.importantDecisions = [...(memory.importantDecisions || []), entry]
  return entry
}

export function recordRejection(memory, { idea, reason, date = nowIso() }) {
  const entry = { idea, reason, date }
  memory.rejectedAlternatives = [...(memory.rejectedAlternatives || []), entry]
  return entry
}

export function recordLesson(memory, { lesson, evidence = null, date = nowIso() }) {
  const entry = { lesson, evidence, date }
  memory.lessonsLearned = [...(memory.lessonsLearned || []), entry]
  return entry
}

export function recordFailure(memory, { failure, taskId = null, date = nowIso() }) {
  const entry = { failure, taskId, date }
  memory.previousFailures = [...(memory.previousFailures || []), entry]
  return entry
}

export function seedMemoryFromRepoDocs(memory, { contextExcerpt = '', workflowNote = '' } = {}) {
  if (!memory.productMission && contextExcerpt) {
    memory.productMission = contextExcerpt.slice(0, 500)
  }
  if (!memory.testingStrategy && workflowNote) {
    memory.testingStrategy = workflowNote.slice(0, 500)
  }
  memory.updatedAt = nowIso()
  return memory
}

/**
 * Drop stale assumptions older than maxAgeDays marked unverified without refresh.
 */
export function consolidateMemory(memory, { maxEntries = 100 } = {}) {
  const trim = (arr) => (arr || []).slice(-maxEntries)
  return {
    ...memory,
    importantDecisions: trim(memory.importantDecisions),
    rejectedAlternatives: trim(memory.rejectedAlternatives),
    lessonsLearned: trim(memory.lessonsLearned),
    previousFailures: trim(memory.previousFailures),
    researchFindings: trim(memory.researchFindings),
    technicalDebt: trim(memory.technicalDebt),
    assumptions: trim(memory.assumptions),
    updatedAt: nowIso(),
  }
}
