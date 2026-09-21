/**
 * Anti-AI-slop protocol — required before accepting implementation work.
 */

export const ANTI_SLOP_QUESTIONS = Object.freeze([
  'What problem are we solving?',
  'What evidence supports it?',
  'Why is this implementation appropriate?',
  'What existing functionality could be affected?',
  'What could go wrong?',
  'How will we verify the result?',
  'What would make us reject this approach?',
])

export function evaluateAntiSlopAnswers(answers = {}) {
  const missing = []
  const weak = []
  for (const q of ANTI_SLOP_QUESTIONS) {
    const a = answers[q]
    if (!a || !String(a).trim()) {
      missing.push(q)
      continue
    }
    if (String(a).trim().length < 12) weak.push(q)
  }
  return {
    pass: missing.length === 0 && weak.length === 0,
    missing,
    weak,
  }
}

export const SLOP_SMELLS = Object.freeze([
  'code_without_reading_architecture',
  'unnecessary_abstraction',
  'overengineering',
  'duplicated_functionality',
  'placeholder_implementation',
  'tautological_tests',
  'weakened_validation',
  'ignored_error_handling',
  'ignored_accessibility',
  'ignored_security',
  'unjustified_dependency',
  'unrelated_refactor',
  'config_tweaks_to_pass_tests',
  'replace_working_system_without_evidence',
  'claim_completion_without_proof',
  'excessive_low_value_docs',
  'artificial_busywork_tasks',
  'consensus_as_correctness',
])

export function detectSlopClaims({ diffSummary = '', testNotes = '', completionClaim = '' } = {}) {
  const findings = []
  const blob = `${diffSummary}\n${testNotes}\n${completionClaim}`.toLowerCase()
  if (/todo: implement|not implemented|pass\s*\(\s*\)|throw new error\(['"]not implemented/i.test(blob)) {
    findings.push({ smell: 'placeholder_implementation', severity: 'high' })
  }
  if (/tests? passed/i.test(completionClaim) && !/command|exit code|vitest|npm test/i.test(testNotes)) {
    findings.push({ smell: 'claim_completion_without_proof', severity: 'high' })
  }
  if (/expect\(.*\)\.toHaveBeenCalled/.test(testNotes) && !/behavior|outcome|response|render/i.test(testNotes)) {
    findings.push({ smell: 'tautological_tests', severity: 'medium' })
  }
  if (/skip\(|\.only\(|eslint-disable|exit 0/.test(diffSummary) && /to make (ci|tests) pass/i.test(blob)) {
    findings.push({ smell: 'weakened_validation', severity: 'critical' })
  }
  return findings
}
