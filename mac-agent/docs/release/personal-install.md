# Personal Mac install (no notarization)

Date: 2026-09-22T10:15:28.166Z
Host: `darwin` / `arm64`

## Install command

```bash
./scripts/package-macos-app.sh --install --open
```

Installs to `~/Applications/Mac Agent.app` with stable Apple Development (or local) signing.

## Mic TCC requirement

Hardened runtime **must** include `com.apple.security.device.audio-input` or the app never appears under System Settings → Microphone.

Entitlements file: `Sources/MacAgentMenuBar/MacAgent.entitlements` present=true

### codesign --entitlements on installed app

```
[Dict]
	[Key] com.apple.security.automation.apple-events
	[Value]
		[Bool] true
	[Key] com.apple.security.device.audio-input
	[Value]
		[Bool] true
Executable=/Users/adityaraj/Applications/Mac Agent.app/Contents/MacOS/MacAgentMenuBar

```

## Notarization

**Out of scope** for personal-only project.

## User grant still required

- ~~Menu → Request microphone~~ — **GRANTED** (user, 2026-09-22)
- ~~Accessibility~~ — **GRANTED** (user, 2026-09-22)

## Next

WhisperKit first-run model download when capturing mic audio.
