# Host blockers

This Cloud Agent runs on **Linux**, not macOS.

| MVP item | Status here |
|----------|-------------|
| Security gate / sandbox / audit / tests | Implemented & green |
| Fast path + runtime | Implemented & green |
| Voice pipeline protocols + mock STT | Implemented |
| WhisperKit / real mic / TCC | **Needs Mac** |
| AX click/type via AXorcist | **Needs Mac** |
| SwiftUI menu bar app | **Needs Mac** |
| Notarized `.app` | **Needs Mac** |
| `gh repo create` / push to new GitHub repo | **Token cannot create repos** — see `docs/REMOTE_SETUP.md` |

Continue locally on a Mac: open this package in Xcode, add App target, grant Accessibility + Microphone, pull Ollama, run `swift test`.
