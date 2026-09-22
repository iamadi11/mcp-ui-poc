# Product context (for agents)

This repo is a **chat-first UI studio**. A user **prompt** becomes a versioned **Widget**. The prompt may include JSON API URLs, describe a UI in plain language, or both. A System 1 **DecisionAdapter** (open **Laya**, or paid **Jev**) **decides**; code and a **ThemeAdapter** **construct**. An LLM fills copy slots and generates HTML for out-of-catalog UIs — prefer OpenAI-compatible open models (`OPENAI_BASE_URL`), with Anthropic/Gemini as optional BYOK. Each turn includes the **session goal** plus recent user messages so follow-ups remember the original ask.

## Glossary

| Term | Meaning |
|------|---------|
| **Widget** | Versioned artifact: `LayoutPolicy` + hydrated UI spec + theme id + **theme pack** + motion token. The reusable unit, not a screenshot. |
| **LayoutPolicy** | Value- and token-independent layout decision (which widgets, fields, chart type, presentation). Props are filled from live JSON by `applyPolicy`. |
| **Design System Pack** | Tokens + optional sanitized CSS + `supports[]`. Restyles the catalog. Studio users never upload JavaScript. |
| **ThemeAdapter** | `render(spec, pack) → HTML`. shadcn is the first adapter; catalog lives in `packages/core/src/design-systems/`. Do not leak CSS into `layout-policy.js`. Map `work-stage` injects the Google Maps JS API at render from env/header — never persist the key on the spec. Without a key, the canvas asks for a browser key and loads the Drawing library in the iframe. |
| **DecisionAdapter** | `{ state, questions } → { answers, confidence }`. Implementations: Laya, Jev, heuristic, LLM, Local (stub). |
| **Laya** | Open-weight System 1 (ConvAI). Same Choice / Score / Noul primitives as Jev. Preferred when `LAYA_BASE_URL` or ONNX is configured. HTTP sidecar: `services/laya-sidecar`. See `docs/adr/007-oss-decision-llm.md`. |
| **Jev** | TypeSafe System One (paid). Typed Choice / Score / Noul in **one parallel call**. No prose. ~70–500ms. Optional BYOK when Laya is not configured. Catalog includes dashboards, login, landing, checkout, pricing, form, settings, calendar, and map/board workspaces. Out-of-catalog asks (games, branded looks, graffiti) are routed to the generative LLM. |
| **LLM** | Copy slots (`title` / `kicker` / `subtitle`) on catalog layouts. For prompts the catalog cannot express, generates a sanitized HTML widget. DecisionAdapter still chooses look, motion, and iterate vs create. Prefer `openai` + `OPENAI_BASE_URL` (Ollama / Groq / OpenRouter / vLLM). Anthropic Haiku and Gemini remain optional. Never send full API payloads — only `inferShape` + instruction excerpt. |
| **Embed** | Public iframe at `/e/:publicId`. Unpinned URL serves **live** `currentVersion`. Pin with `?v=`. Owner edits at `/w/:publicId` after GitHub OAuth. |
| **Turn** | One chat message → one plan, with the session’s original request and recent user messages as context. URLs in the message are fetched; otherwise a demo/sketch payload is bound so text-only prompts still generate a widget. Stored without raw API payloads. |
| **Chat history** | Recents in a sidebar. Deep link `/?c=:id`. **Remove** is a soft delete: hidden from Recents, archived (no HTML/payloads) for later Jev/LLM training. |
| **Iterate** | Follow-up that upgrades the session widget (tooltip, chart type, hide table, motion, look). Does not rebuild from a neighbor policy. |

## Routing (code owns the formula)

Redis fingerprint replay is **off**. Every Studio turn plans live: **Laya or Jev** + `applyPolicy` → LLM **copy slots** if `needs_llm` on a catalog layout, or **HTML generate** if the catalog cannot express the ask (brand, graffiti, games, asking again) → catalog / heuristic when no decision backend is configured.

Session follow-ups (`make it vivid`) still upgrade the current widget. Create prompts never replay a previous cart or fingerprint.

## Anti-slop UI

Read `design-system/MCP-UI/MASTER.md` before changing `client/` visuals. Journey copy: `design-system/MCP-UI/pages/studio.md`. No Inter-as-default, no purple mesh, no decorative glass (blur only on overlays). IBM Plex Sans + JetBrains Mono; one accent.

## Money

Paid optional: TypeSafe (Jev) and Anthropic. Open defaults: Laya sidecar + OpenAI-compatible OSS models (`OPENAI_BASE_URL`). Infra: Vercel Hobby, Upstash Redis, MongoDB Atlas M0, GitHub Actions, GitHub OAuth App — free tiers.

## Agent entry

Non-trivial work: `/ask-matt` then `docs/AI_WORKFLOW.md`. UI work: UI UX Pro Max skill + this MASTER.md. After clone: `npm run skills:install`.

Long-running autonomous SDLC for the **studio**: `/autonomous-company` (skill) and `npm run company` (durable controller). See `docs/autonomous-company/`.

**Mac Agent** (local-first macOS control app) lives in-repo at `mac-agent/` (Swift AgentCore + docs). Single-entry Director: `/autonomous` and `npm run autonomous` (decide→delegate→verify loop with `.agent/state` under `mac-agent/`). Distinct from Company OS — do not conflate the two entry points.
