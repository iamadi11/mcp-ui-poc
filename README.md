# MCP UI studio

**Live demo:** [mcp-ui-poc.vercel.app](https://mcp-ui-poc.vercel.app/)

Chat-first studio: a message (optional API URL) becomes a versioned **Widget**.
A System 1 **DecisionAdapter** ([Laya](https://laya.convaiinnovations.com/) open-weight, or [Jev](https://docs.typesafe.ai/introduction) BYOK) **decides**; code and a ThemeAdapter **construct**.
An LLM fills copy slots on catalog layouts (`needs_llm`) **or generates HTML** when the catalog cannot express the ask — prefer OpenAI-compatible open models via `OPENAI_BASE_URL`.
Publish a public iframe at `/e/:publicId`. Owners sign in with GitHub to edit.

```
chat turn ─▶ bind fixture or fetch URL ─▶ Laya/Jev fan-out (live; fingerprint replay off) ─▶ applyPolicy + ThemeAdapter pack ─▶ LLM copy slots or HTML generate ─▶ embed URL
```

Glossary: [`CONTEXT.md`](CONTEXT.md). ADRs: [`docs/adr/`](docs/adr/). Visual system: [`design-system/MCP-UI/MASTER.md`](design-system/MCP-UI/MASTER.md).

## Features

- **Follow-up turns** — “add a tooltip”, “hide the table”, “make it a bar chart” upgrade the current session widget. **New chat** starts a fresh session. Then **Publish** to embed `/e/:id`.
- **Turns** — each successful send is kept on the chat. Restore from Recents (`/?c=:id`), then follow up or **Publish**. Published widgets keep server-side versions; `/e/:id` is live, `/e/:id?v=` is pinned.
- **Connect your look** — Settings sheet: starter packs, paste CSS variables, or upload tokens.json. The pack restyles the catalog and is stored on the widget so the embed stays branded.
- **Prompt-first** — describe a UI, paste a JSON URL in the message, or both. No separate API URL field. Text-only prompts bind a demo/sketch so the planner still has records to lay out. Starters: Login, Dashboard, Landing, Checkout.
- **Chat history** — Recents in an overlay (scrim, not a layout column). **Remove** / **Clear** hide chats from the list (soft delete) and archive prompts + policies for later model training; HTML and API payloads are not kept.
- **Studio chrome** — canvas-first: describe → see → talk → share. Human stages: Fetching data → Designing layout → Rendering. The chat rail shows live thinking on every turn. Optional `?debug=1` shows planner traces.
- **DecisionAdapter (Laya or Jev)** — one System 1 fan-out per generate. Prefer open **Laya** (`LAYA_BASE_URL` sidecar or ONNX); TypeSafe **Jev** remains optional BYOK. Redis fingerprint replay is **off**; every Studio send plans live (`fresh: true`). Login, landing, checkout, pricing, and map/editor workspaces are catalog primitives. Out-of-catalog asks go to LLM HTML generate. See `docs/adr/002-jev-routing.md`, `docs/adr/007-oss-decision-llm.md`, and `docs/adr/006-design-packs.md`.
- **Never full payloads to the LLM** — `inferShape` + instruction excerpt only. Copy slots when a catalog layout sets `needs_llm`, or **sanitized HTML** when `catalogCannotExpress`. Default open path: `OPENAI_BASE_URL` (Ollama / Groq / OpenRouter).
- **Redis + Mongo** — sessions and optional cache in Upstash/Redis; widgets/turns/users on Atlas M0. Fingerprint replay is not used on the Studio hot path. No long-term raw API dumps.
- **Embeds** — `GET /e/:publicId` (pin `?v=`). Owner UI `/w/:publicId` after GitHub OAuth.
- **Pluggable ThemeAdapter** — default Studio pack (MASTER teal). Developers may `registerDesignSystem` with a custom `render`. Studio users connect packs, not JavaScript.
- **Safety** — SSRF guard, HTML size cap, rate limits on generate and chat turns.

## Project structure

```
mcp-ui-poc/
├── client/        # React + Vite studio
├── server/        # Express: chat SSE, OAuth, widgets, embed
├── packages/core/ # ui-compose-kit: planner, DecisionAdapter, design systems
├── design-system/ # MASTER.md for host chrome
└── api/           # Vercel serverless entry
```

## Getting started

```bash
git clone <repository-url> && cd mcp-ui-poc
npm install && npm run install-all
cp .env.example .env.local   # optional: LAYA_BASE_URL, OPENAI_BASE_URL, or TYPESAFE/ANTHROPIC BYOK
npm run skills:install       # once: Matt Pocock + UI UX Pro Max (then /setup-matt-pocock-skills in chat)

npm run dev      # backend :3001
npm run client   # frontend :3000 (proxies /api and /e)
```

Open http://localhost:3000. Local keys stay in **`.env.local`**. Production should **omit** `TYPESAFE_API_KEY` / `ANTHROPIC_API_KEY` so visitors BYOK in Settings. A referrer-restricted `GOOGLE_MAPS_API_KEY` may stay on the server so published map embeds can load the Maps SDK.

Local Redis + Mongo (optional, for sessions, ratings, and durable publish):

```bash
# macOS
brew services start redis
brew services start mongodb-community@8.0
# or: docker compose up -d
```

Then in `.env.local`:

```
REDIS_URL=redis://127.0.0.1:6379
MONGODB_URI=mongodb://127.0.0.1:27017/mcp_ui
MONGODB_DB=mcp_ui
```

Health should read `store: redis-local · mongo: local`. Production uses Upstash REST (`UPSTASH_REDIS_*`) and Atlas (`mongodb+srv`). GitHub OAuth remains optional (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `PUBLIC_ORIGIN=http://localhost:3000`).

## Vercel (Hobby) + GitHub

- Git integration: `main` → production, PRs → preview.
- CI: `.github/workflows/ci.yml` runs `npm test`, `npm run company:test`, client lint, and `npm run build`.
- **Production env (free infra):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `PUBLIC_ORIGIN`.
- **Do not** put TypeSafe or Anthropic keys on Vercel if the site should stay BYOK. Do not put those keys in GitHub Actions secrets.

Callback URL for the GitHub OAuth App: `https://<host>/api/auth/github/callback`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Planner, Jev, Redis, Mongo, OAuth, Maps; `jevFromEnv` / `aiFromEnv` when keys are on the server |
| `POST /api/chat/turn` | `{ message, url?, sessionId?, stream?, fresh?, history?, goal?, themePack? }` SSE: stage + thinking traces, then rendered |
| `POST /api/chat/restore` | `{ sessionId, widget }` restore a prior turn into the session |
| `POST /api/chat/customize` | `{ sessionId, themeId?, themePack?, motion?, look?, sourceUrl?, publicId? }` re-render; PATCH live URL if `publicId` |
| `GET /api/design-packs` | Starter packs |
| `POST /api/design-packs/preview` | `{ starter? | css? | tokensJson? | pack? }` login + landing HTML samples |
| `POST /api/render-endpoint` | Legacy URL generate (same planner) |
| `POST /api/widgets` | Publish session widget (GitHub session). Pass `publicId` to append a version. |
| `GET/PATCH /api/widgets/:publicId` | Metadata / owner customize. PATCH `{ restoreVersion }` makes that version live. |
| `GET /e/:publicId` | Cacheable embed HTML (`?v=` pin) |
| `GET /api/auth/github` | OAuth login |
| `POST /api/feedback` | `{ decisionId, rating: "up"\|"down" }` |
| `POST /api/verify-key` / `verify-jev-key` | BYOK checks |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `client` / `build` | Servers and production client |
| `npm test` | `ui-compose-kit` Vitest |
| `npm run company` / `company:test` | Autonomous company CLI / its tests (`docs/autonomous-company/`) |
| `npm run skills:install` / `skills:update` | Agent skills |
| `npm run export:turns` | Anonymized training JSON from Mongo |

Training export: [`docs/training-export.md`](docs/training-export.md). Future `LocalAdapter` stub: `packages/core/src/decisions/local.js`.

## Security

- Fetched payloads are not stored long-term. Turns keep shape, Jev answers, policy, planner, latency, ratings.
- SSRF guard on outbound fetches. Rate limits on chat/generate.
- Embed HTML is public via unguessable `publicId`; edits require GitHub owner session.

## License

MIT — see [LICENSE](LICENSE).
