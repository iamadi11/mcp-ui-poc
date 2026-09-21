import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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

/**
 * Deterministic discovery. Does not invent market demand.
 * Returns candidates that still require prioritization / challenge.
 */
export function discoverCandidates(repoRoot, store, config) {
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

  // Unfinished work is handled by resume, not duplicated as candidates
  const unfinished = discoverUnfinishedCompanyWork(store).filter((c) => c._meta?.preferResume)

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
