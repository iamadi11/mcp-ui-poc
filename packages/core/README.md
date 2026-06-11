# ui-compose-kit

Fetch data, let an LLM design a UI from it, and render it via pluggable design
systems. Adapter-based for both the LLM provider and the design system —
bring your own model, bring your own theme.

## Quickstart

```js
import { planUI, getDesignSystem } from 'ui-compose-kit'

const designSystem = getDesignSystem('glass') // or 'shadcn' | 'material' | 'plain'

const { spec, planner } = await planUI({
  data,                 // parsed JSON from your endpoint
  sourceUrl: 'https://api.example.com/orders',
  instructions: 'show as a table',
  designSystem,
  llmProvider: 'anthropic', // or 'openai' | 'gemini' (defaults to LLM_PROVIDER env)
  apiKey: undefined,        // optional per-request key override
})

const html = designSystem.render(spec) // self-contained <html> document
```

If no provider is configured/available, `planUI` falls back to a deterministic
`heuristicPlan()` (no LLM call, no key required).

## Subpath exports

```js
import { anthropicAdapter } from 'ui-compose-kit/llm/anthropic'
import { openaiAdapter } from 'ui-compose-kit/llm/openai'
import { geminiAdapter } from 'ui-compose-kit/llm/gemini'
import { glassSystem } from 'ui-compose-kit/design-systems/glass'
```

Provider SDKs (`@anthropic-ai/sdk`, `openai`, `@google/genai`) are
**optional dependencies** loaded lazily via `import()` inside each adapter —
installing `ui-compose-kit` doesn't force-install all three.

## Environment variables

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic adapter (default model `claude-opus-4-8`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI adapter (default model `gpt-4o`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini adapter (default model `gemini-2.0-flash`) |
| `LLM_PROVIDER` | Default provider id (`anthropic` \| `openai` \| `gemini`) |
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

Schema, heuristic planner, and design-system rendering are covered without
network calls (adapter `generateStructured` is not exercised in unit tests).
