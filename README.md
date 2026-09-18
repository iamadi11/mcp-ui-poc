# MCP UI studio

**Live demo:** [mcp-ui-poc.vercel.app](https://mcp-ui-poc.vercel.app/)

Chat-first studio: a message (optional API URL) becomes a versioned **Widget**.
[Jev](https://docs.typesafe.ai/introduction) **decides**; code and a ThemeAdapter **construct**.
Claude Haiku writes only when confidence is low or the catalog cannot express the ask.
Publish a public iframe at `/e/:publicId`. Owners sign in with GitHub to edit.

```
chat turn ─▶ session iterate (if follow-up) / Redis replay ─▶ Jev fan-out ─▶ applyPolicy / rare Haiku ─▶ shadcn ThemeAdapter ─▶ embed URL
```

Glossary: [`CONTEXT.md`](CONTEXT.md). ADRs: [`docs/adr/`](docs/adr/). Visual system: [`design-system/MCP-UI/MASTER.md`](design-system/MCP-UI/MASTER.md).

## Features

- **Follow-up turns** — “add a tooltip”, “hide the table”, “make it a bar chart” upgrade the current session widget (`Iterate`). **New chat** starts a fresh session so the next prompt is not an iterate.
- **Examples tab** — Chat | Examples in the studio rail. Each card is a pasted public API URL plus a prompt; **Send** starts a new chat and generates the widget. Checkout / ecommerce prompts with no URL use a demo shoe cart (not the prompt text as records).
- **Studio chrome** — chat + live preview + Publish. Status stream: `routed` → `fetching` → `planned` → `rendered`. Redis down degrades replay/ratings; generate still works.
- **Jev-first DecisionAdapter** — one parallel TypeSafe call per turn. Replay → iterate → Jev + `applyPolicy` → Haiku → heuristic.
- **Never full payloads to Claude** — `inferShape` + instruction excerpt only; `maxTokens` capped.
- **Redis hot path, Mongo source of truth** — fingerprints and sessions in Upstash; widgets/turns/users on Atlas M0. No long-term raw API dumps.
- **Embeds** — `GET /e/:publicId` (pin `?v=`). Owner UI `/w/:publicId` after GitHub OAuth.
- **Pluggable ThemeAdapter** — `shadcn` (default), `material`, `plain`, `glass`. Catalog stays in `packages/core`; host chrome is shadcn.
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
cp .env.example .env.local   # TYPESAFE_API_KEY, optional ANTHROPIC_API_KEY
npm run skills:install       # once: Matt Pocock + UI UX Pro Max (then /setup-matt-pocock-skills in chat)

npm run dev      # backend :3001
npm run client   # frontend :3000 (proxies /api and /e)
```

Open http://localhost:3000. Local keys stay in **`.env.local`**. Production should **omit** `TYPESAFE_API_KEY` / `ANTHROPIC_API_KEY` so visitors BYOK in Settings.

Local Redis + Mongo (optional, for replay cache, ratings, and durable publish):

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
- CI: `.github/workflows/ci.yml` runs `npm test`, client lint, and `npm run build`.
- **Production env (free infra):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `MONGODB_URI`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `PUBLIC_ORIGIN`.
- **Do not** put TypeSafe or Anthropic keys on Vercel if the site should stay BYOK. Do not put those keys in GitHub Actions secrets.

Callback URL for the GitHub OAuth App: `https://<host>/api/auth/github/callback`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Planner, Jev, Redis, Mongo, OAuth |
| `POST /api/chat/turn` | `{ message, url?, sessionId?, stream? }` SSE: routed/fetching/planned/rendered |
| `POST /api/render-endpoint` | Legacy URL generate (same planner) |
| `POST /api/widgets` | Publish session widget (GitHub session) |
| `GET/PATCH /api/widgets/:publicId` | Public metadata / owner customize |
| `GET /e/:publicId` | Cacheable embed HTML (`?v=` pin) |
| `GET /api/auth/github` | OAuth login |
| `POST /api/feedback` | `{ decisionId, rating: "up"\|"down" }` |
| `POST /api/verify-key` / `verify-jev-key` | BYOK checks |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `client` / `build` | Servers and production client |
| `npm test` | `ui-compose-kit` Vitest |
| `npm run skills:install` / `skills:update` | Agent skills |
| `npm run export:turns` | Anonymized training JSON from Mongo |

Training export: [`docs/training-export.md`](docs/training-export.md). Future `LocalAdapter` stub: `packages/core/src/decisions/local.js`.

## Security

- Fetched payloads are not stored long-term. Turns keep shape, Jev answers, policy, planner, latency, ratings.
- SSRF guard on outbound fetches. Rate limits on chat/generate.
- Embed HTML is public via unguessable `publicId`; edits require GitHub owner session.

## License

MIT — see [LICENSE](LICENSE).
