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
        VStack(alignment: .leading, spacing: AgentChrome.stack) {
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
            .tint(AgentChrome.teal)
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
        .padding(AgentChrome.pad)
        .frame(width: 320)
        .background(AgentChrome.surface)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "waveform")
                .font(.body.weight(.semibold))
                .foregroundStyle(AgentChrome.teal)
                .frame(width: 32, height: 32)
                .background(AgentChrome.teal.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text("Mac Agent")
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                Text(session.phase.label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(session.phase.tint)
            }
            Spacer(minLength: 8)
        }
        .accessibilityElement(children: .combine)
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
                labeledRow(title: "Heard", value: heard, mono: false)
            }
            if let detail = session.resultDetail, !detail.isEmpty {
                labeledRow(title: "Result", value: detail, mono: false)
            }
            Text(session.nextActionLine)
                .font(.caption.weight(.medium))
                .foregroundStyle(session.actOnce ? AgentChrome.teal : .secondary)
                .accessibilityIdentifier("NextActionLine")
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
        .background(AgentChrome.card, in: RoundedRectangle(cornerRadius: AgentChrome.radius, style: .continuous))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(session.phase.tint)
                .frame(width: 3)
                .padding(.vertical, 10)
                .accessibilityHidden(true)
        }
        .overlay(
            RoundedRectangle(cornerRadius: AgentChrome.radius, style: .continuous)
                .strokeBorder(AgentChrome.border, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(statusAccessibilityLabel)
    }

    private func labeledRow(title: String, value: String, mono: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .tracking(0.4)
            Text(value)
                .font(title == "Heard" ? .body : (mono ? .system(.caption, design: .monospaced) : .caption))
                .foregroundStyle(.primary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }

    private var statusAccessibilityLabel: String {
        var parts = ["Status \(session.phase.label)"]
        if session.isBusy { parts.append(session.busyLabel) }
        if let heard = session.lastHeard, !heard.isEmpty { parts.append("Heard \(heard)") }
        if let detail = session.resultDetail, !detail.isEmpty { parts.append(detail) }
        if parts.count == 1 { parts.append(session.idleHint) }
        return parts.joined(separator: ". ")
    }

    private var primaryActions: some View {
        VStack(spacing: 8) {
            Button {
                if session.phase == .listening {
                    session.stopListening()
                } else {
                    Task { await session.listenOnce() }
                }
            } label: {
                Label(
                    session.phase == .listening ? "Stop" : "Listen",
                    systemImage: session.phase == .listening ? "stop.fill" : "waveform"
                )
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .tint(AgentChrome.teal)
            .disabled(session.isBusy && session.phase != .listening)
            .accessibilityLabel(session.phase == .listening ? "Stop listening" : "Listen")
            .accessibilityHint(session.actOnce
                ? "Armed. This listen runs tools for real, then Act once turns off."
                : "Records microphone audio, transcribes locally, then shows what it heard")

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
            .padding(10)
            .background(
                session.actOnce ? AgentChrome.teal.opacity(0.12) : AgentChrome.card,
                in: RoundedRectangle(cornerRadius: AgentChrome.radius, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: AgentChrome.radius, style: .continuous)
                    .strokeBorder(session.actOnce ? AgentChrome.teal.opacity(0.45) : AgentChrome.border, lineWidth: 1)
            )

            DisclosureGroup(isExpanded: $session.toolsExpanded) {
                VStack(spacing: 8) {
                    HStack(spacing: 8) {
                        Button {
                            Task { await session.runBattery() }
                        } label: {
                            Label("Battery", systemImage: "battery.100")
                                .frame(maxWidth: .infinity)
                        }
                        .disabled(session.isBusy)
                        .accessibilityLabel("Run battery status")

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

                    Button {
                        Task { await session.runAXJourney() }
                    } label: {
                        Label(session.actOnce ? "AX journey (live)" : "AX journey", systemImage: "hand.tap")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(session.isBusy)
                    .accessibilityLabel("Run Accessibility journey")
                }
                .padding(.top, 8)
            } label: {
                Label("Tools", systemImage: "wrench.and.screwdriver")
                    .font(.subheadline.weight(.medium))
            }
            .accessibilityIdentifier("VoiceToolsDisclosure")
        }
    }

    private var permissionsBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(session.accessibilityStatusLine)
                .font(.caption.weight(.medium))
                .foregroundStyle(session.accessibilityGranted ? AgentChrome.teal : .orange)
                .accessibilityIdentifier("AccessibilityStatusLine")
            ForEach(session.permissionRows) { row in
                HStack {
                    Circle()
                        .fill(row.ok ? AgentChrome.teal : Color.orange)
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
            .tint(AgentChrome.teal)
            .disabled(session.isBusy)
        }
    }
}

enum AgentChrome {
    /// Productivity-tool teal (ui-ux-pro-max); avoid purple AI-default.
    static let teal = Color(red: 0.05, green: 0.58, blue: 0.53) // #0D9488
    static let surface = Color(nsColor: .windowBackgroundColor)
    static let card = Color(nsColor: .controlBackgroundColor)
    static let border = Color.primary.opacity(0.10)
    static let pad: CGFloat = 16
    static let stack: CGFloat = 12
    static let radius: CGFloat = 10
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
        case .listening: return AgentChrome.teal
        case .running: return .orange
        case .success: return AgentChrome.teal
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
    @Published var toolsExpanded = false
    @Published var permissionRows: [PermissionRow] = []
    /// One-shot live arm. Default off so menu-bar actions stay dry-run.
    @Published var actOnce = false
    @Published var accessibilityGranted = false
    @Published var accessibilityStatusLine = "Checking Accessibility…"

    var nextActionLine: String {
        actOnce ? "Next action: live, then Act once turns off" : "Next action: dry-run"
    }

    var menuSymbol: String {
        switch phase {
        case .listening: return "waveform.circle.fill"
        case .running: return "ellipsis.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.circle.fill"
        case .idle: return "waveform.circle"
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
        accessibilityGranted = PermissionDoctor.status(for: "accessibility") == "granted"
        accessibilityStatusLine = accessibilityGranted
            ? "Accessibility granted"
            : "Accessibility needed for live clicks"
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

    private var listenGeneration = 0

    func stopListening() {
        listenGeneration += 1
        finish(success: false, heard: lastHeard, result: "Stopped", meta: nil)
    }

    func listenOnce() async {
        let live = takeLive()
        let generation = listenGeneration
        beginBusy(live ? "Listening… this action is live" : "Listening… speak clearly", phase: .listening)
        do {
            let stt = await STTFactory.makeDefault(fallbackTranscript: "What's my battery?")
            guard generation == listenGeneration else { return }
            phase = .running
            busyLabel = "Transcribing…"
            let pipeline = VoicePipeline(stt: stt, tts: MockTTSProvider(), runtime: runtimeOllama)
            let start = Date()
            let turn = try await pipeline.handleMicrophoneTurn(seconds: 3.0, dryRun: !live)
            guard generation == listenGeneration else { return }
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
