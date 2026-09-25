import Foundation
import MacAgentCore
import MacAgentInterfaces
import MacAgentLLM
import MacAgentVoice
import MacAgentSecurity
import MacAgentTools
#if canImport(AppKit)
import AppKit
#endif

@main
struct MacAgentCLI {
    static func main() async {
        let args = Array(CommandLine.arguments.dropFirst())
        if args.contains("--permissions") {
            for p in PermissionDoctor.snapshot() {
                print("\(p.id)\t\(p.status)\t\(p.title)")
            }
            return
        }
        if args.contains("--prompt-accessibility") {
            PermissionDoctor.promptAccessibility()
            print("accessibility=\(PermissionDoctor.status(for: "accessibility"))")
            return
        }
        if args.contains("--ax-journey") {
            await runAXJourney(live: args.contains("--live"))
            return
        }

        let useOllama = args.contains("--ollama")
        let instruction = args.filter { $0 != "--ollama" && $0 != "--live" }.joined(separator: " ")
        let live = args.contains("--live")
        guard !instruction.isEmpty else {
            print("usage: mac-agent-cli [--ollama] [--live] [--permissions] [--ax-journey] <instruction>")
            return
        }

        let llm: any LLMProvider = useOllama ? OllamaProvider() : MockLLMProvider(canned: LLMResponse())
        let runtime = AgentRuntime(llm: llm)
        let start = Date()
        let result = await runtime.submit(
            TaskRequest(instruction: instruction, source: "cli", dryRun: !live)
        )
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        print("provider=\(llm.id)")
        print("latency_ms=\(ms)")
        print("state=\(result.state.rawValue)")
        if let err = result.lastError { print("error=\(err)") }
        for r in result.results {
            print(r.output)
        }
    }

    /// Safe TextEdit document + menu click journey for Accessibility proof.
    static func runAXJourney(live: Bool) async {
        let ax = PermissionDoctor.status(for: "accessibility")
        print("accessibility=\(ax)")
        print("live=\(live)")
        let host = ToolHost.default()
        let ctx = ToolContext(taskId: "ax-journey", requestId: UUID().uuidString, source: "cli", dryRun: !live)
        var okAll = true
        let start = Date()

        // Seed a real TextEdit window (modern Calculator exposes no AX window tree).
        let marker = "MacAgent-AX-\(ISO8601DateFormatter().string(from: Date()))"
        let seedPath = NSTemporaryDirectory() + "mac-agent-ax-seed.txt"
        try? "seed\n".write(toFile: seedPath, atomically: true, encoding: .utf8)

        if live {
            #if canImport(AppKit)
            await MainActor.run {
                NSWorkspace.shared.open(URL(fileURLWithPath: seedPath))
            }
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            await MainActor.run {
                if let app = NSWorkspace.shared.runningApplications
                    .first(where: { $0.bundleIdentifier == "com.apple.TextEdit" })
                {
                    app.activate()
                }
            }
            try? await Task.sleep(nanoseconds: 400_000_000)
            #endif
            print("step=open_seed_doc ok=true path=\(seedPath)")
        } else if let open = host.tool(named: "open_application") {
            do {
                let r = try await open.execute(
                    arguments: ["name": .string("TextEdit")],
                    context: ctx
                )
                print("step=open_textedit ok=\(r.ok) \(r.output)")
                okAll = okAll && r.ok
            } catch {
                print("step=open_textedit error=\(error)")
                okAll = false
            }
        }

        // 1) Open Edit menu, then press Select All (menu items often need parent open).
        if let click = host.tool(named: "click_element") {
            do {
                let openEdit = try await click.execute(
                    arguments: [
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXMenuBarItem"),
                        "title": .string("Edit"),
                    ],
                    context: ctx
                )
                print("step=click_edit_menu ok=\(openEdit.ok) \(openEdit.output)")
                okAll = okAll && openEdit.ok
                if live { try? await Task.sleep(nanoseconds: 250_000_000) }
                let r = try await click.execute(
                    arguments: [
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXMenuItem"),
                        "title": .string("Select All"),
                    ],
                    context: ctx
                )
                print("step=click_select_all ok=\(r.ok) \(r.output)")
                okAll = okAll && r.ok
            } catch {
                print("step=click_select_all error=\(error)")
                okAll = false
            }
        }

        // 2) Type marker into TextEdit text area (or focused element fallback).
        if let type = host.tool(named: "type_text") {
            do {
                var r = try await type.execute(
                    arguments: [
                        "text": .string(marker),
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXTextArea"),
                    ],
                    context: ctx
                )
                if !r.ok && live {
                    // Fallback: focused element after seed doc open.
                    r = try await type.execute(
                        arguments: ["text": .string(marker)],
                        context: ctx
                    )
                }
                print("step=type_textedit ok=\(r.ok) \(r.output)")
                print("marker=\(marker)")
                okAll = okAll && r.ok
            } catch {
                print("step=type_textedit error=\(error)")
                okAll = false
            }
        }

        // 3) Second click: Edit → Copy (post-type proof).
        if let click = host.tool(named: "click_element") {
            do {
                _ = try await click.execute(
                    arguments: [
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXMenuBarItem"),
                        "title": .string("Edit"),
                    ],
                    context: ctx
                )
                if live { try? await Task.sleep(nanoseconds: 250_000_000) }
                let r = try await click.execute(
                    arguments: [
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXMenuItem"),
                        "title": .string("Copy"),
                    ],
                    context: ctx
                )
                print("step=click_copy ok=\(r.ok) \(r.output)")
                okAll = okAll && r.ok
            } catch {
                print("step=click_copy error=\(error)")
                okAll = false
            }
        }

        let ms = Int(Date().timeIntervalSince(start) * 1000)
        print("ax_journey_ms=\(ms)")
        print("ax_journey_ok=\(okAll)")
        if ax != "granted" {
            print("note=Accessibility not granted — live steps may fail; enable Mac Agent in System Settings")
        }
    }
}
