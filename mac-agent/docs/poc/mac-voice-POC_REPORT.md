# POC — WhisperKit + mic/TCC wiring

Date: 2026-09-22  
Host: darwin arm64

## Delivered

| Piece | Status |
|-------|--------|
| `WhisperKitSTTProvider` | Linked via `argmax-oss-swift` product `WhisperKit` |
| `AppleSpeechSTTProvider` | Fallback when WhisperKit model not yet downloaded |
| `MicCapture` + `PermissionDoctor` TCC | Microphone request + Accessibility prompt helpers |
| Menu-bar “Request microphone” | In `MacAgentMenuBar` |

## Verified

- Package resolves WhisperKit 1.1.0 + AXorcist 0.1.11
- `swift test` green (includes voice mock path)
- Mic status via CLI: `mac-agent-cli --permissions` → microphone=`denied` until app grant

## NOT VERIFIED on this pass

- End-to-end mic → WhisperKit → tool (needs user TCC grant + first model download)
- Spoken utterance accuracy

## How to verify locally

```bash
./scripts/package-macos-app.sh
open dist/MacAgent.app
# Menu → Request microphone → enable in System Settings
# First WhisperKit use downloads the tiny CoreML model
```
