# Product-gap reference

## Path map (LightStar → this repo)

| LightStar-style | This repo |
|-----------------|-----------|
| `company/os/discovery.py` | `packages/autonomous-company/src/discovery/engine.js` + `roadmap.js` |
| `engineering-roadmap.md` | `docs/engineering-roadmap.md` |
| `.cursor/skills/autonomous-company/` | `.cursor/skills/autonomous-company/` (+ `.claude/skills/autonomous-company/` mirror) |
| product-gap skill | `.cursor/skills/autonomous-company-product-gap/` (+ `.claude` mirror) |
| `./scripts/autonomous-company start` | `npm run company -- start` |

## Selected table contract

Markdown section heading must match `/selected|must implement/i`.

Pipe table columns (order flexible; headers matched case-insensitively):

- **ID** — e.g. `EE-001`
- **Type** — `feature` \| `fix` (also `bug`, `security`, `product`)
- **Title** — short outcome
- **Evidence** — paths/issues (required for honesty)
- **Acceptance** (optional) — done-when

Deferred section heading matches `/deferred/i`. Same columns.

## Candidate shape

```js
{
  category: 'security' | 'bug' | 'product' | ...,
  problemKey: 'roadmap:EE-001',
  title: '[EE-001] ...',
  department: 'engineering',
  confidence: 0.85, // Selected ≥ 0.8; Deferred ~0.35
  origin: 'roadmap:selected' | 'roadmap:deferred',
  roadmapId: 'EE-001',
  workType: 'fix' | 'feature',
  evidence: [{ type: 'roadmap', path: 'docs/engineering-roadmap.md', labeled: 'verified' }],
}
```

## Stop / idle reasons

| Reason | Meaning |
|--------|---------|
| `HIGH_VALUE_WORK_EXISTS` | Selected/engineering READY or BLOCKED-for-Cursor in pool — keep ticking |
| `ONLY_SPECULATIVE_OR_DEFERRED` | Only deferred/hypothesis/cadence fluff — load product-gap skill; idle if Selected empty |
| `NO_ACTIONABLE_HIGH_VALUE_TASK` | No READY/BLOCKED engineering product work after discovery |

## BLOCKED-for-Cursor message

Exact executor string:

`Requires Cursor agent / engineering worker (LLM) — implement Selected roadmap item`
