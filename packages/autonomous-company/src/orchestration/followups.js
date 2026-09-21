/**
 * Post-completion consequence analysis → follow-up work items.
 * Deterministic heuristics (no fabricated customer feedback).
 */

import { departmentForCategory } from '../work/schema.js'

/**
 * Given a completed work item + optional report, propose follow-up candidates.
 * All are labeled hypothesis unless evidence paths exist.
 */
export function proposeFollowUps(completedTask, report = {}) {
  const followUps = []
  const baseKey = completedTask.problemKey || completedTask.id
  const files = completedTask.filesLikely || []
  const category = completedTask.category

  // QA: missing journey coverage after product/ux/bug ship
  if (['product', 'ux', 'bug', 'reliability'].includes(category)) {
    followUps.push({
      category: 'test_gap',
      problemKey: `followup:qa:${baseKey}`,
      title: `Add/confirm validation coverage after: ${completedTask.title}`,
      department: 'qa',
      origin: 'followup',
      parentId: completedTask.id,
      impact: 'Prevent regression of completed work',
      effort: 'S',
      evidence: [
        {
          type: 'followup',
          path: `task:${completedTask.id}`,
          note: 'Parent completed; verify behavior remains covered',
          labeled: 'hypothesis',
        },
      ],
      acceptanceCriteria: [
        'Relevant automated or MANUAL_QA evidence recorded for parent change',
      ],
      filesLikely: files,
      ownerRole: 'qa',
    })
  }

  // Security review residual for security-adjacent files
  if (
    category === 'security' ||
    files.some((f) => /auth|safe|ssrf|sanitize|storage/i.test(f))
  ) {
    followUps.push({
      category: 'security',
      problemKey: `followup:sec-review:${baseKey}`,
      title: `Security residual review: ${completedTask.title}`,
      department: 'security',
      origin: 'followup',
      parentId: completedTask.id,
      impact: 'Catch residual risk after remediation',
      effort: 'S',
      evidence: [
        {
          type: 'followup',
          path: `task:${completedTask.id}`,
          note: 'Parent touched security-sensitive paths',
          labeled: 'hypothesis',
        },
      ],
      acceptanceCriteria: ['Scoped security note recorded; critical issues filed or cleared'],
      filesLikely: files,
      ownerRole: 'security',
    })
  }

  // Docs drift when implementation ships
  if (['product', 'bug', 'reliability', 'security'].includes(category) && report.summary) {
    followUps.push({
      category: 'documentation',
      problemKey: `followup:docs:${baseKey}`,
      title: `Update docs if needed for: ${completedTask.title}`,
      department: 'engineering',
      origin: 'followup',
      parentId: completedTask.id,
      impact: 'Keep operator docs aligned with behavior',
      effort: 'S',
      evidence: [
        {
          type: 'followup',
          path: `task:${completedTask.id}`,
          note: 'Implementation completed; check MANUAL_QA / ADRs / README',
          labeled: 'hypothesis',
        },
      ],
      acceptanceCriteria: ['Docs updated or explicit N/A recorded'],
      filesLikely: ['docs/', 'README.md'],
      ownerRole: 'engineer',
    })
  }

  // Tech debt signal from review notes
  const complexity = report.introducedComplexity || report.complexity
  if (complexity === 'high' || report.flags?.includes('tech_debt')) {
    followUps.push({
      category: 'tech_debt',
      problemKey: `followup:debt:${baseKey}`,
      title: `Assess complexity introduced by: ${completedTask.title}`,
      department: 'debt',
      origin: 'followup',
      parentId: completedTask.id,
      impact: 'Contain maintainability cost of the change',
      effort: 'M',
      evidence: [
        {
          type: 'followup',
          path: `task:${completedTask.id}`,
          note: 'Completion report flagged complexity/tech debt',
          labeled: 'hypothesis',
        },
      ],
      acceptanceCriteria: ['Debt item accepted with impact or explicitly rejected'],
      filesLikely: files,
      ownerRole: 'debt',
    })
  }

  return followUps.map((f) => ({
    ...f,
    department: f.department || departmentForCategory(f.category),
  }))
}

/**
 * Product feedback loop checklist after completion (recorded, not invented metrics).
 */
export function buildProductFeedback(completedTask, report = {}) {
  return {
    before: {
      problem: completedTask.problem || completedTask.title,
      evidenceLabels: (completedTask.evidence || []).map((e) => e.labeled),
    },
    after: {
      summary: report.summary || null,
      validation: (report.validationResults || []).map((v) => ({
        command: v.command,
        status: v.status,
        exitCode: v.exitCode,
      })),
    },
    questions: [
      'Does software behave differently in a way covered by validation evidence?',
      'Did we introduce complexity that needs a debt follow-up?',
      'What remains unvalidated?',
    ],
    at: new Date().toISOString(),
  }
}
