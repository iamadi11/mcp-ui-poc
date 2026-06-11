# MCP UI: Endpoint → Design-System UI

**Live demo:** [mcp-ui-poc.vercel.app](https://mcp-ui-poc.vercel.app/)

Point at any API endpoint. An AI layer analyses the response and composes a UI
from a registered design system, returned as an
[MCP UI](https://mcpui.dev/) resource and rendered in a sandboxed iframe via
`@mcp-ui/client`'s `UIResourceRenderer`.

```
endpoint URL ─▶ SSRF-guarded fetch ─▶ AI/heuristic planner ─▶ design-system render ─▶ MCP UI resource
```

## Features

- **Multi-LLM planner** — Anthropic, OpenAI, or Gemini (`packages/core`,
  published as `ui-compose-kit`); falls back to a deterministic heuristic
  planner when no API key is configured.
- **Pluggable design systems** — `glass` (default), `shadcn`, `material`,
  `plain`. The AI picks from a fixed component catalog (stat-grid, table,
  list, chart, alert, action-row, etc.) enforced by JSON schema.
- **Instruction-driven** — free-form prompts steer field selection, chart
  type, and layout (`page`, `modal`, or `component` presentation).
- **Glassmorphism shell** — frosted-glass UI with a live appearance panel
  (blur, frost, mesh, etc.), persisted to `localStorage`.
- **Safety by default** — SSRF guard on outbound fetches, response size/time
  caps, generated-HTML size cap, per-IP rate limiting.

## Project structure

```
mcp-ui-poc/
├── client/        # React + Vite frontend (Tailwind v4, shadcn/ui)
├── server/        # Express API (routes, SSRF-guarded fetch, rate limits)
├── packages/core/ # ui-compose-kit: planner, LLM adapters, design systems
└── api/           # Vercel serverless entry point
```

See [`packages/core/README.md`](packages/core/README.md) for the
`ui-compose-kit` package (adapters, design-system authoring, presentation
modes).

## Getting started

```bash
git clone <repository-url> && cd mcp-ui-poc
npm install && npm run install-all
cp .env.example .env   # add ANTHROPIC_API_KEY (or OPENAI_/GEMINI_)

npm run dev      # backend on :3001
npm run client   # frontend on :3000 (proxies /api to :3001)
```

Open http://localhost:3000.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Server status, planner/model, design systems, LLM providers |
| `GET /api/design-systems` | List registered design systems |
| `POST /api/design-systems/active` | Set active design system (`{ id }`) |
| `POST /api/verify-key` | Validate a client-supplied LLM API key |
| `POST /api/render-endpoint` | `{ url, method?, headers?, body?, instructions?, designSystem?, llmProvider? }` → MCP UI resource |

### Key environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | — / `claude-haiku-4-5-20251001` | Anthropic adapter |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o` | OpenAI adapter |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — / `gemini-2.0-flash` | Gemini adapter |
| `LLM_PROVIDER` | `anthropic` | Default provider (override per-request via `llmProvider`) |
| `MCP_DESIGN_SYSTEM` | `glass` | Default design system (`glass`\|`shadcn`\|`material`\|`plain`) |
| `MCP_ALLOW_PRIVATE_ENDPOINTS` | unset | Allow private/loopback fetch targets (local dev) |
| `MCP_MAX_HTML_BYTES` | `786432` | Max generated HTML size (returns 413 over limit) |
| `MCP_RATE_LIMIT_GENERATE_PER_MIN` | `45` | Per-IP limit on `/api/render-endpoint` |

See [`.env.example`](.env.example) for the full list.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start backend (nodemon, :3001) |
| `npm run client` | Start frontend dev server (:3000) |
| `npm run build` | Build frontend for production |
| `npm run install-all` | Install client + server dependencies |
| `npm run lint` (from `client/`) | Lint frontend |

## Security

- No persistent storage — each request is stateless.
- SSRF guard rejects private/loopback endpoints unless explicitly allowed.
- MCP UI resources render in a sandboxed iframe; host communication is
  limited to `postMessage` `notify`/`link` actions.

## License

MIT — see [LICENSE](LICENSE).

---

**Stack:** React, Vite, Tailwind CSS v4, shadcn/ui, Node.js, Express,
`@anthropic-ai/sdk`, `openai`, `@google/genai`, `@mcp-ui/server`, `@mcp-ui/client`.
