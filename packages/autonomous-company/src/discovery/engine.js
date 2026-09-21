import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { discoverEngineeringRoadmap } from './roadmap.js'

const TODO_RE = /\b(TODO|FIXME|HACK|XXX)(?:\s*[:\-—]\s*|\s+)([^\n*]{8,160})/g

const SKIP_DIR = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.autonomous-company',
  '.agents',
  '.vercel',
  'vendor',
])

function walkFiles(root, dirs, extensions, maxFiles = 400) {
  const out = []
  const stack = dirs.map((d) => join(root, d)).filter((p) => existsSync(p))
  while (stack.length && out.length < maxFiles) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.github') continue
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        if (!SKIP_DIR.has(ent.name)) stack.push(full)
        continue
      }
      if (!extensions.some((ext) => ent.name.endsWith(ext))) continue
      out.push(full)
    }
  }
  return out
}

function readSafe(path, maxBytes = 200_000) {
  try {
    const st = statSync(path)
    if (st.size > maxBytes) return null
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

export function discoverTodoMarkers(repoRoot, { maxCandidates = 25 } = {}) {
  const files = walkFiles(
    repoRoot,
    ['server', 'client/src', 'packages/core/src', 'docs'],
    ['.js', '.jsx', '.mjs', '.cjs', '.md'],
  )
  const candidates = []
  for (const file of files) {
    const text = readSafe(file)
    if (!text) continue
    TODO_RE.lastIndex = 0
    let match
    while ((match = TODO_RE.exec(text)) && candidates.length < maxCandidates) {
      const marker = match[1]
      const detail = match[2].trim()
      const rel = relative(repoRoot, file)
      candidates.push({
        category: marker === 'FIXME' ? 'bug' : 'tech_debt',
        problemKey: `todo:${rel}:${detail.slice(0, 80)}`,
        title: `${marker} in ${rel}: ${detail.slice(0, 100)}`,
        evidence: [
          {
            type: 'repository',
            path: rel,
            excerpt: match[0].slice(0, 200),
            labeled: 'verified',
          },
        ],
        hypothesis: null,
        impact: marker === 'FIXME' ? 'Correctness risk if left unresolved' : 'Maintainability drag',
        effort: 'S',
        ownerRole: 'debt',
        filesLikely: [rel],
        acceptanceCriteria: [`Resolve or convert marker in ${rel} with evidence`],
        validationPlan: ['Relevant unit/lint checks for touched files'],
      })
    }
  }
  return candidates
}

export function discoverTestGaps(repoRoot) {
  const srcDir = join(repoRoot, 'packages/core/src')
  const testDir = join(repoRoot, 'packages/core/test')
  if (!existsSync(srcDir) || !existsSync(testDir)) return []

  const srcFiles = walkFiles(repoRoot, ['packages/core/src'], ['.js'])
  const testFiles = new Set(
    walkFiles(repoRoot, ['packages/core/test'], ['.js']).map((f) =>
      relative(join(repoRoot, 'packages/core/test'), f).replace(/\.test\.js$/, ''),
    ),
  )

  const candidates = []
  for (const src of srcFiles) {
    const base = relative(srcDir, src).replace(/\.js$/, '')
    // Heuristic: top-level modules with no similarly named test
    if (base.includes('/')) continue
    const hasTest =
      testFiles.has(base) ||
      [...testFiles].some((t) => t.includes(base) || base.includes(t.replace(/\.test$/, '')))
    if (hasTest) continue
    const rel = relative(repoRoot, src)
    candidates.push({
      category: 'test_gap',
      problemKey: `testgap:${rel}`,
      title: `Possible test gap for ${rel}`,
      evidence: [
        {
          type: 'repository',
          path: rel,
          note: 'No similarly named test file under packages/core/test',
          labeled: 'hypothesis',
        },
      ],
      hypothesis: 'Module may lack focused seam tests',
      impact: 'Regression risk for planner/core behavior',
      effort: 'M',
      ownerRole: 'qa',
      filesLikely: [rel],
      acceptanceCriteria: [
        'Either add a meaningful seam test or document why none is warranted',
      ],
      validationPlan: ['npm test --workspace=ui-compose-kit'],
      risks: ['Heuristic may false-positive for internal helpers'],
    })
  }
  return candidates
}

export function discoverUnfinishedCompanyWork(store) {
  const candidates = []
  for (const summary of store.pool?.tasks || []) {
    if (!['active', 'blocked', 'in_review', 'failed'].includes(summary.status)) continue
    const task = store.paths ? null : null
    candidates.push({
      category: 'unfinished',
      problemKey: `unfinished:${summary.id}`,
      title: `Resume unfinished: ${summary.title}`,
      evidence: [
        {
          type: 'project_memory',
          taskId: summary.id,
          status: summary.status,
          labeled: 'verified',
        },
      ],
      impact: 'Incomplete work creates drift and duplicate risk',
      effort: 'S',
      ownerRole: 'em',
      acceptanceCriteria: [`Resolve task ${summary.id} to completed, abandoned, or blocked with reason`],
      validationPlan: ['Continue from durable run state; do not recreate task'],
      // Prefer handling via resume, not new task creation
      _meta: { preferResume: true, existingTaskId: summary.id },
    })
  }
  return candidates
}

export function discoverManualQaGaps(repoRoot) {
  const manual = join(repoRoot, 'docs/MANUAL_QA.md')
  if (existsSync(manual)) return []
  return [
    {
      category: 'documentation',
      problemKey: 'docs:missing-manual-qa',
      title: 'Missing docs/MANUAL_QA.md for journey validation',
      evidence: [
        {
          type: 'repository',
          path: 'docs/MANUAL_QA.md',
          note: 'File not found',
          labeled: 'verified',
        },
      ],
      impact: 'UI validation lacks a shared checklist',
      effort: 'S',
      ownerRole: 'qa',
      acceptanceCriteria: ['Add or restore MANUAL_QA journey checklist'],
      validationPlan: ['File exists and covers studio chat → preview'],
    },
  ]
}

const ISSUE_NUM_RE = /(?:github[:_-]?issue[:_-]?|#)(\d+)/gi

/** Collect GitHub issue numbers already tracked in the durable pool. */
export function resolvedIssueNumbersFromPool(store) {
  const nums = new Set()
  const tasksDir = store?.paths?.tasksDir
  if (!tasksDir || !existsSync(tasksDir)) {
    for (const summary of store?.pool?.tasks || []) {
      collectIssueNums(`${summary.problemKey || ''} ${summary.title || ''}`, nums)
    }
    return nums
  }
  for (const name of readdirSync(tasksDir)) {
    if (!name.endsWith('.json') || name === 'pool.json') continue
    try {
      const task = JSON.parse(readFileSync(join(tasksDir, name), 'utf8'))
      collectIssueNums(`${task.problemKey || ''} ${task.title || ''}`, nums)
    } catch {
      /* ignore corrupt */
    }
  }
  return nums
}

function collectIssueNums(text, nums) {
  ISSUE_NUM_RE.lastIndex = 0
  let m
  while ((m = ISSUE_NUM_RE.exec(text))) {
    nums.add(Number(m[1]))
  }
}

function categorizeIssue(issue) {
  const blob = `${issue.title || ''}\n${issue.body || ''}`.toLowerCase()
  if (/severity:\s*high|ssrf|xss|inject|secret|auth|phishing|javascript:/.test(blob)) {
    return 'security'
  }
  if (/timeout|cache|rate.?limit|hang|reliab/.test(blob)) return 'reliability'
  if (/test/.test(blob)) return 'test_gap'
  if (/truncat|ux|ui /.test(blob)) return 'ux'
  return 'bug'
}

function isNonActionableIssue(issue) {
  const title = String(issue.title || '').trim()
  const body = String(issue.body || '').trim()
  if (title.length < 12 && !/severity|fix|###/i.test(body)) return true
  if (/^(looks cool|nice|thanks|lgtm)\b/i.test(title) && body.length < 80) return true
  if (!/severity|fix|### |\*\*fix\*\*/i.test(body) && body.length < 40) return true
  return false
}

/**
 * Fetch open GitHub issues via `gh` when available.
 * @param {{ listIssues?: () => object[] }} [hooks] - test seam
 */
export function discoverOpenIssues(repoRoot, store, { listIssues } = {}) {
  let issues = []
  if (typeof listIssues === 'function') {
    issues = listIssues() || []
  } else {
    const result = spawnSync(
      'gh',
      ['issue', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,body,labels'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 15_000 },
    )
    if (result.status !== 0 || !result.stdout) return []
    try {
      issues = JSON.parse(result.stdout)
    } catch {
      return []
    }
  }

  const resolved = resolvedIssueNumbersFromPool(store)
  const candidates = []
  for (const issue of issues) {
    const n = Number(issue.number)
    if (!Number.isFinite(n) || resolved.has(n)) continue
    if (isNonActionableIssue(issue)) continue
    const category = categorizeIssue(issue)
    candidates.push({
      category,
      problemKey: `github:issue:${n}`,
      title: `${issue.title} (#${n})`,
      evidence: [
        {
          type: 'github_issue',
          path: `https://github.com/issues/${n}`,
          note: String(issue.body || '').slice(0, 240),
          labeled: 'verified',
        },
      ],
      impact: `Open GitHub issue #${n}`,
      effort: 'M',
      ownerRole: category === 'security' ? 'security' : 'engineer',
      filesLikely: [],
      acceptanceCriteria: [
        `Address or explicitly defer GitHub issue #${n} with evidence`,
      ],
      validationPlan: ['Relevant unit/lint checks for touched files'],
      risks: ['Issue may be partially fixed already — verify before re-implementing'],
    })
  }
  return candidates
}

/**
 * Deterministic discovery. Does not invent market demand.
 * Returns candidates that still require prioritization / challenge.
 */
export function discoverCandidates(repoRoot, store, config, options = {}) {
  const max = config.discovery.maxCandidates
  const all = []

  if (config.discovery.scanTodoMarkers) {
    all.push(...discoverTodoMarkers(repoRoot, { maxCandidates: max }))
  }
  if (config.discovery.scanTestGaps) {
    all.push(...discoverTestGaps(repoRoot))
  }
  if (config.discovery.scanDocDriftHints) {
    all.push(...discoverManualQaGaps(repoRoot))
  }
  if (config.discovery.includeOpenIssues) {
    all.push(...discoverOpenIssues(repoRoot, store, options))
  }
  if (config.discovery.scanEngineeringRoadmap !== false) {
    all.push(...discoverEngineeringRoadmap(repoRoot, options))
  }

  // Unfinished work is handled by resume, not duplicated as candidates
  const unfinished = discoverUnfinishedCompanyWork(store).filter((c) => c._meta?.preferResume)

  // Prefer Selected roadmap rows ahead of ops/test-gap noise when capping
  all.sort((a, b) => {
    const aSel = a.origin === 'roadmap:selected' ? 1 : 0
    const bSel = b.origin === 'roadmap:selected' ? 1 : 0
    if (aSel !== bSel) return bSel - aSel
    return (b.confidence || 0) - (a.confidence || 0)
  })

  const deduped = []
  const seen = new Set()
  for (const c of all) {
    if (seen.has(c.problemKey)) continue
    seen.add(c.problemKey)
    if (!c.evidence || c.evidence.length < config.discovery.minEvidenceCount) continue
    deduped.push(c)
    if (deduped.length >= max) break
  }

  return {
    candidates: deduped,
    unfinishedTaskIds: unfinished.map((u) => u._meta.existingTaskId),
    scannedAt: new Date().toISOString(),
  }
}
