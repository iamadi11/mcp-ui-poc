# Host status

This Director / engineer session is on **macOS** (`darwin` / `arm64`).

| MVP item | Status here |
|----------|-------------|
| Security gate / sandbox / audit / tests | Implemented — `swift test` green |
| Fast path + runtime | Implemented |
| Ollama local tool-calling | **Installed** — warm tool-call **285ms** (`docs/performance/2026-09-22-ollama-tool-call.md`) |
| Voice pipeline + WhisperKit + Apple Speech | Wired in `MacAgentVoice` (model downloads on first WhisperKit use) |
| Microphone TCC | Plumbing ready — grant via menu-bar app (“Request microphone”) |
| AX click/type via AXorcist | Wired (`ClickElementTool` / `TypeTextTool`) |
| SwiftUI menu bar app | `swift run MacAgentMenuBar` + `dist/MacAgent.app` via `scripts/package-macos-app.sh` |
| Codesign / notarized `.app` | **Not required** for personal use — ad-hoc local install via `./scripts/package-macos-app.sh --install --open` |

## Next human steps

```bash
cd mac-agent
./scripts/package-macos-app.sh --install --open
```

Then grant Microphone (and Accessibility if automating UI) from the menu-bar app.
