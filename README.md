# Dynamic MCP UI Generator

Full-stack demo for MCP (Model Context Protocol) UI: build forms, dashboards, and charts in the browser, backed by a Node server that returns MCP UI resources. The client is intentionally **minimal**—neutral surfaces, a single accent color, and **light/dark styling from the system** (`prefers-color-scheme`), not decorative gradients or heavy effects.

## Features

### Core MCP UI
- **Dynamic UI generation**: Forms, dashboards, and charts from configuration
- **Structured + HTML**: Generate endpoints return an MCP `resource` (HTML for iframe hosts) plus a **`structured`** JSON envelope (`schemaVersion`, `kind`, `id`, `config`) so this app can render the same UI in React without an iframe; the preview defaults to **Data (React)** with an optional **HTML (iframe)** toggle. Stored **form-submit** payloads include **`preview`: `structured` \| `html`** so the server timeline can show which mode produced each row.
- **PostMessage**: Parent page and generated iframe stay in sync for tools and events when using HTML preview
- **Toasts**: Short-lived notifications for form saves, dashboard refresh, chart export, and **iframe tool** callbacks (e.g. theme/settings)—not blocking `alert()` dialogs

### Builders
- **AI Generator** (default tab): Natural-language descriptions produce the same MCP resources as the typed builders (`POST /api/ai/generate`); inline errors for validation and API failures (no modal alerts)
- **Form builder**: Text, email, number, select, textarea; required flags and labels
- **Dashboard builder**: Metrics, lists, and chart widgets
- **Chart builder**: Bar, pie, and line charts from comma-separated values and labels
- **Preview**: Generated HTML renders inline after each build

### Server
- **Components & storage**: Track generated components and optional user-scoped data. In-memory maps are **bounded** so the MCP core does not grow without limit: oldest UI component metadata is evicted after **`MCP_MAX_UI_COMPONENTS`** (default 2000); oldest user buckets after **`MCP_MAX_USER_DATA_KEYS`** (default 500); form-submit history per user is capped by **`MCP_MAX_SUBMISSIONS_PER_USER`** (default 50). See **Scaling** below. Request bodies are limited to **512kb** JSON. Each **generated HTML document** (builders, AI paths, static example) is rejected with **413** if its UTF-8 size exceeds **`MCP_MAX_HTML_BYTES`** (default 768 KiB), keeping responses and RAM predictable. Dynamic and AI-generated component ids use **UUID** suffixes so burst traffic does not collide on millisecond timestamps. **Per-IP rate limits** (rolling 1-minute windows) protect expensive `POST` routes: shared cap for generate-form, generate-dashboard, generate-chart, and `ai/generate`; a higher cap for `store-data`; a separate cap for `ai/suggest`—see **Scaling**.
- **HTML generation**: Form, dashboard, and chart responses are **full HTML documents** (`server/generated-html-skin.js` + `server/dynamic-ui-html.js`) so iframe previews use the same glass mesh, DM Sans, and accent styling as the shell—not legacy purple-gradient fragments
- **Layout**: Generated embeds are responsive

### Interface
- **Generate feedback**: Form, Dashboard, and Chart builders disable their primary **Generate** control and show **Generating…** while the corresponding `POST /api/generate-*` request is in flight (same idea as the AI tab’s loading state).
- **Form Builder polish**: Field editor cards use the glass palette/borders from the shell and keep a cleaner responsive grid (`2` columns on medium widths, `4` on extra-wide screens) to avoid cramped controls.
- **Typography**: DM Sans, restrained scale
- **Theme**: CSS variables; light and dark follow OS preference
- **Glassmorphism**: Frosted panels, mesh backdrop, and tunable blur—use the **Glass** control (bottom-right) to adjust blur, frost, edge light, saturation, mesh strength, and corner roundness in real time (saved in `localStorage` under `mcp-ui-glass-settings-v1`)
- **Layout**: Narrow content width; animated mesh layer respects reduced motion
- **Errors**: Failed generate/store/get requests surface JSON `error` strings from the API; **429** (rate limit) includes a **`Retry-After`** hint in the message when present; **413** (`HTML_TOO_LARGE`) includes byte limits. Builder failures use an inline error banner; the AI tab uses the same pattern.

## Project structure

```
mcp-ui-poc/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx              # Tabs, builders, health, stored-data panel, notifications
│   │   ├── App.css              # Theme tokens and layout
│   │   ├── StructuredUIPreview.jsx  # Structured + iframe preview router
│   │   ├── apiError.js          # Fetch error helper (JSON body, 429 / 413 hints)
│   │   ├── userSession.js       # Demo user id (`mcp-ui-user-id-v1` in localStorage)
│   │   ├── glassAppearance.js   # Glass CSS variables + persistence
│   │   ├── index.css            # Tailwind v4 + shadcn semantic tokens (`@theme inline`)
│   │   ├── main.jsx             # React entry
│   │   ├── components/ui/       # shadcn/ui primitives (Button, Card, Tabs, Select, …)
│   │   └── lib/utils.js         # `cn()` helper (clsx + tailwind-merge)
│   ├── components.json          # shadcn/ui config (`tsx: false` → `.jsx` output)
│   ├── jsconfig.json            # `@/*` → `src/*` for imports
│   ├── package.json
│   └── vite.config.js           # Tailwind Vite plugin, `@` alias, `/api` proxy
├── server/                      # Express API + MCP generation
│   ├── index.js                 # Routes, rate limits, JSON body limit, Vercel trust proxy
│   ├── mcp-server.js            # generate-* UI, store/get user data, stats
│   ├── dynamic-ui-html.js       # Full-document HTML for forms, dashboards, charts
│   ├── generated-html-skin.js   # Shared shell styles for generated pages
│   ├── generated-html-limit.js  # MCP_MAX_HTML_BYTES guard + 413 helpers
│   ├── mcp-structured-ui.js     # Structured JSON envelope for React preview
│   ├── rate-limits.js           # Per-IP limits (express-rate-limit)
│   ├── ai-generator.js          # /api/ai/generate implementation
│   └── mcp-ui-example.js        # Static MCP UI example resource
├── docs/
│   └── AI_WORKFLOW.md           # Contributor workflow (canonical)
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

**Local dev networking:** The Vite dev server (**`npm run client`**) serves the UI on port **3000** and **proxies** requests to `/api/*` to **http://localhost:3001**. The browser only talks to `:3000`, so CORS is not an issue during development. Production static files can be served by Express from `client/dist` when not on Vercel (see `server/index.js`).

## API endpoints

### Health Check
- `GET /api/health` - Server status and health information. Response includes **`mcp`**: current in-memory counts and configured limits (`maxUiComponents`, `maxUserDataKeys`, `maxSubmissionsPerUser`, `maxHtmlBytes`) for operators. The app header shows these values when the API is reachable (no extra request beyond the existing health poll).

### Scaling (in-memory MCP demo)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MCP_MAX_UI_COMPONENTS` | `2000` | Max tracked generated component ids (FIFO eviction of oldest). |
| `MCP_MAX_USER_DATA_KEYS` | `500` | Max distinct `userId` buckets in `store-data` (FIFO eviction of oldest keys). |
| `MCP_MAX_SUBMISSIONS_PER_USER` | `50` | Max appended `form-submit` rows per user. |
| `MCP_RATE_LIMIT_GENERATE_PER_MIN` | `45` | Max requests per client IP per minute for `POST` `/api/generate-form`, `/api/generate-dashboard`, `/api/generate-chart`, `/api/ai/generate` (shared counter). |
| `MCP_RATE_LIMIT_STORE_PER_MIN` | `180` | Max `POST` `/api/store-data` requests per IP per minute. |
| `MCP_RATE_LIMIT_SUGGEST_PER_MIN` | `60` | Max `POST` `/api/ai/suggest` requests per IP per minute. |
| `MCP_MAX_HTML_BYTES` | `786432` (768 KiB) | Max UTF-8 bytes for one generated HTML document; over-limit returns **413** with `{ "code": "HTML_TOO_LARGE", "limitBytes", "bytes" }`. Tunable between **1024** and **10000000**. |

Set in `.env` or the host dashboard (e.g. Vercel). Data is still **ephemeral** on serverless cold starts—limits only bound RAM within a warm instance. On Vercel, **`trust proxy`** is enabled so the limiter sees the real client IP. Each serverless instance keeps its own in-memory counters (limits still curb abuse per warm instance). When a limit is hit, responses are **429** with JSON `{ "error": "...", "code": "RATE_LIMIT" }` and a **`Retry-After`** header (seconds); the React app shows the server `error` text (and retry hint when present) for generate, AI generate, store-data, and get-data failures.

### Error responses (summary)

| HTTP | When | JSON shape (typical) |
|------|------|------------------------|
| **400** | Missing or invalid body fields | `{ "error": "..." }` |
| **413** | Generated HTML exceeds `MCP_MAX_HTML_BYTES` | `{ "error", "code": "HTML_TOO_LARGE", "limitBytes", "bytes" }` |
| **429** | Rate limit exceeded | `{ "error", "code": "RATE_LIMIT" }` + `Retry-After` header |
| **500** | Unexpected server failure | `{ "error": "..." }` (generic message; avoid leaking stack traces in production hardening) |

### MCP UI Components
- `GET /api/mcp-ui-example` - Get the static MCP UI demo component

### Dynamic UI Generation
- `POST /api/generate-form` - Generate a custom form UI (response includes `resource` + `structured`)
- `POST /api/generate-dashboard` - Generate a dashboard UI (response includes `resource` + `structured`)
- `POST /api/generate-chart` - Generate a chart UI (response includes `resource` + `structured`)

### AI
- `POST /api/ai/generate` - Generate from natural language (`userId`, `description`); same resource shape as builders
- `POST /api/ai/suggest` - Lightweight suggestion list from `description`
- `GET /api/ai/templates` - Template metadata for the AI tab

### Data Management
- `POST /api/store-data` - Store user data (JSON body: `userId`, `data`). If `data.kind` is `form-submit`, the server **appends** to a per-user list (default max **`MCP_MAX_SUBMISSIONS_PER_USER`**); other shapes **replace** the stored blob for that user.
- `GET /api/get-data/:userId` - Retrieve user data
- **Browser session**: The React app persists a **demo user id** in `localStorage` (same idea as Glass settings) so refresh keeps one server-side namespace. **New session** clears that id and allocates another. Structured preview **form submit** calls `store-data` with the current demo user id. The header includes **Stored data (server)** with **Refresh** to call `get-data` for the current id (and it refreshes after a successful structured form save). When the payload includes **form-submit** history, the panel shows a **recent submits** list plus collapsible raw JSON; **HTML (iframe)** form posts use the same `postMessage` shape and no longer use a blocking `alert`.
- `GET /api/component-info/:componentId` - Get component information

## Builder reference

### Form Builder
Create dynamic forms with:
- **Field Types**: Text, email, number, select dropdown, textarea
- **Validation**: Required field support
- **Customization**: Placeholder text, labels, submit button text
- **Real-time Preview**: See form changes immediately

### Dashboard Builder
Generate analytics dashboards with:
- **Metric Widgets**: Display key performance indicators
- **List Widgets**: Show activity feeds and data lists
- **Chart Widgets**: Embedded data visualizations
- **Responsive Layout**: Auto-adjusting grid system

### Chart Builder
Create data visualizations:
- **Bar Charts**: Horizontal bar charts with custom data
- **Pie Charts**: Circular charts with color-coded segments
- **Line Charts**: SVG polyline over time-series–style labels (same comma-separated values/labels as bar/pie)
- **Custom Data**: Input values and labels via comma-separated format
- **Export Functionality**: Chart export capabilities

## Design system

The shell uses two layers: **glass + DM Sans** from `client/src/App.css` and `glassAppearance.js`, and **Tailwind CSS v4** + **[shadcn/ui](https://ui.shadcn.com/)** (Radix primitives) for composable controls. Semantic tokens (`--background`, `--primary`, `--muted`, …) live in `client/src/index.css` and map into Tailwind via `@theme inline`, aligned with the existing blue accent in light/dark (system `prefers-color-scheme`).

- **Backdrop**: Soft page gradient plus an animated color mesh (disabled when `prefers-reduced-motion` is set)
- **Surfaces**: Frosted glass (`backdrop-filter` blur + saturation) on header, main card, tabs, inputs, and notifications
- **Accent**: Primary blue for actions and the active tab (shared between CSS variables and shadcn `--primary`)
- **Type**: DM Sans; hero title uses a subtle gradient clip
- **Persistence**: Glass slider values are stored in `localStorage` under `mcp-ui-glass-settings-v1`

### Adding shell components

From **`client/`**:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
```

Imports use the **`@/`** alias (e.g. `import { Button } from '@/components/ui/button'`). New primitives should respect existing glass surfaces—prefer `className` + `cn()` to blend with `App.css` panels rather than replacing the mesh shell.

The **Form**, **Dashboard**, and **Chart** builder tabs share the same shadcn shell: **`Card`**, **`Button`**, **`Input`**, **`Label`**, **`Select`**, **`Checkbox`** (forms only), and **`Separator`**, preserving the existing payloads for **`generate-form`**, **`generate-dashboard`**, and **`generate-chart`**.

## Technologies

### Frontend
- **React 18**: Hooks and functional components
- **Vite**: Dev server and production build
- **Tailwind CSS v4** (`@tailwindcss/vite`): utility styling; dark mode follows system preference by default
- **shadcn/ui** + **radix-ui**: accessible Button, Card, Tabs, Badge, Input, Label, Separator, etc. under `client/src/components/ui/`
- **CSS**: App-wide glass tokens in `App.css`; shadcn semantic tokens in `index.css`

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework for API endpoints
- **express-rate-limit**: Per-IP rolling windows on hot `POST` routes
- **CORS**: Cross-origin resource sharing
- **@mcp-ui/server**: MCP UI server SDK (`createUIResource`)

### Development Tools
- **Nodemon**: Automatic server restart on file changes
- **ES6 Modules**: Modern JavaScript module system
- **ESLint**: `client/.eslintrc.cjs` configures recommended + React + hooks + react-refresh; run **`npm run lint`** from **`client/`** after JSX/JS changes (CI-friendly with `--max-warnings 0`)

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

### AI Generator
1. Open the **AI Generator** tab (default)
2. Describe the UI you want (forms, dashboards, or charts—keywords in the description steer `parseDescription` in `server/ai-generator.js`)
3. Click **Generate Component**; errors appear inline under the form
4. The preview below uses the same **Data (React)** / **HTML (iframe)** pipeline as the builders

### Creating a Custom Form
1. Navigate to the "Form Builder" tab
2. Set the form title and submit button text
3. Add fields with desired types and validation
4. Click "Generate Form" to create the UI component
5. The generated form will appear below with full functionality

### Building a Dashboard
1. Go to the "Dashboard Builder" tab
2. Configure the dashboard title
3. Add widgets (metrics, lists, charts)
4. Generate the dashboard to see the interactive component

### Creating Charts
1. Select the "Chart Builder" tab
2. Choose chart type (bar or pie)
3. Enter data values and labels
4. Generate the chart for visualization

## Real-time behavior

### Form Submission
- Forms automatically send data to the parent application
- Real-time notifications show submission results
- Data can be stored and retrieved via API

### Dashboard Interactions
- Refresh buttons update dashboard data
- Widget interactions trigger notifications
- Component state is managed by the MCP server

### Chart Export
- Export functionality for generated charts
- Notification system for export events
- Customizable chart appearance and data

## Styling and layout

- **Tokens**: Shared variables for color, radius, and spacing
- **Responsive**: Builders collapse to a single column on small screens; toasts move to the bottom on narrow viewports
- **Feedback**: Focus rings on keyboard focus; selection and scrollbars stay low-contrast

## Security and practices

### Data handling (demo scope)
- **In-memory storage only** in this repo: user buckets and component metadata are **not** durable across cold starts or multi-instance deploys unless you add external storage.
- **No authentication**: `userId` is a client-supplied demo key (persisted in the browser as `mcp-ui-user-id-v1`). Treat this as a **namespace label**, not a security boundary.
- **Request limits**: JSON bodies are capped (**512kb**); generated HTML is capped (**`MCP_MAX_HTML_BYTES`**); rate limits apply per IP on expensive routes.

### Component isolation
- HTML preview uses **sandboxed iframes** where configured; parent/child communication uses **`postMessage`** with a fixed action shape—still validate and avoid trusting arbitrary HTML from untrusted users in a real product.

### Accessibility
- **Focus**: Visible `:focus-visible` styles on interactive controls
- **Reduced motion**: Honors `prefers-reduced-motion` for animations
- **Status**: API connection state is exposed in the header; notification toasts are visual (not a full live-region audit)

## Future enhancements

### Product
- **More chart types**: Area, scatter (line charts are supported in builders, HTML preview, structured preview, and AI when the description mentions line/trend/over time)
- **Stronger validation** on builder payloads and stored JSON
- **Explicit theme toggle** (optional override of system light/dark)

### Technical
- **Persistent storage** and optional **auth** for real multi-tenant use
- **Automated tests** when a runner is adopted
- **Performance**: lazy routes, compression for large JSON where appropriate

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Stack:** React, Vite, Tailwind CSS v4, shadcn/ui, Node.js, Express, `express-rate-limit`, `@mcp-ui/server`.