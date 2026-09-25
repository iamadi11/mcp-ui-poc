# M7 — Act once

## Problem

The menu bar always dry-runs. After permissions, the user still cannot make Mac Agent act. A sticky “always live” switch is the wrong default for a computer-control agent.

## Slice

**Act once** — off by default. Turning it on arms only the next Listen, Battery, Ollama, or AX journey. That action runs with `dryRun=false`, then the switch turns off.

## Acceptance

- Default is dry-run
- Armed state is visible before the action
- One action consumes the arm, including when the action fails
- No new shell tool and no change to the security gate

## Not in this slice

- Re-granting Accessibility or Microphone (human TCC step)
- Live AX success (blocked until Accessibility is granted again)
- Sticky live mode
