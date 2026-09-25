# Live AX journey

Date: 2026-09-25T06:36:32.092Z

```
[0/1] Planning build
Building for production...
[0/2] Write swift-version--58304C5D6DBC2206.txt
[2/4] Compiling MacAgentCLI main.swift
/Users/adityaraj/Desktop/My Projects/mcp-ui-poc/mac-agent/Sources/MacAgentCLI/main.swift:73:29: warning: result of call to 'run(resultType:body:)' is unused [#no-usage]
 71 |         if live {
 72 |             #if canImport(AppKit)
 73 |             await MainActor.run {
    |                             `- warning: result of call to 'run(resultType:body:)' is unused [#no-usage]
 74 |                 NSWorkspace.shared.open(URL(fileURLWithPath: seedPath))
 75 |             }
[2/4] Write Objects.LinkFileList
[3/4] Linking mac-agent-cli
Build of product 'mac-agent-cli' complete! (4.30s)
accessibility=denied_or_prompt
live=true
step=open_seed_doc ok=true path=/var/folders/r0/qkykscrj76ld88gf8l9h2_vw0000gn/T/mac-agent-ax-seed.txt
step=click_edit_menu ok=false Accessibility not granted — enable Mac Agent in System Settings
step=click_select_all ok=false Accessibility not granted — enable Mac Agent in System Settings
step=type_textedit ok=false Accessibility not granted — enable Mac Agent in System Settings
marker=MacAgent-AX-2026-09-25T06:36:29Z
step=click_copy ok=false Accessibility not granted — enable Mac Agent in System Settings
ax_journey_ms=2601
ax_journey_ok=false
note=Accessibility not granted — live steps may fail; enable Mac Agent in System Settings
```

Result: FAIL
