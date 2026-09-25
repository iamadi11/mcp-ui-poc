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
        VStack(alignment: .leading, spacing: 16) {
            if let status = voiceCopy.status {
                Text(status)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Text(voiceCopy.hero)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityIdentifier(voiceCopy.identifier)
            listenControl
            actOnceControl
            toolsDisclosure
            DisclosureGroup(isExpanded: $session.permissionsExpanded) {
                permissionsBody
                    .padding(.top, 8)
            } label: {
                Text("Permissions")
                    .font(.system(size: 12))
            }
            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                Text("Quit")
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .font(.system(size: 12))
            .foregroundStyle(.tertiary)
            .accessibilityLabel("Quit Mac Agent")
        }
        .padding(16)
        .frame(width: 300)
        .background(AgentChrome.surface)
        .accessibilityElement(children: .contain)
    }

    private var voiceCopy: (status: String?, hero: String, identifier: String) {
        let heard = clean(session.lastHeard)
        let result = clean(session.resultDetail)
        switch session.phase {
        case .listening:
            if let heard { return ("Listening", heard, "LiveTranscriptLine") }
            return (nil, "Listening", "LiveTranscriptLine")
        case .running:
            if let heard { return ("Working", heard, "AnswerLine") }
            return (nil, "Working", "AnswerLine")
        default:
            if result == "Stopped" {
                return ("Stopped", heard ?? "Stopped", "AnswerLine")
            }
            if let result, let heard, result != heard {
                return (heard, result, result.contains("didn't hear") ? "PlainFailureLine" : "AnswerLine")
            }
            if let result {
                return (nil, result, result.contains("didn't hear") ? "PlainFailureLine" : "AnswerLine")
            }
            if let heard { return (nil, heard, "AnswerLine") }
            if !session.microphoneGranted {
                return (nil, "Microphone needed to listen", "PlainFailureLine")
            }
            return (nil, "Say a command", "AnswerLine")
        }
    }

    private func clean(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        return trimmed
    }

    private var listenControl: some View {
        Button {
            if session.phase == .listening {
                session.stopListening()
            } else {
                session.listenTask = Task { await session.listenOnce() }
            }
        } label: {
            Text(session.phase == .listening ? "Stop" : "Listen")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(AgentChrome.teal, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityIdentifier("ListenControl")
        }
        .buttonStyle(.plain)
        .disabled(session.isBusy && session.phase != .listening)
        .accessibilityLabel(session.phase == .listening ? "Stop listening" : "Listen")
    }

    private var actOnceControl: some View {
        Toggle(isOn: $session.actOnce) {
            Text(session.actOnce ? "Act once" : "Preview")
                .font(.system(size: 12))
        }
        .toggleStyle(.switch)
        .disabled(session.isBusy)
        .accessibilityLabel("Act once")
        .accessibilityValue(session.actOnce ? "On" : "Off")
        .accessibilityIdentifier("NextActionLine")
    }

    private var toolsDisclosure: some View {
        DisclosureGroup(isExpanded: $session.toolsExpanded) {
            VStack(spacing: 8) {
                Button {
                    Task { await session.runBattery() }
                } label: {
                    Text("Battery")
                        .frame(maxWidth: .infinity)
                }
                .disabled(session.isBusy)
                .accessibilityLabel("Run battery status")

                Button {
                    Task { await session.runOllamaProbe() }
                } label: {
                    Text("Ollama")
                        .frame(maxWidth: .infinity)
                }
                .disabled(session.isBusy)
                .accessibilityLabel("Run Ollama tool call probe")

                Button {
                    Task { await session.runAXJourney() }
                } label: {
                    Text(session.actOnce ? "AX journey, live" : "AX journey")
                        .frame(maxWidth: .infinity)
                }
                .disabled(session.isBusy)
                .accessibilityLabel("Run Accessibility journey")
            }
            .buttonStyle(.bordered)
            .padding(.top, 8)
        } label: {
            Text("Tools")
                .font(.system(size: 12))
        }
        .accessibilityIdentifier("VoiceToolsDisclosure")
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
    @Published var microphoneGranted = false
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
                : "Microphone needed to listen."
        }
        microphoneGranted = snap.first(where: { $0.id == "microphone" })?.status == "granted"
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
    var listenTask: Task<Void, Never>?

    func stopListening() {
        listenGeneration += 1
        listenTask?.cancel()
        finish(success: false, heard: lastHeard, result: "Stopped", meta: nil)
    }

    func publishPartial(_ heard: String) {
        let trimmed = heard.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != "Waiting for speech..." else { return }
        lastHeard = trimmed
    }

    func publishHeard(_ heard: String) {
        let trimmed = heard.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        lastHeard = trimmed
        phase = .running
        busyLabel = "Running…"
    }

    func listenOnce() async {
        let live = takeLive()
        let generation = listenGeneration
        beginBusy(live ? "Listening… this action is live" : "Listening… speak clearly", phase: .listening)
        do {
            let stt = await STTFactory.makeDefault(fallbackTranscript: "What's my battery?")
            guard generation == listenGeneration else { return }
            let heard: String
            let record: TaskRecord
            if let whisper = stt as? WhisperKitSTTProvider {
                let text = try await whisper.transcribeLive(maxSeconds: 6) { partial in
                    await MainActor.run { self.publishPartial(partial) }
                }
                guard generation == listenGeneration else { return }
                let spokenNow = text.trimmingCharacters(in: .whitespacesAndNewlines)
                if spokenNow.count < 2 {
                    finish(success: false, heard: nil, result: "I didn't hear a command.", meta: nil)
                    return
                }
                phase = .running
                busyLabel = "Running…"
                record = await runtimeOllama.submit(
                    TaskRequest(instruction: spokenNow, source: "voice", dryRun: !live)
                )
                heard = spokenNow
            } else {
                phase = .running
                busyLabel = "Transcribing…"
                let pipeline = VoicePipeline(stt: stt, tts: MockTTSProvider(), runtime: runtimeOllama)
                let turn = try await pipeline.handleMicrophoneTurn(seconds: 3.0, dryRun: !live) { partial in
                    await MainActor.run { self.publishHeard(partial) }
                }
                guard generation == listenGeneration else { return }
                record = turn.record
                heard = turn.transcript
            }
            let spoken = heard.trimmingCharacters(in: .whitespacesAndNewlines)
            let out = record.results.first?.output
                ?? record.assistantText
                ?? record.lastError
                ?? "I don't have a command for that."
            finish(
                success: record.state == .succeeded,
                heard: spoken.count >= 2 ? spoken : nil,
                result: out,
                meta: nil
            )
        } catch {
            guard generation == listenGeneration else { return }
            finish(success: false, heard: lastHeard, result: "Listen failed: \(error)", meta: nil)
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
