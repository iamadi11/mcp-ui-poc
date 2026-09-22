# Mac Agent — Project Plan

**Working title:** Mac Agent  
**Location:** `mac-agent/` inside [`iamadi11/mcp-ui-poc`](https://github.com/iamadi11/mcp-ui-poc)  
**Goal:** Local-first macOS computer-control runtime with voice, MCP, and capability-based security.

## Monorepo home

| Item | Choice |
|------|--------|
| Repository | `iamadi11/mcp-ui-poc` only (no separate GitHub remote) |
| Path | `mac-agent/` at monorepo root |
| Director | `/autonomous` + `npm run autonomous` (distinct from studio `/autonomous-company`) |

## Host constraints (this Cloud Agent)

| Constraint | Impact |
|------------|--------|
| OS is **Linux x86_64**, not macOS | Cannot run Accessibility, ScreenCaptureKit, menu-bar UI, or notarization here |
| Swift 6.0.3 installed under `/home/ubuntu/swift` | **AgentCore / Security / pure tools** can be built & unit-tested on Linux |

**Genuine blocker for Definition of Done items that require a Mac:** native app packaging, live AX automation, microphone TCC, Screen Recording. We implement and test the security-critical path here; Mac-only modules ship as stubs with compile flags.

## Phases (autonomous loop)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 Research | `TECHNOLOGY_DECISIONS.md` | Done |
| 2 Architecture | Core protocols, policy, state, audit | Done |
| 3 Deterministic tools | Apps, system info, safe FS (stubs on Linux) | In progress (dry-run adapters) |
| 4 Local LLM | Pluggable providers + Ollama HTTP | Partial (Mock + Ollama stub) |
| 5 Voice | WhisperKit / Apple Speech interfaces | Protocols + mock STT; WhisperKit needs Mac |
| 6 MCP / API | Same security engine | Planned |
| 7 Security hardening | Adversarial suite | Planned |
| 8 E2E | Mac host journeys | Blocked until Mac CI |
| 9 Performance | Benchmark harness | Planned |
| 10 Packaging | Signed `.app` | Blocked until Mac |

## Non-goals (MVP)

- Unrestricted shell / `sudo` tools
- Cloud-required inference for basic commands
- Electron UI
- Vision-first computer use as the default (AX tree preferred)

## Success for this Cloud Agent session

1. Architecture + security model committed.
2. Capability-based tool runtime + policy engine + audit + path/command validators with **passing tests**.
3. Fast-path deterministic router for common phrases.
4. Mock LLM provider that can only emit structured tool requests (invariant tested).
5. Clear README for Mac developers to open the Xcode/SPM project.

## Related research artifacts

- `TECHNOLOGY_DECISIONS.md` — language, LLM, STT, MCP, rejected options
- `ARCHITECTURE.md` — layer diagram and module map
- `SECURITY.md` — policy, permissions, adversarial threats
