# POC / E2E — WhisperKit mic → runtime (user-verified)

Date: 2026-09-22T10:33:49.603Z
Host: `darwin` / `arm64`

## Hypothesis

With TCC granted and audio-input entitlement, menu-bar **Listen 3s** completes STT via WhisperKit and routes a spoken command through AgentRuntime.

## Observed (user device, 2026-09-22)

```
heard="What's my battery?"
stt=whisperkit 3712ms
succeeded → processors=8 memoryBytes=8589934592 host=… dryRun=true
```

## Result

**PASS** for mic → WhisperKit → fast-path `get_system_status` (dry-run).

## Notes

- First WhisperKit model load can be multi-second; subsequent turns should be faster once warm.
- Live (non-`dryRun`) OS side-effects remain opt-in via `--live` / future UI toggle.
- Conversational Ollama replies without tools are treated as succeeded assistant text (not hard fail).

## Decision

Voice MVP path is validated on this personal Mac. Optional next: live mode toggle, AX click journeys, smaller/faster STT model.
