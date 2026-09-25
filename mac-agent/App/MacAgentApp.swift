import SwiftUI
import AppKit
import MacAgentCore
import MacAgentLLM
import MacAgentVoice
import MacAgentSecurity

@main
struct MacAgentMenuBarApp: App {
    @StateObject private var session = AgentSessionModel()

    var body: some Scene {
        MenuBarExtra("Mac Agent", systemImage: "waveform.circle.fill") {
            VStack(alignment: .leading, spacing: 10) {
                Text("Mac Agent")
                    .font(.headline)
                Text(session.statusLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Divider()

                Group {
                    Button("Permissions doctor") { session.refreshPermissions() }
                    Button("Request microphone") { Task { await session.requestMic() } }
                    Button("Prompt Accessibility") { session.promptAccessibility() }
                }

                Divider()

                Button("Dry-run: battery (fast path)") { Task { await session.runBattery() } }
                Button("Ollama tool-call probe") { Task { await session.runOllamaProbe() } }

                Divider()

                Button("Quit") { NSApplication.shared.terminate(nil) }
            }
            .padding(12)
            .frame(minWidth: 280)
        }
        .menuBarExtraStyle(.window)
    }
}

@MainActor
final class AgentSessionModel: ObservableObject {
    @Published var statusLine = "Starting…"

    private let runtimeFast = AgentRuntime()
    private lazy var runtimeOllama = AgentRuntime(llm: OllamaProvider())

    init() {
        refreshPermissions()
    }

    func refreshPermissions() {
        let snap = PermissionDoctor.snapshot()
        let lines = snap.map { "\($0.id)=\($0.status)" }
        statusLine = "TCC: " + lines.joined(separator: ", ")
    }

    func requestMic() async {
        let ok = await PermissionDoctor.requestMicrophoneAccess()
        statusLine = ok ? "Microphone granted" : "Microphone denied"
    }

    func promptAccessibility() {
        PermissionDoctor.promptAccessibility()
        refreshPermissions()
    }

    func runBattery() async {
        let record = await runtimeFast.submit(
            TaskRequest(instruction: "What's my battery?", source: "menubar", dryRun: true)
        )
        statusLine = "\(record.state.rawValue): \(record.results.first?.output ?? record.lastError ?? "")"
    }

    func runOllamaProbe() async {
        statusLine = "Calling Ollama…"
        let start = Date()
        let record = await runtimeOllama.submit(
            TaskRequest(
                instruction: "Use the get_system_status tool to report CPU and memory.",
                source: "menubar",
                dryRun: true
            )
        )
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        statusLine = "ollama \(ms)ms state=\(record.state.rawValue) tools=\(record.results.count) err=\(record.lastError ?? "-")"
    }
}
