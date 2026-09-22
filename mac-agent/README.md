# Mac Agent

Local-first **macOS computer-control agent**: voice, text, MCP, and localhost API all converge on one **capability-based tool runtime** and one **security policy engine**.

> Not a chatbot that runs shell. The LLM may only emit structured tool requests. The OS is reached only after schema validation, policy, permissions, and optional human confirmation.

## Status

Architecture and security-critical core are under active development. See `PROJECT_PLAN.md`.

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

## Build (AgentCore on Linux or macOS)

```bash
export PATH="/path/to/swift/usr/bin:$PATH"   # if needed
swift test
npm test   # autonomous director tests
```

macOS app target (`App/`) requires Xcode on a Mac (Accessibility, menu bar, TCC).

## Security invariant

```
LLM → ToolCall JSON → validate → policy → permission → tool → OS
```

There is no `executeShell(String)` tool.

## License

MIT — see [LICENSE](LICENSE). Third-party deps (WhisperKit, AXorcist, Ollama) keep their own licenses; we do not vendor AGPL code.
