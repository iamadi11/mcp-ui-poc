# ui-compose-kit

Fetch data, let an LLM design a UI from it, and render it via pluggable design
systems. Adapter-based for both the LLM provider and the design system —
bring your own model, bring your own theme.

## Quickstart

```js
import { planUI, getDesignSystem } from 'ui-compose-kit'

const designSystem = getDesignSystem('shadcn') // ThemeAdapter: 'shadcn' | 'material' | 'plain' | 'glass'

const { spec, planner } = await planUI({
  data,                 // parsed JSON from your endpoint
  sourceUrl: 'https://api.example.com/orders',
  instructions: 'show as a table',
  designSystem,
  llmProvider: 'anthropic', // LLM fallback: 'openai' | 'gemini'
  apiKey: undefined,        // optional per-request LLM key override
  cachedPolicy,             // LayoutPolicy from the decision store (replay)
  previousPolicy,           // current session widget — follow-ups upgrade this
  neighbors,                // prior policies for the same shape (few-shot for Jev)
})

const html = designSystem.render(spec) // self-contained <html> document
```

Planner cascade: Jev (one fan-out of typed questions; Studio `fresh: true` so
fingerprint replay is off) → `applyPolicy` → Haiku copy slots if `needs_llm`,
or Haiku HTML when the catalog cannot express the ask → catalog / heuristic
when no TypeSafe key. Same-shape Mongo neighbors are few-shot for Jev, never
a silent replay of a different prompt. DecisionAdapter I/O is frozen:
`{ state, questions } → { answers, confidence }`. Motion is a CSS token
(`none` | `enter` | `stagger` | `live`). Follow-ups like “add a tooltip”
merge onto `previousPolicy`.

## Design System Packs

A pack restyles the catalog. It does not invent widgets. Studio users paste
tokens or CSS variables; they never upload JavaScript. Developers may still
`registerDesignSystem` with a custom `render`.

```js
{
  version: 1,
  id: 'acme',
  name: 'Acme',
  tokens: {
    background, ink, card, border, accent, onAccent, muted, danger,
    radius, fontUi, fontMono, chartColors: [6],
  },
  head: 'https font links only (fonts.googleapis.com)',
  css: 'optional extra rules (sanitized)',
  supports: ['login-form', 'landing-page', /* catalog type ids */],
}
```

`render(spec, pack)` applies tokens as CSS variables. Jev `state.catalog` is
`supports` (id + accent only — never raw CSS). Widget versions persist
`themeId` + `themePack`. Fingerprints include a pack hash.

If no provider is configured/available, `planUI` falls back to a deterministic
`heuristicPlan()` (no LLM call, no key required).

## Subpath exports

```js
import { anthropicAdapter } from 'ui-compose-kit/llm/anthropic'
import { openaiAdapter } from 'ui-compose-kit/llm/openai'
import { geminiAdapter } from 'ui-compose-kit/llm/gemini'
import { glassSystem } from 'ui-compose-kit/design-systems/glass'
```

Provider SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`, `@typesafe-ai/sdk`)
are **optional dependencies** loaded lazily via `import()` inside each adapter —
installing `ui-compose-kit` doesn't force-install them.

## Environment variables

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic adapter (default model `claude-haiku-4-5-20251001`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI adapter (default model `gpt-4o`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini adapter (default model `gemini-2.0-flash`) |
| `LLM_PROVIDER` | Default LLM fallback id (`anthropic` \| `openai` \| `gemini`) |
| `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` | Jev planner (default model `jev-1.13.0`) |
| `JEV_MIN_CONFIDENCE` | Minimum Choice confidence before Jev's policy is used (default `0.5`) |
| `MCP_DESIGN_SYSTEM` | Default active design system id |

## Presentation modes

`spec.presentation` is one of:
- `page` — full dashboard layout (default)
- `modal` — single centered dialog over a dimmed backdrop
- `component` — a single bare component, no page chrome, for inline embedding

## Writing an LLM adapter

Implement and register:

```js
{
  id: 'my-provider',
  name: 'My Provider',
  envKey: 'MY_PROVIDER_API_KEY',
  model: 'my-model',
  isAvailable(apiKey?) -> boolean,
  async verifyApiKey(apiKey) -> { valid, model?, error? },
  async generateStructured({ apiKey, system, userContent, schema, maxTokens }) -> parsedObject,
}
```

`generateStructured` must return an object matching `uiSpecSchema`
(`ui-compose-kit`'s `schema.js`). Register with `registerLLMAdapter(adapter)`.

## Writing a design system

```js
{
  id, name, description,
  components: [{ type, description }], // catalog shown to the LLM
  theme: { head, css, chartColors: string[6] },
  render(spec) -> string, // self-contained HTML, via design-systems/spec-html.js
}
```

Register with `registerDesignSystem(system)`. See `src/design-systems/plain.js`
for a minimal template to copy.

## Gemini schema limitations

Gemini's `responseSchema` uses a stricter OpenAPI-subset dialect than the
JSON-Schema `uiSpecSchema` (no `additionalProperties`). The Gemini adapter
runs `sanitizeSchemaForGemini()` to strip unsupported keywords before sending.
Live testing requires `GEMINI_API_KEY`.

## Tests

```sh
npx vitest run
```

Schema, heuristic planner, layout-policy replay, shape fingerprints, and the
Jev cascade (mocked, no network) are covered.
