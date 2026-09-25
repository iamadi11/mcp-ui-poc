# POC — Accessibility click/type journeys

Date: 2026-09-22T11:06:48.327Z
Host: `darwin` / `arm64`

## Hypothesis

With Accessibility granted, Mac Agent can drive TextEdit menu clicks and type into a document via `click_element` / `type_text` (native AX walk + AXorcist fallback).

## Setup

`./Benchmarks/ax_journey.sh`

## Measurements

```
Building for production...
[0/2] Write swift-version--58304C5D6DBC2206.txt
Build of product 'mac-agent-cli' complete! (0.14s)
accessibility=denied_or_prompt
live=false
step=open_textedit ok=true Would open application 'TextEdit' (dryRun=true)
step=click_edit_menu ok=true (dry-run) click app=com.apple.TextEdit role=AXMenuBarItem title=Edit focused=false
step=click_select_all ok=true (dry-run) click app=com.apple.TextEdit role=AXMenuItem title=Select All focused=false
step=type_textedit ok=true (dry-run) type 32 chars app=com.apple.TextEdit role=AXTextArea
marker=MacAgent-AX-2026-09-22T11:06:48Z
step=click_copy ok=true (dry-run) click app=com.apple.TextEdit role=AXMenuItem title=Copy focused=false
ax_journey_ms=1
ax_journey_ok=true
note=Accessibility not granted — live steps may fail; enable Mac Agent in System Settings
```

- accessibility=denied_or_prompt
- ax_journey_ms=1
- ax_journey_ok=true
- mode=dry-run (live blocked or incomplete)

## Result

**PASS (dry-run)** tool path verified; **live blocked** until Accessibility (+ Mic if voice) re-granted for Mac Agent / CLI

## Decision

Keep dry-run green; re-grant Accessibility in System Settings, then re-run `./Benchmarks/ax_journey.sh --live`.
