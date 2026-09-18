# Product context (for agents)

This repo is a **chat-first UI studio**. A user message (optional API URL) becomes a versioned **Widget**. Jev **decides**; code and a **ThemeAdapter** **construct**. Claude Haiku writes only when confidence is low or the catalog cannot express the ask.

## Glossary

| Term | Meaning |
|------|---------|
| **Widget** | Versioned artifact: `LayoutPolicy` + hydrated UI spec + theme id + motion token. The reusable unit, not a screenshot. |
| **LayoutPolicy** | Value-independent layout decision (which widgets, fields, chart type, presentation). Props are filled from live JSON by `applyPolicy`. |
| **ThemeAdapter** | `render(spec, theme) → HTML`. shadcn is the first adapter; catalog lives in `packages/core/src/design-systems/`. Do not leak shadcn into `layout-policy.js`. |
| **DecisionAdapter** | `{ state, questions } → { answers, confidence }`. Implementations: Jev, heuristic, LLM, Local (stub). |
| **Jev** | TypeSafe System One. Typed Choice / Score / Noul in **one parallel call**. No prose. ~70–500ms. |
| **LLM / Haiku** | Anthropic structured spec. Rare fallback. Never send full API payloads — only `inferShape` + instruction excerpt. |
| **Embed** | Public iframe at `/e/:publicId`. Pin with `?v=`. Owner edits at `/w/:publicId` after GitHub OAuth. |
| **Turn** | One chat message → one plan. Stored without raw payloads (shape, fingerprint, Jev answers, planner, latency, rating). |
| **Iterate** | Follow-up that upgrades the session widget in code (tooltip, chart type, hide table, motion). Does not rebuild from a neighbor policy. |

## Routing (code owns the formula)

Replay (Redis fingerprint) → **iterate** (session widget + instruction upgrades) → Jev + `applyPolicy` → Haiku → heuristic.

Same-shape Mongo neighbors are few-shot for Jev only — never a silent replay of a different prompt. One Jev fan-out per new layout. Confidence gates whether to act. See `docs/adr/002-jev-routing.md`.

## Anti-slop UI

Read `design-system/MCP-UI/MASTER.md` before changing `client/` visuals. No Inter-as-default, no purple mesh, no decorative glass (blur only on overlays). IBM Plex Sans + JetBrains Mono; one accent.

## Money

Only TypeSafe (Jev) and Anthropic are paid. Infra: Vercel Hobby, Upstash Redis, MongoDB Atlas M0, GitHub Actions, GitHub OAuth App — all free tiers.

## Agent entry

Non-trivial work: `/ask-matt` then `docs/AI_WORKFLOW.md`. UI work: UI UX Pro Max skill + this MASTER.md. After clone: `npm run skills:install`.
