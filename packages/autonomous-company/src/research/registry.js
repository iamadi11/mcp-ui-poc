import { nowIso, newId } from '../config.js'

export const RESEARCH_OUTCOMES = Object.freeze([
  'adopt',
  'experiment',
  'monitor',
  'reject',
  'revisit_later',
])

export const CLAIM_LABELS = Object.freeze([
  'verified_fact',
  'vendor_claim',
  'community_opinion',
  'agent_hypothesis',
  'experimental_result',
])

export function createResearchFinding({
  title,
  summary,
  sources = [],
  claims = [],
  productRelevance,
  alternatives = [],
  adoptionRisks = [],
  migrationEffort = null,
  experimentIdea = null,
  outcome,
  date = nowIso(),
}) {
  if (!RESEARCH_OUTCOMES.includes(outcome)) {
    throw new Error(`Invalid research outcome: ${outcome}`)
  }
  for (const c of claims) {
    if (!CLAIM_LABELS.includes(c.label)) {
      throw new Error(`Invalid claim label: ${c.label}`)
    }
  }
  return {
    id: newId('research'),
    title,
    summary,
    sources,
    claims,
    productRelevance,
    alternatives,
    adoptionRisks,
    migrationEffort,
    experimentIdea,
    outcome,
    date,
  }
}

export function addResearchFinding(research, finding) {
  research.findings = [...(research.findings || []), finding]
  research.updatedAt = nowIso()
  return research
}
