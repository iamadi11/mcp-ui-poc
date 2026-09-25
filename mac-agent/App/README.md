# macOS menu-bar app

Personal / local install — **no paid Apple Developer Program / notarization required**.

## Why macOS asks for permissions again after each update

TCC (Microphone, Accessibility, …) grants are tied to the **code-signing identity**, not just the app name.

| Signing | Team ID | Permissions across updates |
|---------|---------|----------------------------|
| Ad-hoc (`codesign -s -`) | none — new hash every build | Reset every install |
| Apple Development / stable local cert | stable | **Kept** if bundle id + identity stay the same |

`package-macos-app.sh` now prefers your existing **Apple Development** certificate so rebuilds keep grants.

## One-shot install + launch

```bash
cd mac-agent
./scripts/package-macos-app.sh --install --open
```

Installs to `~/Applications/Mac Agent.app` (same path every time).

## Permissions (once)

1. Menu bar → waveform icon → **Request microphone**
2. **Prompt Accessibility** if you use click/type tools
3. Later updates with the same signing identity should **not** re-prompt
