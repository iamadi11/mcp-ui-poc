# Research: open-source replacements for Jev + paid LLM

**Date:** 2026-09-22  
**Ask:** Replace TypeSafe Jev and paid Anthropic Haiku with open alternatives.  
**Candidate for Jev:** [Laya](https://laya.convaiinnovations.com/) (ConvAI Innovations).

## Decision layer (replaces Jev)

| Option | Fit | Cost | Latency | Hosting notes |
|--------|-----|------|---------|---------------|
| **Laya** (choice/score/noul, same System 1 shape as Jev) | **Best drop-in** | $0 (Apache 2.0 weights) | ~33 ms GPU / ~140 ms CPU batched | Python package `laya`, or Node ONNX via `@receptron/laya` (~1.7 GB) |
| Heuristic / catalog regex | Already in-repo fallback | $0 | instant | No calibrated confidence |
| LocalAdapter (ONNX training export) | Deferred `LA-001` | $0 | TBD | Needs our own fine-tune artifact |

**Recommendation:** Prefer **Laya** as the DecisionAdapter. Keep Jev as optional BYOK.

**Deploy constraint:** Vercel Hobby cannot load 1.7 GB ONNX. Use **`LAYA_BASE_URL`** against a self-hosted sidecar (`services/laya-sidecar`) or run ONNX only on a fat Node host (`LAYA_MODE=onnx`).

## LLM layer (replaces Anthropic Haiku)

Copy slots + out-of-catalog HTML need a generative model with structured JSON. Paid Haiku is not required if we point the existing OpenAI-compatible adapter at free/open backends.

| Option | Model examples | Cost | Structured JSON | Notes |
|--------|----------------|------|-----------------|-------|
| **Ollama** (local) | Llama 3.3, Qwen3, Mistral | $0 | via `response_format` / JSON mode depending on model | Set `OPENAI_BASE_URL=http://127.0.0.1:11434/v1` |
| **Groq** | Llama 3.3 70B, GPT-OSS | free tier | strong | OpenAI-compatible API |
| **OpenRouter** | many `:free` routes | free tier / pay-as-you-go | varies by model | OpenAI-compatible |
| **Gemini** | Flash | free tier | already wired | existing `gemini` adapter |
| **vLLM / LM Studio** | any OSS chat model | $0 self-host | OpenAI-compatible | same base-URL pattern |
| Anthropic Haiku | Claude Haiku | paid | best current quality | keep as BYOK optional |

**Recommendation:** Default generative path to **`openai` + `OPENAI_BASE_URL`** for Ollama / Groq / OpenRouter / vLLM. Keep Anthropic and Gemini as optional providers.

## Proposed cascade (after this work)

1. **Decision:** Laya (if `LAYA_BASE_URL` / ONNX enabled) → else Jev (if TypeSafe key) → else heuristic/catalog.  
2. **Construct:** `applyPolicy` + ThemeAdapter (unchanged).  
3. **Generate / copy:** OpenAI-compatible OSS model → else Gemini → else Anthropic BYOK → else catalog-only.

## Non-goals

- Fine-tuning Laya on Studio turns (future; related to Deferred `LA-001`).
- Removing Jev/Anthropic adapters entirely (BYOK remains valid).
- Shipping model weights in the git repo.
