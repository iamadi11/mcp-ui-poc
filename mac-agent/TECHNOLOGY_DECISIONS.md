# Technology Decisions

Date: 2026-09-22  
Scope: Mac Agent local-first computer-control runtime

## Summary (chosen stack)

| Layer | Choice | License posture | Why |
|-------|--------|-----------------|-----|
| Language / UI | **Swift 6 + SwiftUI** menu-bar app | Apple SDK | Native, lightweight, TCC-friendly identity |
| Agent core | Swift Package `MacAgentCore` | MIT (ours) | Shared by App, CLI, MCP |
| UI automation | **Accessibility (AXUIElement)** via **AXorcist** (MIT) when on macOS | MIT | Structured UI > screenshot vision for speed/privacy |
| LLM (default local) | **Ollama** HTTP OpenAI-compatible + tool calling | Apache-2.0 (Ollama) | Ops maturity, model catalog, stable tool-use path on Apple Silicon (MLX backend in recent Ollama) |
| LLM (native opt-in) | **Apple Foundation Models** (`@Generable`, tools) when OS supports | Apple | Zero install, structured output; small model — use for simple NL |
| LLM (optional) | MLX / llama.cpp / remote OpenAI-compatible | various | Pluggable `LLMProvider` |
| Fast intent / risk | Deterministic router first; optional small classifier later | — | **Not** Laya-as-chat; Laya is System-1 choice/score/noul — useful later for risk triage, not tool planning |
| STT | **WhisperKit** (MIT) primary; Apple Speech / SpeechAnalyzer fallback | MIT / Apple | On-device, ANE, streaming |
| TTS | AVSpeechSynthesizer (MVP); TTSKit later | Apple / MIT | Instant local feedback |
| MCP | Official MCP Swift/JSON-RPC stdio + localhost streamable HTTP | Spec | External agents must hit **same** policy engine |
| Local API | `127.0.0.1` only + bearer token | — | No remote bind by default |

## LLM runtime evaluation

### Rejected as sole/default generative runtime

| Option | Why not default |
|--------|-----------------|
| **Laya** | Excellent for System-1 typed decisions (choice/score/noul), **not** for multi-step tool planning / free-form NL→tool. May be added later as a **risk/intent classifier**, never as the action planner. |
| Raw `mlx_lm` only | High throughput but weaker ops story for app users; keep as optional provider. |
| Cloud-only Claude/GPT | Violates local-first privacy default; remote is **opt-in**. |
| Open Interpreter-style “LLM writes shell” | AGPL ecosystem + arbitrary shell contradicts security model. |

### Selected defaults

1. **Deterministic fast path** for phrases like “battery”, “open Spotify”, “CPU” — no LLM.
2. **Ollama** (`qwen3` / `lfm2.5`-class tool-capable small models) for general NL→tools.
3. **Apple Foundation Models** when available for simple NL on-device without Ollama installed.
4. Pluggable `LLMProvider` protocol so none of the above is locked in.

Benchmark targets (Mac Silicon, warm model): simple tool call TTFT &lt; 2s; deterministic commands &lt; 100ms.

## Open-source landscape (prefer reuse, don’t paste blindly)

| Project | Role | License note | How we use it |
|---------|------|--------------|---------------|
| [AXorcist](https://github.com/openclaw/AXorcist) | Swift AX helpers | MIT | Dependency for macOS UI tools |
| [WhisperKit / argmax-oss-swift](https://github.com/argmaxinc/argmax-oss-swift) | On-device STT/TTS kits | MIT | STT (+ optional TTS later) |
| Ghost OS / Fazm / mac-mcp / macOS-MCP | Prior art for AX + MCP | Mixed; some warn of unsandboxed shell | **Learn patterns; do not vendor shell-first designs** |
| Open Interpreter | Code-exec agent | **AGPL-3.0** | **Do not incorporate code** |
| Official MCP SDK | Protocol | Spec / Apache | Interface only |

We implement our **own** policy engine, path sandbox, and confirmation UX — that is the product differentiator.

## macOS permissions (required)

| Permission | Why |
|------------|-----|
| Accessibility | Click / focus / read AX tree |
| Microphone | Voice interface |
| Screen Recording | Optional screenshots / OCR tools (off by default) |
| Automation | AppleScript/Shortcuts bridges when used |
| Files & Folders | Scoped FS access |

Never bypass TCC. Surface a permission doctor UI.

## Why not Electron / Node as the app shell

Latency, memory, and TCC identity are worse for a menu-bar control agent. Node may appear only as an optional sidecar (e.g. Ollama already separate). The control plane is Swift.
