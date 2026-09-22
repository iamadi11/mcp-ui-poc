# ADR-007: Open-source DecisionAdapter (Laya) + OpenAI-compatible LLM

## Status

Accepted

## Context

Only TypeSafe (Jev) and Anthropic were paid dependencies on the Studio hot path (`CONTEXT.md`). Laya is an open-weight System 1 engine with the same choice / score / noul primitives as Jev. Generative copy and out-of-catalog HTML can use any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, vLLM) instead of paid Haiku.

Vercel Hobby cannot host ~1.7 GB ONNX weights, so Laya must support a remote HTTP sidecar as well as optional local ONNX.

## Decision

1. Add a **Laya DecisionAdapter** with the frozen I/O `{ state, questions } → { answers, confidence }` (same as Jev).
2. Select the decision backend with `DECISION_PROVIDER`:
   - `auto` (default): Laya when configured → else Jev when a TypeSafe key exists → else none (catalog/heuristic).
   - `laya` | `jev`: force that backend.
3. Laya backends:
   - `LAYA_BASE_URL` → HTTP `POST /v1/system_one` (production-friendly).
   - `LAYA_MODE=onnx` + optional `@receptron/laya` → local ONNX (dev / fat hosts).
4. Extend the **OpenAI LLM adapter** with `OPENAI_BASE_URL` so free/open models work without code forks. Anthropic and Gemini remain optional.
5. Amend the product story: **Laya (or Jev) decides; code constructs; any configured LLM generates** when the catalog cannot express the ask. ADR-002 cascade shape is preserved; only the paid defaults change.

## Consequences

- Studio can run with zero paid API keys when Laya sidecar + Ollama (or Groq/OpenRouter free) are configured.
- Operators must run a Laya sidecar (or ONNX host) for open decision quality; heuristic fallback remains.
- Docs and Settings copy mention OSS paths; Jev/Anthropic BYOK still work.
