import SwiftUI
import AppKit
import MacAgentCore
import MacAgentLLM
import MacAgentVoice
import MacAgentSecurity
import MacAgentTools

@main
struct MacAgentMenuBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = AgentSessionModel()

    var body: some Scene {
        MenuBarExtra {
            AgentPanel(session: session)
        } label: {
            Label("Mac Agent", systemImage: session.menuSymbol)
                .accessibilityLabel("Mac Agent")
        }
        .menuBarExtraStyle(.window)
    }
}

/// Popover panel — primary Listen CTA, structured status, permissions tucked away.
struct AgentPanel: View {
    @ObservedObject var session: AgentSessionModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            statusCard
            primaryActions
            Divider().opacity(0.35)
            DisclosureGroup(isExpanded: $session.permissionsExpanded) {
                permissionsBody
                    .padding(.top, 8)
            } label: {
                Label("Permissions", systemImage: "lock.shield")
                    .font(.subheadline.weight(.medium))
            }
            .tint(AgentTheme.teal)
            Divider().opacity(0.35)
            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Label("Quit Mac Agent", systemImage: "xmark.circle")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .accessibilityLabel("Quit Mac Agent")
        }
        .padding(16)
        .frame(width: 340)
        .background(AgentTheme.surface)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Mac Agent")
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                Text("Local voice · capability tools")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            phaseBadge
        }
        .accessibilityElement(children: .combine)
    }

    private var phaseBadge: some View {
        Text(session.phase.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(session.phase.tint.opacity(0.18), in: Capsule())
            .foregroundStyle(session.phase.tint)
            .accessibilityLabel("Status \(session.phase.label)")
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            if session.isBusy {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text(session.busyLabel)
                        .font(.caption.weight(.medium))
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel(session.busyLabel)
            }

            if let heard = session.lastHeard, !heard.isEmpty {
                labeledRow(title: "Heard", value: heard, mono: true)
            }
            if let detail = session.resultDetail, !detail.isEmpty {
                labeledRow(title: "Result", value: detail, mono: false)
            }
            if let meta = session.metaLine, !meta.isEmpty {
                Text(meta)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .textSelection(.enabled)
            }
            if session.lastHeard == nil && session.resultDetail == nil && !session.isBusy {
                Text(session.idleHint)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AgentTheme.card, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(AgentTheme.border, lineWidth: 1)
        )
    }

    private func labeledRow(title: String, value: String, mono: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .tracking(0.4)
            Text(value)
                .font(mono ? .system(.caption, design: .monospaced) : .caption)
                .foregroundStyle(.primary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }

    private var primaryActions: some View {
        VStack(spacing: 8) {
            Button {
                Task { await session.listenOnce() }
            } label: {
                Label(session.isBusy ? "Working…" : "Listen 3 seconds", systemImage: "waveform")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(AgentTheme.teal)
            .disabled(session.isBusy)
            .accessibilityLabel("Listen for three seconds")
            .accessibilityHint(session.actOnce
                ? "Armed. This listen runs tools for real, then Act once turns off."
                : "Records microphone audio, transcribes with WhisperKit, then runs the agent in dry-run")

            Toggle(isOn: $session.actOnce) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Act once")
                        .font(.subheadline.weight(.medium))
                    Text(session.actOnce
                        ? "Next action runs for real, then this turns off."
                        : "Stays dry-run until you arm the next action.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .toggleStyle(.switch)
            .disabled(session.isBusy)
            .accessibilityLabel("Act once")
            .accessibilityValue(session.actOnce ? "On" : "Off")
            .accessibilityHint("Arms the next Listen, Battery, Ollama, or AX journey to run for real")

            HStack(spacing: 8) {
                Button {
                    Task { await session.runBattery() }
                } label: {
                    Label("Battery", systemImage: "battery.100")
                        .frame(maxWidth: .infinity)
                }
                .disabled(session.isBusy)
                .accessibilityLabel("Run battery status dry run")

                Button {
                    Task { await session.runOllamaProbe() }
                } label: {
                    Label("Ollama", systemImage: "cpu")
                        .frame(maxWidth: .infinity)
                }
                .disabled(session.isBusy)
                .accessibilityLabel("Run Ollama tool call probe")
            }
            .buttonStyle(.bordered)
            .controlSize(.regular)

            Button {
                Task { await session.runAXJourney() }
            } label: {
                Label(session.actOnce ? "AX journey (live)" : "AX journey (dry-run)", systemImage: "hand.tap")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(session.isBusy)
            .accessibilityLabel("Run Accessibility click and type journey dry run")
        }
    }

    private var permissionsBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(session.permissionRows) { row in
                HStack {
                    Circle()
                        .fill(row.ok ? AgentTheme.teal : Color.orange)
                        .frame(width: 7, height: 7)
                        .accessibilityHidden(true)
                    Text(row.title)
                        .font(.caption)
                    Spacer()
                    Text(row.status)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(row.title) \(row.status)")
            }
            HStack(spacing: 8) {
                Button("Refresh") { session.refreshPermissions() }
                    .accessibilityLabel("Refresh permission status")
                Button("Ask mic") { Task { await session.requestMic() } }
                    .accessibilityLabel("Request microphone permission")
                Button("Mic settings") { PermissionDoctor.openMicrophoneSettings() }
                    .accessibilityLabel("Open Microphone system settings")
                Button("Accessibility") { session.promptAccessibility() }
                    .accessibilityLabel("Prompt Accessibility permission")
            }
            .buttonStyle(.borderless)
            .font(.caption)
            .tint(AgentTheme.teal)
            .disabled(session.isBusy)
        }
    }
}

enum AgentTheme {
    /// Productivity-tool teal (ui-ux-pro-max); avoid purple AI-default.
    static let teal = Color(red: 0.05, green: 0.58, blue: 0.53) // #0D9488
    static let surface = Color(nsColor: .windowBackgroundColor)
    static let card = Color(nsColor: .controlBackgroundColor)
    static let border = Color.primary.opacity(0.08)
}

enum AgentPhase: Equatable {
    case idle, listening, running, success, error

    var label: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening"
        case .running: return "Working"
        case .success: return "OK"
        case .error: return "Error"
        }
    }

    var tint: Color {
        switch self {
        case .idle: return .secondary
        case .listening: return AgentTheme.teal
        case .running: return .orange
        case .success: return AgentTheme.teal
        case .error: return .red
        }
    }
}

struct PermissionRow: Identifiable {
    var id: String { title }
    var title: String
    var status: String
    var ok: Bool
}

/// Ensures only one menu-bar instance runs (same bundle id from dist/ or ~/Applications).
final class AppDelegate: NSObject, NSApplicationDelegate {
    static let bundleID = "com.mcpui.mac-agent"

    func applicationWillFinishLaunching(_ notification: Notification) {
        let others = NSRunningApplication.runningApplications(withBundleIdentifier: Self.bundleID)
            .filter { $0 != NSRunningApplication.current }
        if !others.isEmpty {
            others.first?.activate()
            NSApp.terminate(nil)
        }
    }
}

@MainActor
final class AgentSessionModel: ObservableObject {
    @Published var phase: AgentPhase = .idle
    @Published var isBusy = false
    @Published var busyLabel = ""
    @Published var lastHeard: String?
    @Published var resultDetail: String?
    @Published var metaLine: String?
    @Published var idleHint = "Press Listen, then say “what's my battery”."
    @Published var permissionsExpanded = false
    @Published var permissionRows: [PermissionRow] = []
    /// One-shot live arm. Default off so menu-bar actions stay dry-run.
    @Published var actOnce = false

    var menuSymbol: String {
        switch phase {
        case .listening: return "waveform.circle.fill"
        case .running: return "ellipsis.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.circle.fill"
        case .idle: return "waveform.circle.fill"
        }
    }

    private let runtimeFast = AgentRuntime()
    private lazy var runtimeOllama = AgentRuntime(llm: OllamaProvider())

    init() {
        refreshPermissions()
    }

    func refreshPermissions() {
        let snap = PermissionDoctor.snapshot()
        permissionRows = snap.map { need in
            PermissionRow(
                title: need.title,
                status: need.status,
                ok: need.status == "granted" || need.status == "optional"
            )
        }
        if phase == .idle && lastHeard == nil {
            let mic = snap.first(where: { $0.id == "microphone" })?.status ?? "?"
            idleHint = mic == "granted"
                ? "Press Listen, then say “what's my battery”."
                : "Microphone not granted — expand Permissions."
        }
    }

    func requestMic() async {
        NSApp.activate()
        beginBusy("Requesting microphone…", phase: .running)
        switch await PermissionDoctor.requestMicrophoneAccessDetailed() {
        case .granted:
            finish(success: true, heard: nil, result: "Microphone granted", meta: nil)
        case .deniedOpenedSettings:
            finish(
                success: false,
                heard: nil,
                result: "Already denied — enable Mac Agent in System Settings → Microphone.",
                meta: "Opened settings"
            )
        case .promptedButDenied:
            finish(success: false, heard: nil, result: "Microphone denied in the prompt.", meta: nil)
        case .unavailable:
            finish(success: false, heard: nil, result: "Microphone APIs unavailable", meta: nil)
        }
        refreshPermissions()
    }

    func promptAccessibility() {
        PermissionDoctor.promptAccessibility()
        refreshPermissions()
        finish(success: true, heard: nil, result: "Accessibility prompt shown (if needed).", meta: nil)
    }

    func listenOnce() async {
        let live = takeLive()
        beginBusy(live ? "Listening 3s… this action is live" : "Listening 3s… speak clearly", phase: .listening)
        do {
            let stt = await STTFactory.makeDefault(fallbackTranscript: "What's my battery?")
            phase = .running
            busyLabel = "Transcribing & running…"
            let pipeline = VoicePipeline(stt: stt, tts: MockTTSProvider(), runtime: runtimeOllama)
            let start = Date()
            let turn = try await pipeline.handleMicrophoneTurn(seconds: 3.0, dryRun: !live)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            let heard = turn.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            let out = turn.record.results.first?.output
                ?? turn.record.assistantText
                ?? turn.record.lastError
                ?? "(no output)"
            let ok = turn.record.state == .succeeded
            finish(
                success: ok,
                heard: heard.isEmpty ? "(empty — try again)" : heard,
                result: out,
                meta: "stt=\(stt.id) · \(ms)ms · \(turn.record.state.rawValue) · \(live ? "live" : "dry-run")"
            )
        } catch {
            finish(success: false, heard: nil, result: "Listen failed: \(error)", meta: nil)
        }
    }

    func runBattery() async {
        let live = takeLive()
        beginBusy(live ? "Fast path (live)…" : "Fast path…", phase: .running)
        let record = await runtimeFast.submit(
            TaskRequest(instruction: "What's my battery?", source: "menubar", dryRun: !live)
        )
        finish(
            success: record.state == .succeeded,
            heard: "What's my battery?",
            result: record.results.first?.output ?? record.lastError ?? "",
            meta: "fast-path · \(record.state.rawValue) · \(live ? "live" : "dry-run")"
        )
    }

    func runOllamaProbe() async {
        let live = takeLive()
        beginBusy(live ? "Calling Ollama (live)…" : "Calling Ollama…", phase: .running)
        let start = Date()
        let record = await runtimeOllama.submit(
            TaskRequest(
                instruction: "Use the get_system_status tool to report CPU and memory.",
                source: "menubar",
                dryRun: !live
            )
        )
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        finish(
            success: record.state == .succeeded,
            heard: nil,
            result: record.results.first?.output ?? record.assistantText ?? record.lastError ?? "",
            meta: "ollama · \(ms)ms · tools=\(record.results.count) · \(live ? "live" : "dry-run")"
        )
    }

    func runAXJourney() async {
        let live = takeLive()
        beginBusy(live ? "AX journey (live)…" : "AX journey dry-run…", phase: .running)
        let host = ToolHost.default()
        let ctx = ToolContext(taskId: "menubar-ax", requestId: UUID().uuidString, source: "menubar", dryRun: !live)
        var lines: [String] = []
        var ok = true
        let start = Date()
        if let click = host.tool(named: "click_element") {
            do {
                let r = try await click.execute(
                    arguments: [
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXMenuBarItem"),
                        "title": .string("Edit"),
                    ],
                    context: ctx
                )
                lines.append(r.output)
                ok = ok && r.ok
            } catch {
                lines.append("click failed: \(error)")
                ok = false
            }
        }
        if let type = host.tool(named: "type_text") {
            do {
                let r = try await type.execute(
                    arguments: [
                        "text": .string("MacAgent-AX-probe"),
                        "app": .string("com.apple.TextEdit"),
                        "role": .string("AXTextArea"),
                    ],
                    context: ctx
                )
                lines.append(r.output)
                ok = ok && r.ok
            } catch {
                lines.append("type failed: \(error)")
                ok = false
            }
        }
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        finish(
            success: ok,
            heard: nil,
            result: lines.joined(separator: "\n"),
            meta: "ax-journey · \(live ? "live" : "dry-run") · \(ms)ms · a11y=\(PermissionDoctor.status(for: "accessibility"))"
        )
    }

    /// Arms exactly one live action, then clears. Default remains dry-run.
    private func takeLive() -> Bool {
        let live = actOnce
        actOnce = false
        return live
    }

    private func beginBusy(_ label: String, phase: AgentPhase) {
        isBusy = true
        busyLabel = label
        self.phase = phase
        resultDetail = nil
        metaLine = nil
    }

    private func finish(success: Bool, heard: String?, result: String, meta: String?) {
        isBusy = false
        busyLabel = ""
        phase = success ? .success : .error
        if let heard { lastHeard = heard }
        resultDetail = result
        metaLine = meta
    }
}
