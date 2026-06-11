# MCP UI: Endpoint → Design-System UI

Point at any API endpoint. The server fetches the data, an AI layer (Anthropic Claude)
analyses it and decides which components to use from a **registered design system**
(shadcn/ui, Material UI, or your own), and the result comes back as an
**MCP UI resource** ([mcpui.dev](https://mcpui.dev/)) rendered in the client with
`@mcp-ui/client`'s `UIResourceRenderer`.

The client is intentionally focused: one core flow (Endpoint → UI) plus a
**glassmorphism appearance panel** for tuning the shell's frosted-glass look.

## Core flow

```
endpoint URL ──▶ data fetch (SSRF-guarded, size/time capped)
            ──▶ AI planner (@anthropic-ai/sdk, structured output → UI spec)
            ──▶ design-system renderer (registered at setup)
            ──▶ @mcp-ui/server createUIResource ──▶ UIResourceRenderer (client)
```

- **Design-system registry** (`packages/core/src/design-systems/registry.js`,
  exported via the `ui-compose-kit` workspace package): systems are registered at
  setup. Built-ins: `glass` (default), `shadcn`, `material`, `plain` (a template for
  your own). Select via `MCP_DESIGN_SYSTEM` env or `POST /api/design-systems/active`.
- **Component catalog**: each system exposes `stat-grid`, `table`, `list`,
  `key-value`, `chart` (bar/line/pie), `text`, `badge-row`, `alert`, and `action-row`
  (buttons that send `link`/`notify` actions back to the host); the AI may only pick
  from this catalog (enforced by a JSON schema on the model output).
- **AI layer** (`packages/core/src/planner.js` + `packages/core/src/llm/`):
  multi-provider — Anthropic (`claude-haiku-4-5-20251001` by default, override with
  `ANTHROPIC_MODEL`), OpenAI (`OPENAI_API_KEY`/`OPENAI_MODEL`), and Gemini
  (`GEMINI_API_KEY`/`GEMINI_MODEL`). Pick a default with `LLM_PROVIDER`, or override
  per-request with `llmProvider`. Tables are sent as column definitions + `rowsPath`;
  the server hydrates rows from the original payload so the model never copies bulk
  data. Without a key, a deterministic heuristic planner keeps the flow working.
- **Presentation**: the spec includes `presentation: "page" | "modal" | "component"`.
  User instructions drive this — e.g. "show this in a popup" produces a single
  centered dialog (`presentation: "modal"`), and "component" renders a single bare
  component with no page chrome for inline embedding. The heuristic planner detects
  "popup"/"modal"/"dialog"/"overlay" in instructions as a fallback.
- **Instruction-driven design**: the AI follows free-form instructions for field
  selection ("just show temperature and humidity"), component choice ("as a bar
  chart"), status callouts (`alert`), and actions (`action-row` — buttons that emit
  `link`/`notify` to the host app).
- **Data of any type**: JSON (arrays, objects), or plain text; payload sampled and
  truncated before it reaches the model.
- **Safety**: private/loopback endpoints rejected (override with
  `MCP_ALLOW_PRIVATE_ENDPOINTS=1`), 2 MiB response cap, 15 s timeout.

Endpoints: `POST /api/render-endpoint` (`{ url, method?, headers?, body?,
instructions?, designSystem? }`), `GET /api/design-systems`,
`POST /api/design-systems/active`, `GET /api/health`. Setup: copy `.env.example` →
`.env` and set `ANTHROPIC_API_KEY`.

## Glassmorphism controls

The **Glass** panel (bottom-right floating button) tunes the shell's frosted-glass
appearance in real time: blur, frost, edge light, color saturation, backdrop mesh
strength, and corner roundness. Values persist to `localStorage` under
`mcp-ui-glass-settings-v1` and respect `prefers-color-scheme` and
`prefers-reduced-motion`.

## Project structure

```
mcp-ui-poc/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx              # Hero, health check, endpoint UI section, glass controls
│   │   ├── App.css              # Theme tokens, glass styles, layout
│   │   ├── EndpointToUI.jsx     # Endpoint → UI form, sample chips, result + spec viewer
│   │   ├── GlassControls.jsx    # Glass appearance panel (FAB + sliders)
│   │   ├── apiError.js          # Fetch error helper (JSON body, 429 / 413 hints)
│   │   ├── glassAppearance.js   # Glass CSS variables + persistence
│   │   ├── index.css            # Tailwind v4 + shadcn semantic tokens (`@theme inline`)
│   │   ├── main.jsx             # React entry
│   │   ├── components/ui/       # shadcn/ui primitives (Button, Card, Input, Label, Select)
│   │   └── lib/utils.js         # `cn()` helper (clsx + tailwind-merge)
│   ├── components.json          # shadcn/ui config (`tsx: false` → `.jsx` output)
│   ├── jsconfig.json            # `@/*` → `src/*` for imports
│   ├── package.json
│   └── vite.config.js           # Tailwind Vite plugin, `@` alias, `/api` proxy
├── server/                      # Express API
│   ├── index.js                 # Routes: health, design-systems, verify-key, render-endpoint
│   ├── data-source.js           # SSRF-guarded fetch, size/time caps
│   ├── generated-html-limit.js  # MCP_MAX_HTML_BYTES guard + 413 helpers
│   ├── rate-limits.js           # Per-IP limit on /api/render-endpoint
├── packages/core/                # `ui-compose-kit` workspace package
│   ├── src/
│   │   ├── planner.js           # AI + heuristic planner, JSON schemas, table hydration
│   │   ├── schema.js            # uiSpecSchema (component catalog, presentation modes)
│   │   ├── llm/                 # Adapter registry + anthropic/openai/gemini adapters
│   │   └── design-systems/      # registry.js, glass.js, shadcn.js, material.js, plain.js, spec-html.js
│   └── README.md                # ui-compose-kit usage, adapter/design-system authoring
├── package.json                 # Root scripts + server deps
├── CLAUDE.md                    # Short pointer for Claude Code
└── README.md
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mcp-ui-poc
   ```

2. **Install dependencies**
   ```bash
   npm install
   npm run install-all
   ```

3. **Start the development servers**
   ```bash
   # Terminal 1: Start backend server
   npm run dev

   # Terminal 2: Start frontend development server
   npm run client
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

**Local dev networking:** The Vite dev server (**`npm run client`**) serves the UI on
port **3000** and **proxies** requests to `/api/*` to **http://localhost:3001**
(override with `API_PROXY_TARGET`). The browser only talks to `:3000`, so CORS is not
an issue during development. Production static files can be served by Express from
`client/dist` when not on Vercel (see `server/index.js`).

## API endpoints

### Health Check
- `GET /api/health` - Server status, AI planner availability/model, registered
  design systems with their active state, and registered LLM providers
  (`llmProviders: [{ id, name, available }]`).

### Design systems
- `GET /api/design-systems` - List registered design systems (`id`, `name`,
  `description`, `components`, `active`).
- `POST /api/design-systems/active` - Set the active design system (`{ id }`).

### API key verification
- `POST /api/verify-key` - Validate a client-supplied LLM API key without spending
  completion tokens. Pass the key via `x-anthropic-api-key` header or `{ apiKey }`
  body. Returns `{ valid, model?, error? }`.

### Endpoint → UI
- `POST /api/render-endpoint` - `{ url, method?, headers?, body?, instructions?,
  designSystem?, llmProvider? }`. Fetches the endpoint, runs the AI/heuristic
  planner (using `llmProvider` or the default `LLM_PROVIDER`), renders with the
  chosen (or active) design system, and returns `{ ...mcpUiResource, componentId,
  spec, meta: { planner, designSystem, source: { url, contentType, bytes } } }`.

### Error responses (summary)

| HTTP | When | JSON shape (typical) |
|------|------|------------------------|
| **400** | Missing or invalid body fields | `{ "error": "..." }` |
| **413** | Generated HTML exceeds `MCP_MAX_HTML_BYTES` | `{ "error", "code": "HTML_TOO_LARGE", "limitBytes", "bytes" }` |
| **429** | Rate limit exceeded | `{ "error", "code": "RATE_LIMIT" }` + `Retry-After` header |
| **500** | Unexpected server failure | `{ "error": "..." }` (generic message) |

### Scaling

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_RATE_LIMIT_GENERATE_PER_MIN` | `45` | Max `POST /api/render-endpoint` requests per client IP per minute. |
| `MCP_MAX_HTML_BYTES` | `786432` (768 KiB) | Max UTF-8 bytes for the generated HTML document; over-limit returns **413** with `{ "code": "HTML_TOO_LARGE", "limitBytes", "bytes" }`. Tunable between **1024** and **10000000**. |
| `MCP_ALLOW_PRIVATE_ENDPOINTS` | unset | Set to `1` to allow fetching private/loopback endpoints (local dev only). |
| `ANTHROPIC_API_KEY` | unset | Enables the Anthropic adapter; without any provider key, a heuristic planner is used. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Override the Claude model used by the AI planner. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | unset / `gpt-4o` | Enables the OpenAI adapter. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | unset / `gemini-2.0-flash` | Enables the Gemini adapter. |
| `LLM_PROVIDER` | `anthropic` | Default LLM provider id (`anthropic` \| `openai` \| `gemini`); override per-request with `llmProvider`. |
| `MCP_DESIGN_SYSTEM` | `glass` | Default active design system at startup (`glass` \| `shadcn` \| `material` \| `plain`). |

Set in `.env` or the host dashboard (e.g. Vercel). On Vercel, **`trust proxy`** is
enabled so the limiter sees the real client IP.

## Design system

The shell uses two layers: **glass + Fira Sans/Fira Code** from `client/src/App.css`
and `glassAppearance.js`, and **Tailwind CSS v4** + **[shadcn/ui](https://ui.shadcn.com/)**
(Radix primitives) for composable controls. Semantic tokens (`--background`,
`--primary`, `--muted`, …) live in `client/src/index.css` and map into Tailwind via
`@theme inline`.

- **Backdrop**: Soft page gradient plus an animated color mesh (disabled when
  `prefers-reduced-motion` is set)
- **Surfaces**: Frosted glass (`backdrop-filter` blur + saturation) on header, main
  card, inputs, and notifications
- **Accent**: Green CTA accent for the primary action; existing dark glass theme for
  the rest
- **Type**: Fira Code for headings/mono, Fira Sans for body text
- **Persistence**: Glass slider values are stored in `localStorage` under
  `mcp-ui-glass-settings-v1`

### Adding shell components

From **`client/`**:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
```

Imports use the **`@/`** alias (e.g. `import { Button } from '@/components/ui/button'`).
New primitives should respect existing glass surfaces—prefer `className` + `cn()` to
blend with `App.css` panels rather than replacing the mesh shell.

## Technologies

### Frontend
- **React 18**: Hooks and functional components
- **Vite**: Dev server and production build
- **Tailwind CSS v4** (`@tailwindcss/vite`): utility styling; dark mode follows system
  preference by default
- **shadcn/ui** + **radix-ui**: accessible Button, Card, Input, Label, Select under
  `client/src/components/ui/`
- **CSS**: App-wide glass tokens in `App.css`; shadcn semantic tokens in `index.css`

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework for API endpoints
- **express-rate-limit**: Per-IP rolling window on `/api/render-endpoint`
- **CORS**: Cross-origin resource sharing
- **@anthropic-ai/sdk**: AI planner (structured output → UI spec)
- **@mcp-ui/server**: MCP UI server SDK (`createUIResource`)

### Development Tools
- **Nodemon**: Automatic server restart on file changes
- **ES6 Modules**: Modern JavaScript module system
- **ESLint**: run **`npm run lint`** from **`client/`** after JSX/JS changes

## Scripts

### Development
- `npm run dev` - Start backend server with nodemon (port **3001** by default)
- `npm run client` - Start Vite dev server (port **3000**, proxies `/api` to the backend)
- `npm run build` - Build frontend for production (`client/dist`)

### Installation
- `npm run install-all` - Install both frontend and backend dependencies
- `npm run install-client` - Install only frontend dependencies
- `npm run install-server` - Install only backend dependencies

### Quality
- `npm run lint` — Run from **`client/`** (requires dependencies installed in `client/`)

## Usage

1. Open the app. The hero shows the API connection status and which planner
   (AI or heuristic) is active.
2. Enter an endpoint URL (or pick one of the sample chips), choose a design system,
   optionally add headers (JSON) and instructions for the AI layer.
3. Click **Generate UI**. A skeleton shows while the endpoint is fetched and the UI
   is composed.
4. The result renders inside an MCP UI resource (`UIResourceRenderer`), with meta
   chips for the design system, planner, and bytes fetched. Toggle **Show UI spec**
   to inspect the AI's component spec JSON.
5. Use the **Glass** button (bottom-right) to tune the frosted-glass appearance.

## Security and practices

### Data handling
- **No persistent storage**: each `/api/render-endpoint` call is stateless.
- **SSRF guard**: `server/data-source.js` resolves and rejects requests to
  private/loopback addresses unless `MCP_ALLOW_PRIVATE_ENDPOINTS=1` is set.
- **Request limits**: JSON bodies are capped (**512kb**); generated HTML is capped
  (**`MCP_MAX_HTML_BYTES`**); rate limits apply per IP on `/api/render-endpoint`.

### Component isolation
- The MCP UI resource is rendered via `UIResourceRenderer` in a **sandboxed iframe**;
  parent/child communication uses `postMessage` with a fixed action shape (`notify`,
  `link`).

### Accessibility
- **Focus**: Visible `:focus-visible` styles on interactive controls
- **Reduced motion**: Honors `prefers-reduced-motion` for animations and skeleton
  pulses
- **Status**: API connection state and planner availability are exposed in the hero

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Stack:** React, Vite, Tailwind CSS v4, shadcn/ui, Node.js, Express,
`express-rate-limit`, `@anthropic-ai/sdk`, `@mcp-ui/server`, `@mcp-ui/client`.
