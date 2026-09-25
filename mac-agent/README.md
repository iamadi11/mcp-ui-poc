# Mac Agent

Local-first **macOS computer-control agent**: voice, text, MCP, and localhost API all converge on one **capability-based tool runtime** and one **security policy engine**.

> Not a chatbot that runs shell. The LLM may only emit structured tool requests. The OS is reached only after schema validation, policy, permissions, and optional human confirmation.

## Status

Developer Mac milestone: AgentCore + Ollama tool-calling + AXorcist AX tools + WhisperKit/mic plumbing + menu-bar `.app` bundle. Notarization requires your Apple Developer ID.

**Home:** this tree is `mac-agent/` inside [`iamadi11/mcp-ui-poc`](https://github.com/iamadi11/mcp-ui-poc) — not a separate GitHub repository.

## Autonomous company (`/autonomous`)

One entry point owns the SDLC loop (product → research → POC → architecture → QA → security → perf → release). From the **monorepo root**:

```bash
npm run autonomous -- start --goal "Build the local-first Mac AI control application." --ticks 12
npm run autonomous -- status
```

Or from this directory: `npm run autonomous -- …`. Skills: repo `.cursor/skills/autonomous` (+ `auto-*`). Durable state: `.agent/state/`. Details: [tools/autonomous/README.md](tools/autonomous/README.md).

Distinct from studio `/autonomous-company` / `npm run company`.

## Docs

| Doc | Purpose |
|-----|---------|
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Phases, host limits |
| [TECHNOLOGY_DECISIONS.md](TECHNOLOGY_DECISIONS.md) | Stack choices & rejected options |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layers & invariant |
| [SECURITY.md](SECURITY.md) | Policy, sandbox, threats |

## Build (macOS)

```bash
swift test
swift run mac-agent-cli "What's my battery?"
swift run mac-agent-cli --ollama "Call get_system_status for a quick summary."
swift run MacAgentMenuBar
./scripts/package-macos-app.sh --install --open   # personal local install, no Developer ID
./Benchmarks/ollama_tool_call.sh
```

Ollama: `brew install ollama && brew services start ollama && ollama pull qwen2.5:0.5b`

Menu-bar app TCC: enable **Microphone** (and Accessibility when automating UI). See `App/README.md`.

## Security invariant

```
LLM → ToolCall JSON → validate → policy → permission → tool → OS
```

There is no `executeShell(String)` tool.

## License

MIT — see [LICENSE](LICENSE). Third-party deps (WhisperKit, AXorcist, Ollama) keep their own licenses; we do not vendor AGPL code.
